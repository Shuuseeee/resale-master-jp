'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, getAvailableQty, getUnitCost } from '@/lib/financial/calculator';
import { button, card, heading, input, layout } from '@/lib/theme';
import { forceRefreshBuybackPrice, type KaitorixRateLimit } from '@/lib/api/kaitorix';
import type { KaitorixCachedPrice, KaitorixPriceCache, Transaction } from '@/types/database.types';
import { KAITORIX_STALE_MS } from '@/lib/kaitorix-config';

type FilterMode = 'all' | 'missing' | 'stale' | 'profitable' | 'loss';
type SortMode = 'stale' | 'expected_profit' | 'stock_value' | 'buyback_price' | 'name';

interface TransactionWithPlatform extends Transaction {
  purchase_platform?: { id: string; name: string } | null;
}

interface UsageInfo {
  usageDate: string;
  used: number;
  limit: number;
  remaining: number;
  reset: string | null;
  updatedAt: string | null;
}

interface JanSummary {
  jan: string;
  productName: string;
  transactions: TransactionWithPlatform[];
  cache: KaitorixPriceCache | null;
  totalStock: number;
  transactionCount: number;
  totalPurchasePrice: number;
  totalCostForStock: number;
  maxPrice: number;
  maxStore: string;
  expectedProfit: number;
  lastFetchedAt: string | null;
  source: 'official' | 'scraper' | 'cache' | 'missing' | 'pending';
  rawResponse: unknown;
  prices: KaitorixCachedPrice[];
  isStale: boolean;
}



function formatAge(dateString: string | null): string {
  if (!dateString) return '未获取';
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return '未知';
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function sourceLabel(source: JanSummary['source']): string {
  switch (source) {
    case 'official': return '官方 API';
    case 'scraper': return '爬虫';
    case 'cache': return '缓存';
    case 'pending': return '等待中';
    default: return '未获取';
  }
}

function buildSummaries(
  transactions: TransactionWithPlatform[],
  caches: KaitorixPriceCache[],
): JanSummary[] {
  const cacheMap = new Map(caches.map(c => [c.jan, c]));
  const janMap = new Map<string, TransactionWithPlatform[]>();

  transactions
    .filter(tx => tx.jan_code && tx.status !== 'sold' && tx.status !== 'returned' && getAvailableQty(tx) > 0)
    .forEach(tx => {
      const list = janMap.get(tx.jan_code!) || [];
      list.push(tx);
      janMap.set(tx.jan_code!, list);
    });

  return Array.from(janMap.entries()).map(([jan, txs]) => {
    const cache = cacheMap.get(jan) || null;
    const prices = cache?.prices || [];
    const best = prices.length > 0
      ? prices.reduce((max, current) => current.price > max.price ? current : max, prices[0])
      : null;

    const totalStock = txs.reduce((sum, tx) => sum + getAvailableQty(tx), 0);
    const totalPurchasePrice = txs.reduce((sum, tx) => sum + tx.purchase_price_total, 0);
    const totalCostForStock = txs.reduce((sum, tx) => sum + getUnitCost(tx) * getAvailableQty(tx), 0);
    const maxPrice = cache?.max_price || best?.price || 0;
    const maxStore = cache?.max_store || best?.store || '';
    const expectedProfit = maxPrice > 0 ? (maxPrice * totalStock) - totalCostForStock : 0;

    const isStale = !cache?.fetched_at ||
      Date.now() - new Date(cache.fetched_at).getTime() > KAITORIX_STALE_MS;

    return {
      jan,
      productName: cache?.product_name || txs[0]?.product_name || '未命名商品',
      transactions: txs,
      cache,
      totalStock,
      transactionCount: txs.length,
      totalPurchasePrice,
      totalCostForStock,
      maxPrice,
      maxStore,
      expectedProfit,
      lastFetchedAt: cache?.fetched_at || null,
      source: (cache?.last_fetch_source as JanSummary['source']) || (cache ? 'cache' : 'missing'),
      rawResponse: cache?.raw_response ?? (cache ? {
        jan: cache.jan,
        name: cache.product_name,
        max_price: cache.max_price,
        max_store: cache.max_store,
        prices: cache.prices,
        fetched_at: cache.fetched_at,
      } : null),
      prices,
      isStale,
    };
  });
}

export default function KaitorixPricesPage() {
  const [transactions, setTransactions] = useState<TransactionWithPlatform[]>([]);
  const [caches, setCaches] = useState<KaitorixPriceCache[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJan, setSelectedJan] = useState<string | null>(null);
  const [selectedJans, setSelectedJans] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('stale');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshingJan, setRefreshingJan] = useState<string | null>(null);
  const [batchRefreshing, setBatchRefreshing] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileSelectMode, setMobileSelectMode] = useState(false);

  const toggleMobileSelectMode = () => {
    setSelectedJans(new Set());
    setMobileSelectMode(v => !v);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: txData, error: txError }, { data: cacheData, error: cacheError }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, purchase_platform:purchase_platforms(id, name)')
          .order('date', { ascending: false }),
        supabase
          .from('kaitorix_price_cache')
          .select('*'),
      ]);

      if (txError) throw txError;
      if (cacheError) throw cacheError;
      setTransactions((txData || []) as TransactionWithPlatform[]);
      setCaches((cacheData || []) as KaitorixPriceCache[]);

      const usageRes = await fetch('/api/kaitorix/open-usage');
      if (usageRes.ok) setUsage(await usageRes.json());
    } catch (error) {
      console.error('加载买取价格数据失败:', error);
      setMessage('加载买取价格数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summaries = useMemo(() => buildSummaries(transactions, caches), [transactions, caches]);
  const selectedSummary = useMemo(
    () => summaries.find(item => item.jan === selectedJan) || null,
    [summaries, selectedJan],
  );

  const filteredSummaries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return summaries
      .filter(item => {
        if (term && !item.productName.toLowerCase().includes(term) && !item.jan.includes(term)) return false;
        if (filterMode === 'missing') return item.prices.length === 0;
        if (filterMode === 'stale') return item.isStale;
        if (filterMode === 'profitable') return !item.isStale && item.expectedProfit > 0;
        if (filterMode === 'loss') return !item.isStale && item.maxPrice > 0 && item.expectedProfit < 0;
        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'expected_profit') return b.expectedProfit - a.expectedProfit;
        if (sortMode === 'stock_value') return b.totalCostForStock - a.totalCostForStock;
        if (sortMode === 'buyback_price') return b.maxPrice - a.maxPrice;
        if (sortMode === 'name') return a.productName.localeCompare(b.productName, 'ja');
        const aTime = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0;
        const bTime = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [summaries, filterMode, searchTerm, sortMode]);

  const refreshOne = useCallback(async (jan: string) => {
    const target = summaries.find(item => item.jan === jan);
    const remainingText = usage ? `当前剩余 ${usage.remaining}/${usage.limit} 次` : '剩余次数暂未知';
    if (!confirm(`将消耗 1 次 Kaitorix 官方 API 配额。\n${remainingText}\n\n刷新 ${target?.productName || jan} 吗？`)) return false;

    setRefreshingJan(jan);
    const result = await forceRefreshBuybackPrice(jan);
    setRefreshingJan(null);

    if (!result.data) {
      alert(result.error || '官方强刷失败');
      return false;
    }

    await loadData();
    setMessage(result.rateLimit?.remaining == null ? '官方价格已刷新' : `官方价格已刷新，剩余 ${result.rateLimit.remaining} 次`);
    return true;
  }, [loadData, summaries, usage]);

  const batchRefresh = useCallback(async () => {
    const jans = Array.from(selectedJans);
    if (jans.length === 0) return;
    if (usage && usage.remaining < jans.length) {
      alert(`剩余额度不足：当前剩余 ${usage.remaining} 次，已选 ${jans.length} 个 JAN`);
      return;
    }
    if (!confirm(`将串行刷新 ${jans.length} 个 JAN，预计消耗 ${jans.length} 次官方 API 配额。确定继续吗？`)) return;

    setBatchRefreshing(true);
    let success = 0;
    for (const jan of jans) {
      setRefreshingJan(jan);
      const result = await forceRefreshBuybackPrice(jan);
      if (!result.data) {
        alert(result.error || `刷新 ${jan} 失败`);
        if (result.status === 429) break;
      } else {
        success++;
      }
    }
    setRefreshingJan(null);
    setBatchRefreshing(false);
    setSelectedJans(new Set());
    await loadData();
    setMessage(`批量强刷完成：成功 ${success}/${jans.length}`);
  }, [loadData, selectedJans, usage]);

  const toggleSelect = (jan: string) => {
    setSelectedJans(prev => {
      const next = new Set(prev);
      if (next.has(jan)) next.delete(jan); else next.add(jan);
      return next;
    });
  };

  const allVisibleSelected = filteredSummaries.length > 0 && filteredSummaries.every(item => selectedJans.has(item.jan));

  if (loading) {
    return (
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="text-[var(--color-text)]">加载买取价格数据...</div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={heading.h1}>买取价格比较</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">按 JAN 聚合库存商品，集中查看各店价格与官方 API 强刷</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usage && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                官方配额 <span className="font-semibold text-[var(--color-text)]">{usage.remaining}/{usage.limit}</span>
              </div>
            )}
            <button
              onClick={toggleMobileSelectMode}
              className={button.secondary + ' min-h-11 whitespace-nowrap px-4 lg:!hidden'}
            >
              {mobileSelectMode ? '取消' : '批量'}
            </button>
            <button
              onClick={batchRefresh}
              disabled={selectedJans.size === 0 || batchRefreshing}
              className={`${button.primary} min-h-11 whitespace-nowrap px-4 disabled:opacity-40 disabled:cursor-not-allowed ${mobileSelectMode ? '' : '!hidden lg:!inline-flex'}`}
            >
              {batchRefreshing ? '强刷中...' : `批量强刷${selectedJans.size ? ` (${selectedJans.size})` : ''}`}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary-light)] px-4 py-2 text-sm text-[var(--color-primary)]">
            {message}
          </div>
        )}

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索商品名或 JAN"
            className={input.base}
          />
          <select value={filterMode} onChange={e => setFilterMode(e.target.value as FilterMode)} className={input.base}>
            <option value="all">全部库存 JAN</option>
            <option value="missing">未获取价格</option>
            <option value="stale">缓存过旧</option>
            <option value="profitable">有利润</option>
            <option value="loss">亏损</option>
          </select>
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className={input.base}>
            <option value="stale">缓存最旧优先</option>
            <option value="expected_profit">预估利润最高</option>
            <option value="stock_value">库存金额最高</option>
            <option value="buyback_price">最高买取价</option>
            <option value="name">商品名</option>
          </select>
        </div>

        <div className={card.primary + ' overflow-hidden'}>
          <div className="hidden lg:grid grid-cols-[44px_1.8fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
            <button
              onClick={() => setSelectedJans(allVisibleSelected ? new Set() : new Set(filteredSummaries.map(item => item.jan)))}
              className="text-left"
            >
              选择
            </button>
            <div>商品</div>
            <div className="text-right">库存</div>
            <div className="text-right">仕入</div>
            <div className="text-right">最高价</div>
            <div className="text-right">预估利润</div>
            <div>刷新</div>
            <div className="text-right">操作</div>
          </div>

          {filteredSummaries.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">没有符合条件的库存 JAN</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filteredSummaries.map(item => (
                <div
                  key={item.jan}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[44px_1.8fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_120px] lg:items-center hover:bg-[var(--color-bg-subtle)]"
                >
                  <div className="flex items-start gap-3 lg:block">
                    <button
                      onClick={() => toggleSelect(item.jan)}
                      className={`h-11 w-11 -ml-2 items-center justify-center rounded-[var(--radius-md)] active:bg-[var(--color-bg-subtle)] lg:flex lg:h-5 lg:w-5 lg:ml-0 ${mobileSelectMode ? 'flex' : 'hidden'}`}
                      aria-label="选择 JAN"
                      role="checkbox"
                      aria-checked={selectedJans.has(item.jan)}
                    >
                      {selectedJans.has(item.jan) ? (
                        <CheckSquare className="h-5 w-5 text-[var(--color-primary)] lg:h-4 lg:w-4" strokeWidth={2.25} />
                      ) : (
                        <Square className="h-5 w-5 text-[var(--color-text-muted)] lg:h-4 lg:w-4" strokeWidth={2} />
                      )}
                    </button>
                    <div className="flex items-center gap-2 ml-auto lg:hidden">
                      <button
                        onClick={() => { setSelectedJan(item.jan); setRawOpen(false); }}
                        className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)] whitespace-nowrap"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => refreshOne(item.jan)}
                        disabled={refreshingJan === item.jan || batchRefreshing}
                        className="min-h-10 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] active:bg-[var(--color-primary-light)] disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
                      >
                        {refreshingJan === item.jan ? '强刷中' : '官方强刷'}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedJan(item.jan); setRawOpen(false); }} className="min-w-0 text-left">
                    <div className="font-semibold text-[var(--color-text)] line-clamp-2 break-cjk">{item.productName}</div>
                    <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{item.jan}</div>
                  </button>
                  <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] p-3 lg:contents">
                    <div className="text-sm text-[var(--color-text)] lg:text-right">
                      <span className="block text-xs text-[var(--color-text-muted)] lg:hidden">库存</span>{item.totalStock}
                      <span className="ml-1 text-xs text-[var(--color-text-muted)]">/ {item.transactionCount}笔</span>
                    </div>
                    <div className="font-mono text-sm text-[var(--color-text)] lg:text-right">
                      <span className="block font-sans text-xs text-[var(--color-text-muted)] lg:hidden">仕入</span>{formatCurrency(item.totalCostForStock)}
                    </div>
                    <div className={`font-mono text-sm lg:text-right ${item.isStale ? 'opacity-40' : ''}`}>
                      <span className="block font-sans text-xs text-[var(--color-text-muted)] lg:hidden">最高价</span>
                      {item.maxPrice > 0 ? formatCurrency(item.maxPrice) : '-'}
                      {item.isStale && item.maxPrice > 0 && <span className="ml-1 text-[10px] text-[var(--color-warning)]">过期</span>}
                      {!item.isStale && item.maxStore && <div className="text-xs text-[var(--color-primary)]">{item.maxStore}</div>}
                    </div>
                    <div className={`font-mono text-sm lg:text-right ${item.isStale ? 'opacity-40' : item.expectedProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      <span className="block font-sans text-xs text-[var(--color-text-muted)] lg:hidden">预估利润</span>
                      {item.isStale ? '-' : item.maxPrice > 0 ? formatCurrency(item.expectedProfit) : '-'}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] p-3 text-xs text-[var(--color-text-muted)] lg:bg-transparent lg:p-0">
                    <span className="block text-xs text-[var(--color-text-muted)] lg:hidden">刷新</span>
                    <div className="text-[var(--color-text)] lg:text-[var(--color-text-muted)]">{formatAge(item.lastFetchedAt)}</div>
                    <div>{sourceLabel(item.source)}</div>
                  </div>
                  <div className="hidden items-center justify-end gap-2 lg:flex">
                    <button onClick={() => { setSelectedJan(item.jan); setRawOpen(false); }} className="min-h-9 px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] rounded whitespace-nowrap">详情</button>
                    <button
                      onClick={() => refreshOne(item.jan)}
                      disabled={refreshingJan === item.jan || batchRefreshing}
                      className="min-h-9 px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
                    >
                      {refreshingJan === item.jan ? '强刷中' : '官方强刷'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSummary && (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/40" onClick={() => setSelectedJan(null)}>
          <aside
            className="h-full w-full max-w-3xl overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[var(--color-text)] break-cjk">{selectedSummary.productName}</h2>
                  <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{selectedSummary.jan}</p>
                </div>
                <button onClick={() => setSelectedJan(null)} className="min-h-11 rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] whitespace-nowrap">关闭</button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div><div className="text-xs text-[var(--color-text-muted)]">库存</div><div className="font-semibold text-[var(--color-text)]">{selectedSummary.totalStock}</div></div>
                <div><div className="text-xs text-[var(--color-text-muted)]">最高价</div><div className="font-mono font-semibold text-[var(--color-text)]">{selectedSummary.maxPrice > 0 ? formatCurrency(selectedSummary.maxPrice) : '-'}</div></div>
                <div><div className="text-xs text-[var(--color-text-muted)]">预估利润</div><div className={`font-mono font-semibold ${selectedSummary.expectedProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{selectedSummary.maxPrice > 0 ? formatCurrency(selectedSummary.expectedProfit) : '-'}</div></div>
                <div><div className="text-xs text-[var(--color-text-muted)]">刷新</div><div className="font-semibold text-[var(--color-text)]">{formatAge(selectedSummary.lastFetchedAt)}</div></div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <section className={card.primary + ' overflow-hidden'}>
                <div className="border-b border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-text)]">店铺价格</div>
                {selectedSummary.prices.length === 0 ? (
                  <div className="p-6 text-sm text-[var(--color-text-muted)]">暂无价格数据</div>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {selectedSummary.prices
                      .slice()
                      .sort((a, b) => b.price - a.price)
                      .map((price, index) => {
                        const diff = selectedSummary.maxPrice - price.price;
                        return (
                          <div key={`${price.store}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div className="min-w-0">
                              {price.url ? (
                                <a href={price.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-primary)] hover:underline">{price.store}</a>
                              ) : (
                                <span className="font-semibold text-[var(--color-text)]">{price.store}</span>
                              )}
                              <div className="text-xs text-[var(--color-text-muted)]">{price.updated || '更新时间不明'}</div>
                            </div>
                            <div className="font-mono font-semibold text-[var(--color-text)]">{formatCurrency(price.price)}</div>
                            <div className={diff === 0 ? 'col-span-2 text-xs text-[var(--color-success)] sm:col-span-1' : 'col-span-2 text-xs text-[var(--color-text-muted)] sm:col-span-1'}>
                              {diff === 0 ? '最高' : `-${formatCurrency(diff)}`}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              <section className={card.primary + ' overflow-hidden'}>
                <div className="border-b border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-text)]">关联交易</div>
                <div className="divide-y divide-[var(--color-border)]">
                  {selectedSummary.transactions.map(tx => {
                    const stock = getAvailableQty(tx);
                    const unitCost = getUnitCost(tx);
                    const profit = selectedSummary.maxPrice > 0 ? (selectedSummary.maxPrice - unitCost) * stock : 0;
                    return (
                      <Link key={tx.id} href={`/transactions/${tx.id}`} className="grid gap-2 px-4 py-3 text-sm hover:bg-[var(--color-bg-subtle)] md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                        <div>
                          <div className="font-medium text-[var(--color-text)]">{new Date(tx.date).toLocaleDateString('ja-JP')}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{tx.purchase_platform?.name || '采购渠道未设置'}</div>
                        </div>
                        <div className="font-mono text-[var(--color-text)]">库存 {stock}/{tx.quantity}</div>
                        <div className="font-mono text-[var(--color-text)]">{formatCurrency(unitCost)}</div>
                        <div className={`font-mono ${profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{selectedSummary.maxPrice > 0 ? formatCurrency(profit) : '-'}</div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section className={card.primary + ' overflow-hidden'}>
                <button
                  onClick={() => setRawOpen(v => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-[var(--color-text)]"
                >
                  原始响应
                  <span className="text-sm text-[var(--color-text-muted)]">{rawOpen ? '收起' : '展开'}</span>
                </button>
                {rawOpen && (
                  <pre className="max-h-96 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-xs text-[var(--color-text)]">
                    {JSON.stringify(selectedSummary.rawResponse, null, 2)}
                  </pre>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
