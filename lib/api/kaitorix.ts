// KaitoriX API client with caching and batch fetching

interface KaitorixPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
}

interface KaitorixResponse {
  jan: string;
  name: string;
  max_price: number;
  max_store: string;
  prices: KaitorixPrice[];
  _source?: string;
  _fetched_at?: string; // ISO string — actual time data was scraped (only present for stale)
}

interface CacheEntry {
  data: KaitorixResponse;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<KaitorixResponse | null>>();

// Store name to key mapping
const STORE_NAME_TO_KEY: Record<string, string> = {
  '買取一丁目': 'ichoume',
  '買取商店': 'shouten',
  '森森買取': 'morimori',
  '買取ルデヤ': 'rudeya',
  'モバイル一番': 'mobile_ichiban',
  '買取ホムラ': 'homura',
  '買取Top Offers': 'top_offers',
  '買取楽園': 'rakuen',
};

// Use XHR to avoid Next.js fetch interception in dev mode
function xhrGet(url: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText,
      });
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal) {
      if (signal.aborted) { xhr.abort(); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send();
  });
}

export async function fetchBuybackPrice(
  jan: string
): Promise<KaitorixResponse | null> {
  // Check cache
  const cached = cache.get(jan);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Check pending requests (deduplication)
  const pending = pendingRequests.get(jan);
  if (pending) {
    return pending;
  }

  // Create new request
  const request = (async () => {
    try {
      const response = await xhrGet('/api/kaitorix/' + encodeURIComponent(jan), undefined);
      if (!response.ok) {
        return null;
      }

      let data: KaitorixResponse;
      try {
        data = JSON.parse(response.text);
      } catch {
        return null;
      }

      if (!data.jan || !data.prices) {
        return null;
      }

      // Don't cache pending/empty results
      if (data.prices.length === 0 || data._source === 'pending') {
        return data;
      }

      // Cache the result
      cache.set(jan, { data, timestamp: Date.now() });

      return data;
    } catch {
      return null;
    } finally {
      pendingRequests.delete(jan);
    }
  })();

  pendingRequests.set(jan, request);
  return request;
}

export interface FetchProgress {
  completed: number;
  total: number;
  failed: number;
  stopped: boolean; // circuit breaker triggered
}

export async function fetchBuybackPrices(
  janCodes: string[],
  onProgress?: (progress: FetchProgress) => void,
  abortSignal?: AbortSignal,
): Promise<Map<string, KaitorixResponse | null>> {
  const uniqueJans = [...new Set(janCodes)];
  const resultMap = new Map<string, KaitorixResponse | null>();

  if (uniqueJans.length === 0) return resultMap;

  // Requests hit our own API route (Supabase cache read + queue insert only).
  // The scraper worker controls its own pace against kaitorix.app — parallel here is safe.
  let completed = 0;
  let failed = 0;

  await Promise.all(
    uniqueJans.map(async (jan) => {
      if (abortSignal?.aborted) return;

      const result = await fetchBuybackPrice(jan);
      resultMap.set(jan, result);

      if (!result) failed++;
      completed++;

      onProgress?.({
        completed,
        total: uniqueJans.length,
        failed,
        stopped: false,
      });
    })
  );

  return resultMap;
}

export function getFilteredPrices(
  result: KaitorixResponse | null,
  enabledStoreKeys: string[]
): Array<{ store: string; price: number; url: string }> {
  if (!result?.prices?.length) return [];
  const enabledSet = new Set(enabledStoreKeys);
  return result.prices
    .filter(p => {
      const key = STORE_NAME_TO_KEY[p.store];
      return key && enabledSet.has(key);
    })
    .map(p => ({ store: p.store, price: p.price, url: p.url }));
}

export function getBestPrice(
  result: KaitorixResponse | null,
  enabledStoreKeys: string[]
): { maxPrice: number; maxStore: string } | null {
  if (!result || !result.prices || result.prices.length === 0) {
    return null;
  }

  // Filter prices by enabled stores
  const enabledSet = new Set(enabledStoreKeys);
  const filteredPrices = result.prices.filter(p => {
    const storeKey = STORE_NAME_TO_KEY[p.store];
    return storeKey && enabledSet.has(storeKey);
  });

  if (filteredPrices.length === 0) {
    return null;
  }

  // Find max price
  const best = filteredPrices.reduce((max, current) =>
    current.price > max.price ? current : max
  );

  return {
    maxPrice: best.price,
    maxStore: best.store,
  };
}
