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
function xhrGet(url: string): Promise<{ ok: boolean; status: number; text: string }> {
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
      const response = await xhrGet('/api/kaitorix/' + encodeURIComponent(jan));
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

export async function fetchBuybackPrices(
  janCodes: string[]
): Promise<Map<string, KaitorixResponse | null>> {
  const uniqueJans = [...new Set(janCodes)];

  const results = await Promise.allSettled(
    uniqueJans.map(jan => fetchBuybackPrice(jan))
  );

  const resultMap = new Map<string, KaitorixResponse | null>();

  uniqueJans.forEach((jan, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      resultMap.set(jan, result.value);
    } else {
      resultMap.set(jan, null);
    }
  });

  return resultMap;
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
