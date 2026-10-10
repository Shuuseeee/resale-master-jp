// lib/dashboard/summary.ts — 仪表盘的筛选与六张指标卡（复刻买取X DashboardView 的汇总逻辑）
// 口径与本应用利润一致（数据库触发器 calc_sale_profit）：单位成本 =（单价 × 数量 + 运费 − 获得积分）÷ 数量。
// 与买取X 原实现的有意差异：「按售出日」时成本含运费并扣退货损失；库存数量扣掉退货。

import type { DashboardData, DashExpense, DashPurchase, DashSale } from './data';

export type PeriodMode = 'all' | 'year' | 'month' | 'range';

/** 支付方式筛选里「未设置支付方式」的取值 */
export const NO_CARD = '__none';

export interface DashFilters {
  period: PeriodMode;
  /** YYYY */
  year: string;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD，空 = 不限 */
  from: string;
  to: string;
  jan: string;
  source: string;
  card: string;
  /** 仅已完成：只统计有出售的进货，投资额只算已售部分 */
  completedOnly: boolean;
  /** 按售出日：投资额 / 回收额 / 利润 / 已售数量按出售日期统计 */
  sellBasis: boolean;
}

export function defaultFilters(today: string): DashFilters {
  return {
    period: 'all',
    year: today.slice(0, 4),
    month: today.slice(0, 7),
    from: '',
    to: '',
    jan: '',
    source: '',
    card: '',
    completedOnly: false,
    sellBasis: false,
  };
}

export interface DashSummary {
  /** 投资额（总额）= 单价 × 数量（按售出日时 = 已售部分的成本） */
  investment: number;
  /** 实际投资额 = 总额 − 获得积分 */
  netInvestment: number;
  pointsEarned: number;
  pointsUsed: number;
  expenses: number;
  revenue: number;
  deduction: number;
  returnLoss: number;
  /** 确定利润 = 回收额 − 扣除 − 售出部分成本 − 退货损失 − 经费 */
  profit: number;
  /** 不计积分的现金利润（「扣除积分」开关） */
  cashProfit: number;
  /** 利润率 = 确定利润 ÷（售出部分成本 + 退货损失） */
  profitRate: number;
  /** 未售部分按当前最高买取价卖出的预估利润 */
  estimatedProfit: number;
  /** 利润（含预估） */
  totalWithEstimated: number;
  soldQty: number;
  /** 未售数量（库存 + 未到货） */
  unsoldQty: number;
  pendingQty: number;
  /** 未售部分的进货额（单价 × 数量） */
  unsoldCost: number;
  arrivedCost: number;
  pendingCost: number;
  /** 按售出日时不显示库存 / 含预估卡片 */
  hideStock: boolean;
}

export function inPeriod(f: DashFilters, date: string | null | undefined): boolean {
  if (f.period === 'all' || !date) return true;
  const d = date.slice(0, 10);
  if (f.period === 'year') return d.startsWith(f.year);
  if (f.period === 'month') return d.startsWith(f.month);
  return !((f.from && d < f.from) || (f.to && d > f.to));
}

function matchDims(f: DashFilters, p: DashPurchase): boolean {
  if (f.jan && (p.jan ?? '') !== f.jan) return false;
  if (f.source && p.source !== f.source) return false;
  if (f.card === NO_CARD) return !p.cardId;
  if (f.card && p.cardId !== f.card) return false;
  return true;
}

/** 单位成本（含运费、扣获得积分），与数据库利润一致 */
export function unitCost(p: DashPurchase): number {
  return p.quantity > 0 ? (p.unitPrice * p.quantity + p.shippingFee - p.pointsEarned) / p.quantity : 0;
}

/** 预估利润 / 走势用的单件成本：运费与积分先按件向下取整（买取X 的算法，预估利润与它逐元一致） */
export function holdingUnitCost(p: DashPurchase): number {
  const qty = p.quantity || 1;
  return p.unitPrice + Math.floor(p.shippingFee / qty) - Math.floor(p.pointsEarned / qty);
}

/** 当前最高买取价：只取 7 天内的报价，并按「设置 > 买取价格检查」勾选的店铺过滤 */
export function bestPrices(data: DashboardData, enabledStores: ReadonlySet<string> | null): Map<string, { price: number; stores: string[] }> {
  const map = new Map<string, { price: number; stores: string[] }>();
  for (const [jan, list] of Object.entries(data.prices)) {
    const usable = list.filter(p => !p.stale && (!enabledStores || enabledStores.has(p.store)));
    if (!usable.length) continue;
    const price = Math.max(...usable.map(p => p.price));
    map.set(jan, { price, stores: usable.filter(p => p.price === price).map(p => p.store) });
  }
  return map;
}

export function filteredExpenses(data: DashboardData, f: DashFilters): DashExpense[] {
  return data.expenses.filter(e => inPeriod(f, e.date));
}

export function filteredPurchases(data: DashboardData, f: DashFilters): DashPurchase[] {
  return data.purchases.filter(
    p => inPeriod(f, p.date) && matchDims(f, p) && (!f.completedOnly || (p.sales.length > 0 && p.soldQty > 0)),
  );
}

/** 按售出日：落在期间内的每一次出售 */
export function filteredSales(data: DashboardData, f: DashFilters): { p: DashPurchase; s: DashSale }[] {
  const out: { p: DashPurchase; s: DashSale }[] = [];
  for (const p of data.purchases) {
    if (!matchDims(f, p)) continue;
    for (const s of p.sales) if (inPeriod(f, s.date)) out.push({ p, s });
  }
  return out;
}

const rate = (profit: number, basis: number) => (basis > 0 ? Math.round((profit / basis) * 1000) / 10 : 0);

export function computeSummary(
  data: DashboardData,
  f: DashFilters,
  best: Map<string, { price: number }>,
): DashSummary {
  const expenses = filteredExpenses(data, f).reduce((sum, e) => sum + e.amount, 0);

  if (f.sellBasis) {
    let revenue = 0, deduction = 0, cost = 0, gross = 0, points = 0, pointsUsed = 0, soldQty = 0;
    for (const { p, s } of filteredSales(data, f)) {
      revenue += s.price * s.qty;
      deduction += s.deduction;
      gross += p.unitPrice * s.qty;
      cost += Math.round(unitCost(p) * s.qty);
      points += Math.floor((p.pointsEarned * s.qty) / p.quantity);
      pointsUsed += Math.floor((p.pointsUsed * s.qty) / p.quantity);
      soldQty += s.qty;
    }
    let returnLoss = 0;
    for (const p of data.purchases) {
      if (!matchDims(f, p)) continue;
      for (const r of p.returns) if (inPeriod(f, r.date)) returnLoss += r.loss;
    }
    const profit = revenue - deduction - cost - returnLoss - expenses;
    return {
      investment: gross,
      netInvestment: gross - points,
      pointsEarned: points,
      pointsUsed,
      expenses,
      revenue,
      deduction,
      returnLoss,
      profit,
      cashProfit: profit - points,
      profitRate: rate(profit, cost + returnLoss),
      estimatedProfit: 0,
      totalWithEstimated: profit,
      soldQty,
      unsoldQty: 0,
      pendingQty: 0,
      unsoldCost: 0,
      arrivedCost: 0,
      pendingCost: 0,
      hideStock: true,
    };
  }

  let investment = 0, pointsEarned = 0, pointsUsed = 0, soldCost = 0, soldPoints = 0;
  let revenue = 0, deduction = 0, returnLoss = 0, soldQty = 0, estimatedProfit = 0;
  let unsoldQty = 0, pendingQty = 0, unsoldCost = 0, arrivedCost = 0, pendingCost = 0;

  for (const p of filteredPurchases(data, f)) {
    const cost = unitCost(p);
    soldCost += Math.round(cost * p.soldQty);
    soldPoints += Math.round((p.pointsEarned * p.soldQty) / p.quantity);
    soldQty += p.soldQty;
    if (f.completedOnly) {
      investment += p.unitPrice * p.soldQty;
      pointsEarned += Math.floor((p.pointsEarned * p.soldQty) / p.quantity);
      pointsUsed += Math.floor((p.pointsUsed * p.soldQty) / p.quantity);
    } else {
      investment += p.unitPrice * p.quantity;
      pointsEarned += p.pointsEarned;
      pointsUsed += p.pointsUsed;
      const unsold = Math.max(0, p.quantity - p.soldQty - p.returnedQty);
      if (unsold > 0) {
        const pending = Math.min(unsold, p.notArrivedQty);
        unsoldQty += unsold;
        pendingQty += pending;
        unsoldCost += p.unitPrice * unsold;
        arrivedCost += p.unitPrice * (unsold - pending);
        pendingCost += p.unitPrice * pending;
        const price = p.jan ? best.get(p.jan)?.price : undefined;
        if (price) estimatedProfit += (price - holdingUnitCost(p)) * unsold;
      }
    }
    for (const s of p.sales) {
      revenue += s.price * s.qty;
      deduction += s.deduction;
    }
    for (const r of p.returns) returnLoss += r.loss;
  }

  const profit = revenue - deduction - soldCost - returnLoss - expenses;
  return {
    investment,
    netInvestment: investment - pointsEarned,
    pointsEarned,
    pointsUsed,
    expenses,
    revenue,
    deduction,
    returnLoss,
    profit,
    cashProfit: profit - soldPoints,
    profitRate: rate(profit, soldCost + returnLoss),
    estimatedProfit,
    totalWithEstimated: profit + estimatedProfit,
    soldQty,
    unsoldQty,
    pendingQty,
    unsoldCost,
    arrivedCost,
    pendingCost,
    hideStock: f.completedOnly,
  };
}

/** 筛选下拉的候选项（年份 / 月份含出售日期，与买取X 一致） */
export function filterOptions(data: DashboardData) {
  const years = new Set<string>();
  const months = new Set<string>();
  const jans = new Map<string, string>();
  const sources = new Set<string>();
  for (const p of data.purchases) {
    years.add(p.date.slice(0, 4));
    months.add(p.date.slice(0, 7));
    for (const s of p.sales) {
      years.add(s.date.slice(0, 4));
      months.add(s.date.slice(0, 7));
    }
    if (p.jan && !jans.has(p.jan)) jans.set(p.jan, p.productName);
    if (p.source) sources.add(p.source);
  }
  return {
    years: [...years].sort().reverse(),
    months: [...months].sort().reverse(),
    jans: [...jans.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    sources: [...sources].sort(),
  };
}
