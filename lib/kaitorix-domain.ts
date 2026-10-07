// lib/kaitorix-domain.ts
// Kaitorix 买取价格领域逻辑：最高价（含并列）、店铺过滤、利润、JAN 聚合。
// 纯函数模块，比价中心页面与交易页比价链路共用，避免逻辑分叉。

import { getAvailableQty, getUnitCost } from '@/lib/financial/calculator';
import { KAITORIX_REFERENCE_MAX_AGE_MS } from '@/lib/kaitorix-config';

/** 单条店铺报价。统一 KaitorixPrice / KaitorixCachedPrice / allPrices 项的结构 */
export interface KaitorixPriceEntry {
  store: string;
  price: number;
  url: string;
  /** 店铺报价的相对更新时间文本（"8分前" / "3時間前" / "2日前"），相对于抓取时刻 */
  updated?: string;
  /** 精确更新时间（ISO 字符串）；有则优先于 updated */
  updated_at?: string;
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

const RELATIVE_AGE_UNIT_MS: Array<[string, number]> = [
  ['分', 60_000],
  ['時間', 3_600_000],
  ['日', 86_400_000],
  ['週間', 7 * 86_400_000],
  ['ヶ月', 30 * 86_400_000],
  ['か月', 30 * 86_400_000],
  ['カ月', 30 * 86_400_000],
];

/** "8分前" / "3時間前" / "2日前" → 毫秒；无法解析返回 null */
export function parseRelativeAgeMs(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(分|時間|日|週間|ヶ月|か月|カ月)\s*前/);
  if (!m) return null;
  const unit = RELATIVE_AGE_UNIT_MS.find(([u]) => u === m[2]);
  return unit ? Number(m[1]) * unit[1] : null;
}

/** 一条报价的更新时刻（unix ms）：updated_at 优先，其次「抓取时刻 − 相对时间」；无法确定返回 null */
export function getPriceUpdatedAt(
  entry: { updated?: string; updated_at?: string },
  fetchedAt: number | null | undefined,
  now: number = Date.now()
): number | null {
  if (entry.updated_at) {
    const t = Date.parse(entry.updated_at);
    if (!Number.isNaN(t)) return t;
  }
  const age = parseRelativeAgeMs(entry.updated);
  if (age == null) return null;
  return (fetchedAt ?? now) - age;
}

/** 该报价是否仍可作为参考：更新时间未超过 7 天；时间无法确定时按可参考处理 */
export function isPriceReferenceable(
  entry: { updated?: string; updated_at?: string },
  fetchedAt: number | null | undefined,
  now: number = Date.now()
): boolean {
  const updatedAt = getPriceUpdatedAt(entry, fetchedAt, now);
  return updatedAt == null || now - updatedAt <= KAITORIX_REFERENCE_MAX_AGE_MS;
}

/** 剔除更新时间超过 7 天的店铺报价；最高价 / 利润等一律基于它的结果重新计算 */
export function getReferencePrices<T extends { updated?: string; updated_at?: string }>(
  prices: T[] | null | undefined,
  fetchedAt: number | null | undefined,
  now: number = Date.now()
): T[] {
  if (!prices?.length) return [];
  return prices.filter(p => isPriceReferenceable(p, fetchedAt, now));
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
