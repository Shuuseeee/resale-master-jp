import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  fetchBuybackPrices,
  forceRefreshBuybackPrice,
  getBestPrice,
  getFilteredPrices,
  type FetchProgress,
  type KaitorixRateLimit,
} from '@/lib/api/kaitorix';
import { loadKaitorixConfig, isKaitorixPriceStale } from '@/lib/kaitorix-config';

interface Transaction {
  id: string;
  jan_code?: string | null;
  status?: string | null;
  purchase_price_total: number;
  quantity: number;
  quantity_in_stock?: number | null;
  expected_platform_points?: number | null;
  expected_card_points?: number | null;
  extra_platform_points?: number | null;
  quantity_sold: number;
  quantity_returned?: number | null;
}

export interface BuybackInfo {
  maxPrice: number;
  maxStore: string;
  expectedProfit: number;
  loading: boolean;
  allPrices?: Array<{ store: string; price: number; url: string }>;
  source?: 'cache' | 'stale' | 'pending'; // price data freshness
  fetchedAt?: number; // unix ms — when this data was fetched/cached
}

export interface KaitorixState {
  buybackMap: Map<string, BuybackInfo>;
  isLoading: boolean;
  progress: FetchProgress | null;
  enabled: boolean;
  forceRefreshingJan: string | null;
  rateLimit: KaitorixRateLimit | null;
  refresh: (transactionsToFetch?: Transaction[]) => void;
  refreshMissing: () => void;
  forceRefresh: (jan: string, transactionsToRefresh?: Transaction[]) => Promise<{ ok: boolean; error?: string; rateLimit?: KaitorixRateLimit }>;
  stop: () => void;
}

// Global cache stored in localStorage
const CACHE_KEY = 'kaitorix_buyback_cache';
const CACHE_VERSION = 1;

interface CachedBuybackInfo extends BuybackInfo {
  timestamp: number;
}

function loadCacheFromStorage(): Map<string, BuybackInfo> {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    if (parsed.version !== CACHE_VERSION) return new Map();

    const now = Date.now();
    const TTL = 30 * 60 * 1000; // 30 minutes — match server cache TTL

    const map = new Map<string, BuybackInfo>();
    Object.entries(parsed.data || {}).forEach(([id, info]: [string, any]) => {
      if (now - info.timestamp < TTL) {
        const fetchedAt = info.fetchedAt ?? info.timestamp;
        // 24h 过期：保留条目但将价格归零，让展示组件自动隐藏
        const stale = isKaitorixPriceStale(fetchedAt);
        map.set(id, {
          maxPrice: stale ? 0 : info.maxPrice,
          maxStore: stale ? '' : info.maxStore,
          expectedProfit: stale ? 0 : info.expectedProfit,
          loading: false,
          allPrices: stale ? [] : (info.allPrices || []),
          source: stale ? 'stale' : info.source,
          fetchedAt,
        });
      }
    });

    return map;
  } catch {
    return new Map();
  }
}

function saveCacheToStorage(map: Map<string, BuybackInfo>) {
  try {
    const data: Record<string, CachedBuybackInfo> = {};
    const now = Date.now();

    map.forEach((info, id) => {
      // timestamp = save time, used for TTL; fetchedAt = actual scrape time, preserved as-is
      data[id] = { ...info, timestamp: now };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, data }));
  } catch (error) {
    console.error('Failed to save KaitoriX cache:', error);
  }
}

// Shared fetch logic — builds janToTransactions map and runs fetchBuybackPrices
function runFetch(
  janToTransactions: Map<string, Transaction[]>,
  buybackMapRef: React.MutableRefObject<Map<string, BuybackInfo>>,
  config: { enabledStores: string[] },
  abortRef: React.MutableRefObject<AbortController | null>,
  isLoadingRef: React.MutableRefObject<boolean>,
  setIsLoading: (v: boolean) => void,
  setProgress: (p: FetchProgress) => void,
  setBuybackMap: (m: Map<string, BuybackInfo>) => void,
) {
  const uniqueJans = Array.from(janToTransactions.keys()).sort();
  if (uniqueJans.length === 0) return;

  abortRef.current?.abort();
  const abortController = new AbortController();
  abortRef.current = abortController;

  isLoadingRef.current = true;
  setIsLoading(true);
  setProgress({ completed: 0, total: uniqueJans.length, failed: 0, stopped: false });

  fetchBuybackPrices(
    uniqueJans,
    (p) => setProgress(p),
    abortController.signal,
  ).then(results => {
    const newMap = new Map(buybackMapRef.current);

    janToTransactions.forEach((txList, jan) => {
      const result = results.get(jan);
      const bestPrice = result ? getBestPrice(result, config.enabledStores) : null;

      txList.forEach(tx => {
        if (bestPrice) {
          const totalPoints = (tx.expected_platform_points ?? 0) +
            (tx.expected_card_points ?? 0) +
            (tx.extra_platform_points ?? 0);
          const costPerUnit = (tx.purchase_price_total - totalPoints) / tx.quantity;
          const remainingQty = tx.quantity_in_stock ??
            Math.max(0, tx.quantity - (tx.quantity_sold ?? 0) - (tx.quantity_returned ?? 0));
          const expectedProfit = (bestPrice.maxPrice - costPerUnit) * remainingQty;

          // fetchedAt: use server's _fetched_at for stale data so the UI shows correct age;
          // for fresh cache/new data use current time
          const fetchedAt = result?._source === 'stale' && result._fetched_at
            ? new Date(result._fetched_at).getTime()
            : Date.now();

          // 24h 过期：价格归零，展示组件自动隐藏
          if (isKaitorixPriceStale(fetchedAt)) {
            newMap.set(tx.id, {
              maxPrice: 0,
              maxStore: '',
              expectedProfit: 0,
              loading: false,
              allPrices: [],
              source: (result?._source as BuybackInfo['source']) ?? 'stale',
              fetchedAt,
            });
          } else {
            newMap.set(tx.id, {
              maxPrice: bestPrice.maxPrice,
              maxStore: bestPrice.maxStore,
              expectedProfit,
              loading: false,
              allPrices: getFilteredPrices(result ?? null, config.enabledStores),
              source: (result?._source as BuybackInfo['source']) ?? 'cache',
              fetchedAt,
            });
          }
        } else {
          newMap.set(tx.id, {
            maxPrice: 0,
            maxStore: '',
            expectedProfit: 0,
            loading: false,
            source: (result?._source as BuybackInfo['source']) ?? 'pending',
          });
        }
      });
    });

    setBuybackMap(newMap);
    isLoadingRef.current = false;
    setIsLoading(false);
  });
}

export function useKaitorixPrices(transactions: Transaction[]): KaitorixState {
  const [buybackMap, setBuybackMap] = useState<Map<string, BuybackInfo>>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [forceRefreshingJan, setForceRefreshingJan] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<KaitorixRateLimit | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const buybackMapRef = useRef(buybackMap);
  const forceRefreshingJanRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { buybackMapRef.current = buybackMap; }, [buybackMap]);
  useEffect(() => { forceRefreshingJanRef.current = forceRefreshingJan; }, [forceRefreshingJan]);

  // Read config once per render cycle (not per callback call)
  const config = useMemo(() => loadKaitorixConfig(), []);
  const enabled = config.enabled && config.enabledStores.length > 0;

  // Save to localStorage only when loading completes (not on every intermediate update)
  useEffect(() => {
    if (!isLoading && buybackMap.size > 0) {
      saveCacheToStorage(buybackMap);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build janToTransactions map from a list of transactions (only those with stock)
  const buildJanMap = useCallback((txList: Transaction[]) => {
    const map = new Map<string, Transaction[]>();
    txList
      .filter(t => {
        if (!t.jan_code) return false;
        if (t.status === 'sold' || t.status === 'returned') return false;
        const remainingQty = t.quantity_in_stock ??
          Math.max(0, t.quantity - (t.quantity_sold ?? 0) - (t.quantity_returned ?? 0));
        return remainingQty > 0;
      })
      .forEach(t => {
        const list = map.get(t.jan_code!) || [];
        list.push(t);
        map.set(t.jan_code!, list);
      });
    return map;
  }, []);

  // Full refresh — fetches all transactions in the provided list (or all transactions)
  const refresh = useCallback((transactionsToFetch?: Transaction[]) => {
    if (!enabled || isLoadingRef.current) return;
    const janToTransactions = buildJanMap(transactionsToFetch || transactions);
    runFetch(janToTransactions, buybackMapRef, config, abortRef, isLoadingRef, setIsLoading, setProgress, setBuybackMap);
  }, [enabled, transactions, config, buildJanMap]);

  // Partial refresh — only fetches transactions missing from current cache
  const refreshMissing = useCallback(() => {
    if (!enabled || isLoadingRef.current) return;
    const janToTransactions = buildJanMap(
      transactions.filter(t => {
        const cached = buybackMapRef.current.get(t.id);
        return !cached || cached.maxPrice === 0; // skip if already have price
      })
    );
    runFetch(janToTransactions, buybackMapRef, config, abortRef, isLoadingRef, setIsLoading, setProgress, setBuybackMap);
  }, [enabled, transactions, config, buildJanMap]);

  const forceRefresh = useCallback(async (jan: string, transactionsToRefresh?: Transaction[]) => {
    if (!enabled || forceRefreshingJanRef.current) {
      return { ok: false, error: 'Kaitorix 正在刷新中' };
    }

    const targetTransactions = (transactionsToRefresh || transactions).filter(t => t.jan_code === jan);
    if (targetTransactions.length === 0) {
      return { ok: false, error: '没有找到该 JAN 的交易' };
    }

    forceRefreshingJanRef.current = jan;
    setForceRefreshingJan(jan);

    const result = await forceRefreshBuybackPrice(jan);
    if (result.rateLimit) setRateLimit(result.rateLimit);

    if (!result.data) {
      forceRefreshingJanRef.current = null;
      setForceRefreshingJan(null);
      return { ok: false, error: result.error || '官方强刷失败', rateLimit: result.rateLimit };
    }

    const bestPrice = getBestPrice(result.data, config.enabledStores);
    const newMap = new Map(buybackMapRef.current);

    targetTransactions.forEach(tx => {
      const fetchedAt = result.data?._fetched_at ? new Date(result.data._fetched_at).getTime() : Date.now();
      if (bestPrice && !isKaitorixPriceStale(fetchedAt)) {
        const totalPoints = (tx.expected_platform_points ?? 0) +
          (tx.expected_card_points ?? 0) +
          (tx.extra_platform_points ?? 0);
        const costPerUnit = (tx.purchase_price_total - totalPoints) / tx.quantity;
        const remainingQty = tx.quantity_in_stock ??
          Math.max(0, tx.quantity - (tx.quantity_sold ?? 0) - (tx.quantity_returned ?? 0));
        const expectedProfit = (bestPrice.maxPrice - costPerUnit) * remainingQty;

        newMap.set(tx.id, {
          maxPrice: bestPrice.maxPrice,
          maxStore: bestPrice.maxStore,
          expectedProfit,
          loading: false,
          allPrices: getFilteredPrices(result.data, config.enabledStores),
          source: 'cache',
          fetchedAt,
        });
      } else {
        newMap.set(tx.id, {
          maxPrice: 0,
          maxStore: '',
          expectedProfit: 0,
          loading: false,
          source: 'pending',
          fetchedAt,
        });
      }
    });

    setBuybackMap(newMap);
    saveCacheToStorage(newMap);
    forceRefreshingJanRef.current = null;
    setForceRefreshingJan(null);
    return { ok: true, rateLimit: result.rateLimit };
  }, [enabled, transactions, config]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  return { buybackMap, isLoading, progress, enabled, forceRefreshingJan, rateLimit, refresh, refreshMissing, forceRefresh, stop };
}
