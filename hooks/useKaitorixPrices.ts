import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { fetchBuybackPrices, getBestPrice, getFilteredPrices, type FetchProgress } from '@/lib/api/kaitorix';
import { loadKaitorixConfig } from '@/lib/kaitorix-config';

interface Transaction {
  id: string;
  jan_code?: string | null;
  purchase_price_total: number;
  quantity: number;
  expected_platform_points?: number | null;
  expected_card_points?: number | null;
  extra_platform_points?: number | null;
  quantity_sold: number;
}

export interface BuybackInfo {
  maxPrice: number;
  maxStore: string;
  expectedProfit: number;
  loading: boolean;
  allPrices?: Array<{ store: string; price: number; url: string }>;
  source?: 'cache' | 'stale' | 'pending'; // price data freshness
}

export interface KaitorixState {
  buybackMap: Map<string, BuybackInfo>;
  isLoading: boolean;
  progress: FetchProgress | null;
  enabled: boolean;
  refresh: (transactionsToFetch?: Transaction[]) => void;
  refreshMissing: () => void;
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
        map.set(id, {
          maxPrice: info.maxPrice,
          maxStore: info.maxStore,
          expectedProfit: info.expectedProfit,
          loading: false,
          allPrices: info.allPrices || [],
          source: info.source,
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
          const remainingQty = tx.quantity - (tx.quantity_sold ?? 0);
          const expectedProfit = (bestPrice.maxPrice - costPerUnit) * remainingQty;

          newMap.set(tx.id, {
            maxPrice: bestPrice.maxPrice,
            maxStore: bestPrice.maxStore,
            expectedProfit,
            loading: false,
            allPrices: getFilteredPrices(result ?? null, config.enabledStores),
            source: (result?._source as BuybackInfo['source']) ?? 'cache',
          });
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
  const abortRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const buybackMapRef = useRef(buybackMap);

  // Keep refs in sync
  useEffect(() => { buybackMapRef.current = buybackMap; }, [buybackMap]);

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
      .filter(t => t.quantity - (t.quantity_sold ?? 0) > 0 && t.jan_code)
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  return { buybackMap, isLoading, progress, enabled, refresh, refreshMissing, stop };
}
