import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  fetchBuybackPrices,
  fetchCachedPricesBulk,
  forceRefreshBuybackPrice,
  type FetchProgress,
  type KaitorixRateLimit,
  type KaitorixResponse,
} from '@/lib/api/kaitorix';
import { loadKaitorixConfig, isKaitorixPriceStale } from '@/lib/kaitorix-config';
import {
  expectedProfitForTx,
  filterPricesByStores,
  getBestEntry,
  groupTransactionsByJan,
  type JanPriceData,
  type TransactionBuybackFields,
} from '@/lib/kaitorix-domain';

type Transaction = TransactionBuybackFields;

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
  /** JAN 键控的原始价格数据（不过滤店铺、不归零），供 JAN 级消费方（如比价中心）使用 */
  janPriceMap: Map<string, JanPriceData>;
  isLoading: boolean;
  progress: FetchProgress | null;
  enabled: boolean;
  forceRefreshingJan: string | null;
  rateLimit: KaitorixRateLimit | null;
  refresh: (transactionsToFetch?: Transaction[]) => void;
  refreshMissing: () => void;
  forceRefresh: (jan: string) => Promise<{ ok: boolean; error?: string; rateLimit?: KaitorixRateLimit }>;
  stop: () => void;
}

// Global cache stored in localStorage — JAN 键控原始数据
// v1 为 txId 键控的派生数据，升级后自动失效（仅 30 分钟缓存，无迁移成本）
const CACHE_KEY = 'kaitorix_buyback_cache';
const CACHE_VERSION = 2;
const STORAGE_TTL = 30 * 60 * 1000; // 30 minutes — match server cache TTL

// 服务端 /api/kaitorix/[jan] 的缓存节奏：超过该时长的 JAN 走 API 以触发补抓入队
const SERVER_CACHE_TTL = 30 * 60 * 1000;

function loadCacheFromStorage(): Map<string, JanPriceData> {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    if (parsed.version !== CACHE_VERSION) return new Map();

    const now = Date.now();
    const map = new Map<string, JanPriceData>();
    Object.entries(parsed.data || {}).forEach(([jan, entry]: [string, any]) => {
      if (now - entry.timestamp < STORAGE_TTL) {
        map.set(jan, {
          jan,
          productName: entry.productName || '',
          prices: entry.prices || [],
          fetchedAt: entry.fetchedAt ?? null,
          source: entry.source || 'cache',
        });
      }
    });

    return map;
  } catch {
    return new Map();
  }
}

function saveCacheToStorage(map: Map<string, JanPriceData>) {
  try {
    const data: Record<string, JanPriceData & { timestamp: number }> = {};
    const now = Date.now();

    map.forEach((info, jan) => {
      // timestamp = save time, used for TTL; fetchedAt = actual scrape time, preserved as-is
      data[jan] = { ...info, timestamp: now };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, data }));
  } catch (error) {
    console.error('Failed to save KaitoriX cache:', error);
  }
}

// /api/kaitorix/[jan] 响应 → JanPriceData
function janDataFromResponse(jan: string, r: KaitorixResponse | null): JanPriceData {
  if (!r) {
    return { jan, productName: '', prices: [], fetchedAt: null, source: 'pending' };
  }
  // 服务端仅对 stale 返回 _fetched_at；fresh cache 用当前时间近似（误差 < 30 分钟）
  const fetchedAt = r._source === 'stale' && r._fetched_at
    ? new Date(r._fetched_at).getTime()
    : r.prices?.length ? Date.now() : null;
  return {
    jan,
    productName: r.name || '',
    prices: r.prices || [],
    fetchedAt,
    source: (r._source as JanPriceData['source']) || 'cache',
  };
}

export function useKaitorixPrices(transactions: Transaction[]): KaitorixState {
  const [janPriceMap, setJanPriceMap] = useState<Map<string, JanPriceData>>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [forceRefreshingJan, setForceRefreshingJan] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<KaitorixRateLimit | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const janPriceMapRef = useRef(janPriceMap);
  const forceRefreshingJanRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { janPriceMapRef.current = janPriceMap; }, [janPriceMap]);
  useEffect(() => { forceRefreshingJanRef.current = forceRefreshingJan; }, [forceRefreshingJan]);

  // Read config once per render cycle (not per callback call)
  const config = useMemo(() => loadKaitorixConfig(), []);
  const enabled = config.enabled && config.enabledStores.length > 0;

  // 派生 buybackMap：基于原始 JAN 数据 + 当前交易 + 店铺配置即时计算。
  // 过期归零、店铺过滤、利润都在这里发生，保证所有消费方口径一致。
  const buybackMap = useMemo(() => {
    const map = new Map<string, BuybackInfo>();
    if (janPriceMap.size === 0) return map;

    groupTransactionsByJan(transactions).forEach((txs, jan) => {
      const data = janPriceMap.get(jan);
      if (!data) return;

      // 24h 过期：价格归零，展示组件自动隐藏
      const stale24h = isKaitorixPriceStale(data.fetchedAt ?? undefined);
      const filtered = stale24h ? [] : filterPricesByStores(data.prices, config.enabledStores);
      const best = getBestEntry(filtered);
      const fetchedAt = data.fetchedAt ?? undefined;
      // 'stale'（>30 分钟）驱动行内的取得时刻标注；与 24h 归零是两个阈值
      const ageSource: BuybackInfo['source'] = stale24h ? 'stale'
        : data.prices.length === 0 ? 'pending'
        : data.fetchedAt != null && Date.now() - data.fetchedAt <= SERVER_CACHE_TTL ? 'cache'
        : 'stale';

      txs.forEach(tx => {
        if (!best) {
          map.set(tx.id, {
            maxPrice: 0,
            maxStore: '',
            expectedProfit: 0,
            loading: false,
            allPrices: [],
            source: ageSource,
            fetchedAt,
          });
        } else {
          map.set(tx.id, {
            maxPrice: best.price,
            maxStore: best.store,
            expectedProfit: expectedProfitForTx(best.price, tx),
            loading: false,
            allPrices: filtered.map(p => ({ store: p.store, price: p.price, url: p.url })),
            source: ageSource,
            fetchedAt,
          });
        }
      });
    });

    return map;
  }, [janPriceMap, transactions, config]);

  // 共享刷新流程：① bulk 一次性读 DB 缓存（始终可用，含禁用功能时的只读展示）
  // ② 仅对缺失或超过服务端缓存节奏（30 分钟）的 JAN 走 /api/kaitorix/[jan]，保留补抓入队副作用
  const doRefresh = useCallback(async (jans: string[]) => {
    if (jans.length === 0 || isLoadingRef.current) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    isLoadingRef.current = true;
    setIsLoading(true);
    setProgress(null);

    try {
      const cached = await fetchCachedPricesBulk(jans);
      let merged = new Map(janPriceMapRef.current);
      cached.forEach((data, jan) => merged.set(jan, data));
      setJanPriceMap(merged);

      const needy = enabled
        ? jans.filter(jan => {
            const data = merged.get(jan);
            return !data || data.fetchedAt == null || Date.now() - data.fetchedAt > SERVER_CACHE_TTL;
          })
        : [];

      if (needy.length > 0 && !abortController.signal.aborted) {
        setProgress({ completed: 0, total: needy.length, failed: 0, stopped: false });
        const results = await fetchBuybackPrices(needy, setProgress, abortController.signal);

        merged = new Map(janPriceMapRef.current);
        needy.forEach(jan => {
          const r = results.get(jan);
          // 请求失败（null）时保留 bulk 阶段已取得的数据
          if (r) {
            merged.set(jan, janDataFromResponse(jan, r));
          } else if (!merged.has(jan)) {
            merged.set(jan, janDataFromResponse(jan, null));
          }
        });
        setJanPriceMap(merged);
      }

      saveCacheToStorage(merged);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [enabled]);

  // Full refresh — fetches all transactions in the provided list (or all transactions)
  const refresh = useCallback((transactionsToFetch?: Transaction[]) => {
    if (isLoadingRef.current) return;
    const janMap = groupTransactionsByJan(transactionsToFetch || transactions);
    void doRefresh(Array.from(janMap.keys()).sort());
  }, [transactions, doRefresh]);

  // Partial refresh — only fetches JANs missing a usable price from current data
  const refreshMissing = useCallback(() => {
    if (isLoadingRef.current) return;
    const janMap = groupTransactionsByJan(transactions);
    const jans = Array.from(janMap.keys())
      .filter(jan => {
        const data = janPriceMapRef.current.get(jan);
        if (!data) return true;
        if (isKaitorixPriceStale(data.fetchedAt ?? undefined)) return true;
        return !getBestEntry(filterPricesByStores(data.prices, config.enabledStores));
      })
      .sort();
    void doRefresh(jans);
  }, [transactions, config, doRefresh]);

  // 官方强刷：更新单个 JAN 条目，派生层自动传播到所有关联交易。
  // 手动显式操作，不受 enabled 开关限制（开关只控制自动抓取）。
  const forceRefresh = useCallback(async (jan: string) => {
    if (forceRefreshingJanRef.current) {
      return { ok: false, error: 'Kaitorix 正在刷新中' };
    }

    forceRefreshingJanRef.current = jan;
    setForceRefreshingJan(jan);

    try {
      const result = await forceRefreshBuybackPrice(jan);
      if (result.rateLimit) setRateLimit(result.rateLimit);

      if (!result.data) {
        return { ok: false, error: result.error || '官方强刷失败', rateLimit: result.rateLimit };
      }

      const newMap = new Map(janPriceMapRef.current);
      newMap.set(jan, {
        jan,
        productName: result.data.name || '',
        prices: result.data.prices || [],
        fetchedAt: result.data._fetched_at ? new Date(result.data._fetched_at).getTime() : Date.now(),
        source: 'official',
      });
      setJanPriceMap(newMap);
      saveCacheToStorage(newMap);
      return { ok: true, rateLimit: result.rateLimit };
    } finally {
      forceRefreshingJanRef.current = null;
      setForceRefreshingJan(null);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  return { buybackMap, janPriceMap, isLoading, progress, enabled, forceRefreshingJan, rateLimit, refresh, refreshMissing, forceRefresh, stop };
}
