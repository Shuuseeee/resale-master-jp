import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchBuybackPrices, getBestPrice, type FetchProgress } from '@/lib/api/kaitorix';
import { loadKaitorixConfig } from '@/lib/kaitorix-config';

interface Transaction {
  id: string;
  jan_code?: string | null;
  unit_price?: number | null;
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
}

export interface KaitorixState {
  buybackMap: Map<string, BuybackInfo>;
  isLoading: boolean;
  progress: FetchProgress | null;
  enabled: boolean;
  refresh: (transactionsToFetch?: Transaction[]) => void;
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
    const TTL = 60 * 60 * 1000; // 1 hour

    const map = new Map<string, BuybackInfo>();
    Object.entries(parsed.data || {}).forEach(([id, info]: [string, any]) => {
      // Check if cache is still valid
      if (now - info.timestamp < TTL) {
        map.set(id, {
          maxPrice: info.maxPrice,
          maxStore: info.maxStore,
          expectedProfit: info.expectedProfit,
          loading: false,
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
      data[id] = {
        ...info,
        timestamp: now,
      };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      data,
    }));
  } catch (error) {
    console.error('Failed to save KaitoriX cache:', error);
  }
}

export function useKaitorixPrices(transactions: Transaction[]): KaitorixState {
  const [buybackMap, setBuybackMap] = useState<Map<string, BuybackInfo>>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const config = loadKaitorixConfig();
  const enabled = config.enabled && config.enabledStores.length > 0;

  // Save to localStorage whenever buybackMap changes
  useEffect(() => {
    if (buybackMap.size > 0) {
      saveCacheToStorage(buybackMap);
    }
  }, [buybackMap]);

  const refresh = useCallback((transactionsToFetch?: Transaction[]) => {
    if (!enabled || isLoading) return;

    // Use provided transactions or fall back to all transactions
    const targetTransactions = transactionsToFetch || transactions;

    // Filter out transactions with no remaining stock (fully sold)
    const transactionsWithStock = targetTransactions.filter(t => {
      const remaining = t.quantity - (t.quantity_sold ?? 0);
      return remaining > 0;
    });

    // Collect unique JAN codes from target transactions
    const janToTransactions = new Map<string, Transaction[]>();
    transactionsWithStock.forEach(t => {
      if (t.jan_code) {
        const list = janToTransactions.get(t.jan_code) || [];
        list.push(t);
        janToTransactions.set(t.jan_code, list);
      }
    });

    const uniqueJans = Array.from(janToTransactions.keys()).sort();
    if (uniqueJans.length === 0) return;

    // Abort previous request
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    setIsLoading(true);
    setProgress({ completed: 0, total: uniqueJans.length, failed: 0, stopped: false });

    fetchBuybackPrices(
      uniqueJans,
      (p) => setProgress(p),
      abortController.signal,
    ).then(results => {
      const newMap = new Map(buybackMap); // Start with existing cache

      janToTransactions.forEach((txList, jan) => {
        const result = results.get(jan);
        const bestPrice = result
          ? getBestPrice(result, config.enabledStores)
          : null;

        txList.forEach(tx => {
          if (bestPrice) {
            const costPerUnit =
              tx.unit_price ?? tx.purchase_price_total / tx.quantity;

            const pointsPerUnit = (
              (tx.expected_platform_points ?? 0) +
              (tx.expected_card_points ?? 0) +
              (tx.extra_platform_points ?? 0)
            ) / tx.quantity;

            const remainingQty = tx.quantity - (tx.quantity_sold ?? 0);
            const expectedProfit = (bestPrice.maxPrice - costPerUnit + pointsPerUnit) * remainingQty;


            newMap.set(tx.id, {
              maxPrice: bestPrice.maxPrice,
              maxStore: bestPrice.maxStore,
              expectedProfit,
              loading: false,
            });
          } else {
            newMap.set(tx.id, {
              maxPrice: 0,
              maxStore: '',
              expectedProfit: 0,
              loading: false,
            });
          }
        });
      });

      setBuybackMap(newMap);
      setIsLoading(false);
    });
  }, [enabled, isLoading, transactions, config.enabledStores, buybackMap]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { buybackMap, isLoading, progress, enabled, refresh, stop };
}
