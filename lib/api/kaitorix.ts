// KaitoriX API client with caching and batch fetching

import { discoverStores } from '@/lib/kaitorix-config';
import type { JanPriceData, KaitorixSource } from '@/lib/kaitorix-domain';
import { supabase } from '@/lib/supabase/client';

interface KaitorixPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
}

export interface KaitorixResponse {
  jan: string;
  name: string;
  max_price: number;
  max_store: string;
  prices: KaitorixPrice[];
  _source?: string;
  _fetched_at?: string; // ISO string — actual time data was scraped (only present for stale)
  rateLimit?: KaitorixRateLimit;
}

interface CacheEntry {
  data: KaitorixResponse;
  timestamp: number;
}

export interface KaitorixRateLimit {
  limit: number;
  remaining: number | null;
  reset: string | null;
}

export interface ForceRefreshResult {
  data: KaitorixResponse | null;
  rateLimit?: KaitorixRateLimit;
  error?: string;
  status?: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<KaitorixResponse | null>>();

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

      // 动态发现新店铺并保存到 localStorage
      if (data.prices.length > 0) {
        discoverStores(data.prices.map(p => p.store));
      }

      // Only cache fresh server-side results; stale/pending must always hit server
      // so the server can re-enqueue a scrape on every request
      if (data.prices.length === 0 || data._source === 'pending' || data._source === 'stale') {
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

export async function forceRefreshBuybackPrice(jan: string): Promise<ForceRefreshResult> {
  try {
    const response = await fetch('/api/kaitorix/force-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jan }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: payload?.error || 'Kaitorix 官方强刷失败',
        rateLimit: payload?.rateLimit,
        status: response.status,
      };
    }

    if (!payload?.jan || !Array.isArray(payload.prices)) {
      return { data: null, error: 'Kaitorix 官方 API 返回格式不正确', status: response.status };
    }

    if (payload.prices.length > 0) {
      discoverStores(payload.prices.map((p: KaitorixPrice) => p.store));
    }

    cache.set(jan, { data: payload, timestamp: Date.now() });
    if (payload.jan !== jan) {
      cache.set(payload.jan, { data: payload, timestamp: Date.now() });
    }

    return {
      data: payload,
      rateLimit: payload.rateLimit,
      status: response.status,
    };
  } catch {
    return { data: null, error: 'Kaitorix 官方 API 请求失败' };
  }
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

/**
 * 批量读取 DB 价格缓存（每 200 个 JAN 一次往返，替代逐 JAN XHR）。
 * 只读：不触发补抓入队；需要入队时走 /api/kaitorix/[jan]（fetchBuybackPrice）。
 */
export async function fetchCachedPricesBulk(jans: string[]): Promise<Map<string, JanPriceData>> {
  const map = new Map<string, JanPriceData>();
  const CHUNK_SIZE = 200;

  for (let i = 0; i < jans.length; i += CHUNK_SIZE) {
    const chunk = jans.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('kaitorix_price_cache')
      .select('jan, product_name, prices, fetched_at, last_fetch_source')
      .in('jan', chunk);

    if (error) {
      console.error('批量读取买取价格缓存失败:', error);
      break;
    }

    (data || []).forEach(row => {
      const prices = (row.prices || []) as KaitorixPrice[];
      if (prices.length > 0) {
        discoverStores(prices.map(p => p.store));
      }
      map.set(row.jan, {
        jan: row.jan,
        productName: row.product_name || '',
        prices,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).getTime() : null,
        source: (row.last_fetch_source as KaitorixSource) || 'cache',
      });
    });
  }

  return map;
}
