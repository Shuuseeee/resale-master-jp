// lib/kaitorix-price-history.ts
// 买取价历史的「只记变动」差分：把同步前后的店铺报价对比，只产出需要追加的历史行。纯函数模块。

export interface HistoryPriceInput {
  store: string;
  price: number;
  /** 该店报价的取得时间（ISO）；缺失时用调用方给的兜底时间 */
  updated_at?: string;
}

export interface PriceHistoryRow {
  jan: string;
  store: string;
  observed_at: string;
  /** null = 该店不再报价 */
  price: number | null;
}

/** 日本时间当天 0 点（ISO）。无取得时间的变动 / 下架标记用它，保证同一天重跑不产生重复行 */
export function jstDayStartIso(date: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return new Date(`${ymd}T00:00:00+09:00`).toISOString();
}

/**
 * 对比某个 JAN 同步前后的报价：
 * - 新增的店 / 价格与上次不同 → 记一行（价格变化前后相同、只是取得时间更新 → 不记）
 * - 上次有、这次没有的店 → 记一行 price = null（下架）
 * oldPrices 为 undefined 表示这个 JAN 是首次出现，所有报价都作为基线记下。
 */
export function diffPriceHistory(
  jan: string,
  oldPrices: ReadonlyArray<{ store: string; price: number }> | undefined,
  newPrices: ReadonlyArray<HistoryPriceInput>,
  fallbackObservedAt: string,
): PriceHistoryRow[] {
  const oldByStore = new Map<string, number>();
  for (const p of oldPrices ?? []) oldByStore.set(p.store, p.price);

  const rows: PriceHistoryRow[] = [];
  const seen = new Set<string>();
  for (const p of newPrices) {
    seen.add(p.store);
    if (oldByStore.get(p.store) === p.price) continue;
    rows.push({ jan, store: p.store, observed_at: p.updated_at ?? fallbackObservedAt, price: p.price });
  }
  for (const store of oldByStore.keys()) {
    if (!seen.has(store)) rows.push({ jan, store, observed_at: fallbackObservedAt, price: null });
  }
  return rows;
}
