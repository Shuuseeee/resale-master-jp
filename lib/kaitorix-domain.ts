// lib/kaitorix-domain.ts
// Kaitorix 买取价格领域逻辑：最高价（含并列）、店铺过滤、利润、JAN 聚合。
// 纯函数模块，比价中心页面与交易页比价链路共用，避免逻辑分叉。

import { getAvailableQty, getUnitCost } from '@/lib/financial/calculator';

/** 单条店铺报价。统一 KaitorixPrice / KaitorixCachedPrice / allPrices 项的结构 */
export interface KaitorixPriceEntry {
  store: string;
  price: number;
  url: string;
  updated?: string;
}

/** 价格数据来源：official/scraper/cache 来自 DB 缓存表，stale/pending 来自 API 路由语义 */
export type KaitorixSource = 'official' | 'scraper' | 'cache' | 'stale' | 'pending';

/** 单个 JAN 的原始价格数据 —— 共享数据层的规范形态（不过滤店铺、不归零） */
export interface JanPriceData {
  jan: string;
  productName: string;
  prices: KaitorixPriceEntry[];
  /** 实际抓取时间（unix ms）；未知 / 尚无数据为 null */
  fetchedAt: number | null;
  source: KaitorixSource;
}

/** 含买取相关字段的交易（结构化子集，Transaction / TransactionForCompare 均满足） */
export interface TransactionBuybackFields {
  id: string;
  jan_code?: string | null;
  status?: string | null;
  purchase_price_total: number;
  quantity: number;
  quantity_in_stock?: number | null;
  quantity_sold?: number | null;
  quantity_returned?: number | null;
  expected_platform_points?: number | null;
  expected_card_points?: number | null;
  extra_platform_points?: number | null;
}

/**
 * 并列感知的最高价：返回最高价及所有并列最高的报价条目。
 * 空数组 → { maxPrice: 0, entries: [] }。
 */
export function getMaxEntries<T extends { price: number }>(
  prices: T[] | null | undefined
): { maxPrice: number; entries: T[] } {
  if (!prices?.length) return { maxPrice: 0, entries: [] };
  let maxPrice = prices[0].price;
  for (const p of prices) {
    if (p.price > maxPrice) maxPrice = p.price;
  }
  return { maxPrice, entries: prices.filter(p => p.price === maxPrice) };
}

/**
 * 单一代表店：并列最高时取数组中靠前者（与历史 reduce 严格 > 语义一致）。
 * 需要全部并列店时用 getMaxEntries。
 */
export function getBestEntry<T extends { price: number }>(
  prices: T[] | null | undefined
): T | null {
  return getMaxEntries(prices).entries[0] ?? null;
}

/** 按启用店铺名过滤报价 */
export function filterPricesByStores<T extends { store: string }>(
  prices: T[] | null | undefined,
  storeNames: string[]
): T[] {
  if (!prices?.length) return [];
  const enabledSet = new Set(storeNames);
  return prices.filter(p => enabledSet.has(p.store));
}

/** 单笔交易按某买取价的预估利润：(价格 − 单件成本) × 可用库存 */
export function expectedProfitForTx(
  price: number,
  tx: Omit<TransactionBuybackFields, 'id' | 'jan_code' | 'status'>
): number {
  return (price - getUnitCost(tx)) * getAvailableQty(tx);
}

/** 是否纳入买取价格跟踪：有 JAN、未售罄/退货、仍有可用库存 */
export function isBuybackTrackable(tx: TransactionBuybackFields): boolean {
  if (!tx.jan_code) return false;
  if (tx.status === 'sold' || tx.status === 'returned') return false;
  return getAvailableQty(tx) > 0;
}

/** 将可跟踪的交易按 JAN 聚合 */
export function groupTransactionsByJan<T extends TransactionBuybackFields>(
  transactions: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  transactions.filter(isBuybackTrackable).forEach(tx => {
    const list = map.get(tx.jan_code!) || [];
    list.push(tx);
    map.set(tx.jan_code!, list);
  });
  return map;
}
