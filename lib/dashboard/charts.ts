// lib/dashboard/charts.ts — 月度趋势与四个分布图的数据（复刻买取X DashboardView 的 Px / us / fs / Mi / Di）
// 都跟随页面筛选。分布图的利润 = 售价 × 数量 − 扣除 − 单件成本 × 数量（不含退货损失与经费，与买取X 一致）。
// 另加三个（2026-10-11 从删除的数据分析页搬来）：投资额 / 利润按支付方式、获得积分按积分平台；月度利润率与笔数（monthlyRates）。

import type { DashboardData } from './data';
import { filteredPurchases, filteredSales, holdingUnitCost, unitCost, type DashFilters } from './summary';

export interface MonthlyRow {
  /** YYYY-MM */
  month: string;
  investment: number;
  revenue: number;
  /** 确定利润 */
  profit: number;
  /** 未售部分按当前最高买取价的预估利润（记在进货月） */
  estimated: number;
}

/**
 * 默认（按进货日）：投资额与售出部分成本记在进货月；回收额 / 扣除记在出售月，
 * 打开「同一天统计」时也记在进货月。利润 = 该月回收额 − 扣除 − 该月进货中已售部分的成本。
 * 按售出日：全部按出售月，投资额 = 已售部分的原价。
 */
export function monthlyRows(data: DashboardData, f: DashFilters, best: Map<string, { price: number }>): MonthlyRow[] {
  if (f.sellBasis) {
    const byMonth = new Map<string, { investment: number; revenue: number; deduction: number; cost: number }>();
    for (const { p, s } of filteredSales(data, f)) {
      const m = s.date.slice(0, 7);
      const row = byMonth.get(m) ?? byMonth.set(m, { investment: 0, revenue: 0, deduction: 0, cost: 0 }).get(m)!;
      row.investment += p.unitPrice * s.qty;
      row.revenue += s.price * s.qty;
      row.deduction += s.deduction;
      row.cost += Math.round(unitCost(p) * s.qty);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, r]) => ({ month, investment: r.investment, revenue: r.revenue, profit: r.revenue - r.deduction - r.cost, estimated: 0 }));
  }

  const buy = new Map<string, { investment: number; soldCost: number; estimated: number }>();
  const sell = new Map<string, { revenue: number; deduction: number }>();
  for (const p of filteredPurchases(data, f)) {
    const m = p.date.slice(0, 7);
    const row = buy.get(m) ?? buy.set(m, { investment: 0, soldCost: 0, estimated: 0 }).get(m)!;
    row.investment += p.unitPrice * (f.completedOnly ? p.soldQty : p.quantity);
    row.soldCost += Math.round(unitCost(p) * p.soldQty);
    for (const s of p.sales) {
      const sm = f.sameDay ? m : s.date.slice(0, 7);
      const r = sell.get(sm) ?? sell.set(sm, { revenue: 0, deduction: 0 }).get(sm)!;
      r.revenue += s.price * s.qty;
      r.deduction += s.deduction;
    }
    if (!f.completedOnly) {
      const unsold = p.quantity - p.soldQty - p.returnedQty;
      const price = p.jan ? best.get(p.jan)?.price : undefined;
      if (unsold > 0 && price) row.estimated += (price - holdingUnitCost(p)) * unsold;
    }
  }
  const months = [...new Set([...buy.keys(), ...sell.keys()])].sort();
  return months.map(month => {
    const b = buy.get(month);
    const s = sell.get(month);
    return {
      month,
      investment: b?.investment ?? 0,
      revenue: s?.revenue ?? 0,
      profit: (s?.revenue ?? 0) - (s?.deduction ?? 0) - (b?.soldCost ?? 0),
      estimated: b?.estimated ?? 0,
    };
  });
}

export interface Slice {
  name: string;
  value: number;
}

export interface Distributions {
  /** 投资额按进货来源 */
  investBySource: Slice[];
  /** 回收额按出售渠道 */
  revenueByTarget: Slice[];
  /** 利润按进货来源 */
  profitBySource: Slice[];
  /** 利润按出售渠道 */
  profitByTarget: Slice[];
  /** 投资额按支付方式 */
  investByCard: Slice[];
  /** 利润按支付方式 */
  profitByCard: Slice[];
  /** 获得积分按积分平台 */
  pointsByPlatform: Slice[];
}

const UNKNOWN = '未设置';

function toSlices(map: Map<string, number>): Slice[] {
  return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}

function add(map: Map<string, number>, key: string | null, value: number) {
  const k = key || UNKNOWN;
  map.set(k, (map.get(k) ?? 0) + value);
}

export function distributions(data: DashboardData, f: DashFilters): Distributions {
  const invest = new Map<string, number>();
  const revenue = new Map<string, number>();
  const profitSource = new Map<string, number>();
  const profitTarget = new Map<string, number>();
  const investCard = new Map<string, number>();
  const profitCard = new Map<string, number>();
  const points = new Map<string, number>();
  const cardName = new Map(data.paymentMethods.map(pm => [pm.id, pm.name]));
  const platformName = new Map((data.pointsPlatforms ?? []).map(pp => [pp.id, pp.name]));
  const card = (id: string | null) => (id ? cardName.get(id) ?? null : null);
  /** share：只算已售部分时（按售出日）按件数比例分摊积分 */
  const addPoints = (p: DashboardData['purchases'][number], share: number) => {
    for (const [id, v] of p.pointsByPlatform ?? []) add(points, id ? platformName.get(id) ?? null : null, v * share);
  };

  if (f.sellBasis) {
    for (const { p, s } of filteredSales(data, f)) {
      const profit = s.price * s.qty - s.deduction - unitCost(p) * s.qty;
      add(invest, p.source, p.unitPrice * s.qty);
      add(revenue, s.target, s.price * s.qty);
      add(profitSource, p.source, profit);
      add(profitTarget, s.target, profit);
      add(investCard, card(p.cardId), p.unitPrice * s.qty);
      add(profitCard, card(p.cardId), profit);
      addPoints(p, s.qty / (p.quantity || 1));
    }
  } else {
    for (const p of filteredPurchases(data, f)) {
      add(invest, p.source, p.unitPrice * p.quantity);
      add(investCard, card(p.cardId), p.unitPrice * p.quantity);
      addPoints(p, 1);
      const cost = holdingUnitCost(p);
      for (const s of p.sales) {
        const profit = s.price * s.qty - s.deduction - cost * s.qty;
        add(revenue, s.target, s.price * s.qty);
        add(profitSource, p.source, profit);
        add(profitTarget, s.target, profit);
        add(profitCard, card(p.cardId), profit);
      }
    }
  }
  return {
    investBySource: toSlices(invest),
    revenueByTarget: toSlices(revenue),
    profitBySource: toSlices(profitSource),
    profitByTarget: toSlices(profitTarget),
    investByCard: toSlices(investCard),
    profitByCard: toSlices(profitCard),
    pointsByPlatform: toSlices(points),
  };
}

export interface MonthlyRate {
  /** YYYY-MM */
  month: string;
  /** 该月卖出部分的利润率（%）= Σ(售价 × 数量 − 扣除 − 单件成本 × 数量) ÷ Σ(单件成本 × 数量)；没有出售为 null */
  roi: number | null;
  /** 该月进货笔数 */
  purchases: number;
  /** 该月卖出件数 */
  soldQty: number;
}

/** 月度利润率与笔数：利润率按出售月（看当月卖掉的东西赚了几成），进货笔数按进货月；跟随页面筛选 */
export function monthlyRates(data: DashboardData, f: DashFilters): MonthlyRate[] {
  const rows = new Map<string, { profit: number; cost: number; purchases: number; soldQty: number }>();
  const row = (m: string) => rows.get(m) ?? rows.set(m, { profit: 0, cost: 0, purchases: 0, soldQty: 0 }).get(m)!;
  if (!f.sellBasis) {
    for (const p of filteredPurchases(data, f)) row(p.date.slice(0, 7)).purchases += 1;
  }
  for (const { p, s } of filteredSales(data, f)) {
    const r = row(s.date.slice(0, 7));
    const cost = unitCost(p) * s.qty;
    r.profit += s.price * s.qty - s.deduction - cost;
    r.cost += cost;
    r.soldQty += s.qty;
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, r]) => ({ month, roi: r.cost > 0 ? Math.round((r.profit / r.cost) * 1000) / 10 : null, purchases: r.purchases, soldQty: r.soldQty }));
}
