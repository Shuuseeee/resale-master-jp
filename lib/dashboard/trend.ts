// lib/dashboard/trend.ts — 损益走势（复刻买取X ProfitTrendChart 的计算）
// 按天建数组：
//   持有数：到货日 +数量，出售 / 退货日 −数量（includePending = 未到货也算持有，按进货日计入）
//   预估利润 = Σ 持有数 ×（当天最高买取价 − 单位成本）；库存估值 = Σ 持有数 × 当天最高买取价
//   确定利润：出售日累计「售价 × 数量 − 扣除 − 成本增量」，退货日减损失额，经费日减金额
//   利润（含预估）= 确定 + 预估（卖出时预估转成确定，线不往下掉）
// 当天最高买取价来自 kaitorix_price_history（每日同步只记变动，2026-10-08 起）：
//   某 JAN 第一次有记录之前的日子用第一次的价格，没有任何记录的用当前价；最后一天一律用当前价（与买取X 一致）。
// 走势不受页面筛选影响，始终统计全部进货。

import type { DashboardData, DashPurchase } from './data';
import { holdingUnitCost } from './summary';

const DAY_MS = 86_400_000;

function utc(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function dateAt(start: number, i: number): string {
  return new Date(start + i * DAY_MS).toISOString().slice(0, 10);
}

function dayIndex(start: number, date: string): number {
  return Math.round((utc(date) - start) / DAY_MS);
}

function clamp(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/** 稀疏的 [日序号, 价格]（升序）→ 每天的价格；第一个点之前用第一个点的价格 */
function fillDaily(points: [number, number][], n: number): Float64Array {
  const out = new Float64Array(n);
  let price = points.length ? points[0][1] : 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    while (k < points.length && points[k][0] <= i) price = points[k++][1];
    out[i] = price;
  }
  return out;
}

function cumulative(deltas: Float64Array): Float64Array {
  const out = new Float64Array(deltas.length);
  let sum = 0;
  for (let i = 0; i < deltas.length; i++) out[i] = sum += deltas[i];
  return out;
}

/** 一笔进货每天持有数的增减 [日序号, 变化量] */
function holdingDeltas(p: DashPurchase, includePending: boolean, start: number, n: number): [number, number][] {
  const qty = p.quantity || 1;
  const idx = (date: string) => clamp(dayIndex(start, date), n);
  if (!includePending && p.status === 'pending') return [];
  const arrivals: [number, number][] = [[idx(p.date), qty]];
  const first = arrivals[0][0];
  const outs: [number, number][] = [
    ...p.sales.map(s => [Math.max(idx(s.date), first), -s.qty] as [number, number]),
    ...p.returns.map(r => [Math.max(idx(r.date), first), -r.qty] as [number, number]),
  ].filter(([, q]) => q);
  const events = [...arrivals, ...outs].sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  let held = 0;
  let debt = 0;
  const out: [number, number][] = [];
  for (const [day, change] of events) {
    let c = change;
    if (c > 0 && debt > 0) {
      const used = Math.min(c, debt);
      c -= used;
      debt -= used;
    }
    let next = held + c;
    if (next < 0) {
      debt += -next;
      next = 0;
    }
    if (next > qty) next = qty;
    if (next !== held) out.push([day, next - held]);
    held = next;
  }
  return out;
}

/** 每个 JAN 的每日最高买取价变化点 [日序号, 最高价]（按勾选店铺过滤） */
function dailyMaxSeries(
  data: DashboardData,
  enabledStores: ReadonlySet<string> | null,
  start: number,
  n: number,
): Map<string, [number, number][]> {
  const byJan = new Map<string, { date: string; store: string; price: number | null }[]>();
  for (const h of data.priceHistory) {
    if (enabledStores && !enabledStores.has(h.store)) continue;
    (byJan.get(h.jan) ?? byJan.set(h.jan, []).get(h.jan)!).push(h);
  }
  const series = new Map<string, [number, number][]>();
  for (const [jan, changes] of byJan) {
    const current = new Map<string, number>();
    const points: [number, number][] = [];
    for (let k = 0; k < changes.length; k++) {
      const c = changes[k];
      if (c.price == null) current.delete(c.store);
      else current.set(c.store, c.price);
      if (k + 1 < changes.length && changes[k + 1].date === c.date) continue;
      const max = current.size ? Math.max(...current.values()) : 0;
      const day = clamp(dayIndex(start, c.date), n);
      if (points.length && points[points.length - 1][0] === day) points[points.length - 1][1] = max;
      else if (!points.length || points[points.length - 1][1] !== max) points.push([day, max]);
    }
    if (points.length) series.set(jan, points);
  }
  return series;
}

export interface TrendSeries {
  dates: string[];
  /** 利润（含预估） */
  total: Float64Array;
  /** 确定利润 */
  realized: Float64Array;
  /** 预估利润 */
  unrealized: Float64Array;
  /** 库存估值 */
  value: Float64Array;
  /** 有报价的持有部分的成本 */
  cost: Float64Array;
  heldQty: Float64Array;
  pricedQty: Float64Array;
  n: number;
}

export function buildTrend(
  data: DashboardData,
  best: Map<string, { price: number }>,
  enabledStores: ReadonlySet<string> | null,
  today: string,
  includePending: boolean,
): TrendSeries | null {
  if (!data.purchases.length) return null;
  const earliest = data.purchases.reduce((min, p) => (p.date < min ? p.date : min), today);
  const start = utc(earliest);
  const n = dayIndex(start, today) + 1;
  if (n <= 1) return null;

  const heldByJan = new Map<string, Float64Array>();
  const costByJan = new Map<string, Float64Array>();
  const heldDelta = new Float64Array(n);
  const realizedDelta = new Float64Array(n);

  for (const p of data.purchases) {
    const qty = p.quantity || 1;
    const holdingCost = holdingUnitCost(p);
    const exactCost = (p.unitPrice * qty + p.shippingFee - p.pointsEarned) / qty;
    const deltas = holdingDeltas(p, includePending, start, n);
    if (deltas.length) {
      let held: Float64Array | undefined;
      let cost: Float64Array | undefined;
      if (p.jan) {
        held = heldByJan.get(p.jan) ?? heldByJan.set(p.jan, new Float64Array(n)).get(p.jan)!;
        cost = costByJan.get(p.jan) ?? costByJan.set(p.jan, new Float64Array(n)).get(p.jan)!;
      }
      for (const [day, change] of deltas) {
        heldDelta[day] += change;
        if (held && cost) {
          held[day] += change;
          cost[day] += change * holdingCost;
        }
      }
    }

    let soldSoFar = 0;
    let costSoFar = 0;
    for (const s of [...p.sales].sort((a, b) => a.date.localeCompare(b.date))) {
      soldSoFar += s.qty;
      const costNow = Math.round(exactCost * soldSoFar);
      realizedDelta[clamp(dayIndex(start, s.date), n)] += s.price * s.qty - s.deduction - (costNow - costSoFar);
      costSoFar = costNow;
    }
    for (const r of p.returns) realizedDelta[clamp(dayIndex(start, r.date), n)] -= r.loss;
  }
  for (const e of data.expenses) {
    if (e.date) realizedDelta[clamp(dayIndex(start, e.date), n)] -= e.amount;
  }

  const history = dailyMaxSeries(data, enabledStores, start, n);
  const value = new Float64Array(n);
  const cost = new Float64Array(n);
  const pricedQty = new Float64Array(n);
  for (const [jan, heldDeltas] of heldByJan) {
    const held = cumulative(heldDeltas);
    const heldCost = cumulative(costByJan.get(jan)!);
    const current = best.get(jan)?.price ?? 0;
    const daily = fillDaily(history.get(jan) ?? (current ? [[0, current]] : []), n);
    daily[n - 1] = current;
    for (let i = 0; i < n; i++) {
      if (held[i] <= 0 || daily[i] <= 0) continue;
      pricedQty[i] += held[i];
      value[i] += daily[i] * held[i];
      cost[i] += heldCost[i];
    }
  }

  const realized = cumulative(realizedDelta);
  const unrealized = new Float64Array(n);
  const total = new Float64Array(n);
  const dates: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    unrealized[i] = Math.round(value[i] - cost[i]);
    realized[i] = Math.round(realized[i]);
    total[i] = realized[i] + unrealized[i];
    value[i] = Math.round(value[i]);
    cost[i] = Math.round(cost[i]);
    dates[i] = dateAt(start, i);
  }
  return { dates, total, realized, unrealized, value, cost, heldQty: cumulative(heldDelta), pricedQty, n };
}

export type TrendUnit = 'day' | 'week' | 'month';

export interface TrendBucket {
  key: string;
  from: string;
  to: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** 按日 / 周（周一开始）/ 月聚合成 K 线 */
export function bucketize(dates: string[], values: ArrayLike<number>, unit: TrendUnit): TrendBucket[] {
  const keyOf = (date: string) => {
    if (unit === 'month') return date.slice(0, 7);
    if (unit === 'week') {
      const t = utc(date);
      const offset = (new Date(t).getUTCDay() + 6) % 7;
      return new Date(t - offset * DAY_MS).toISOString().slice(0, 10);
    }
    return date;
  };
  const out: TrendBucket[] = [];
  let cur: TrendBucket | null = null;
  for (let i = 0; i < dates.length; i++) {
    const key = keyOf(dates[i]);
    const v = values[i];
    if (!cur || cur.key !== key) {
      cur = { key, from: dates[i], to: dates[i], open: v, high: v, low: v, close: v };
      out.push(cur);
    } else {
      cur.to = dates[i];
      cur.close = v;
      if (v > cur.high) cur.high = v;
      if (v < cur.low) cur.low = v;
    }
  }
  return out;
}
