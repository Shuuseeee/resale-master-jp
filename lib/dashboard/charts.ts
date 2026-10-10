// lib/dashboard/charts.ts — 月度趋势与四个分布图的数据（复刻买取X DashboardView 的 Px / us / fs / Mi / Di）
// 都跟随页面筛选。分布图的利润 = 售价 × 数量 − 扣除 − 单件成本 × 数量（不含退货损失与经费，与买取X 一致）。

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

  if (f.sellBasis) {
    for (const { p, s } of filteredSales(data, f)) {
      const profit = s.price * s.qty - s.deduction - unitCost(p) * s.qty;
      add(invest, p.source, p.unitPrice * s.qty);
      add(revenue, s.target, s.price * s.qty);
      add(profitSource, p.source, profit);
      add(profitTarget, s.target, profit);
    }
  } else {
    for (const p of filteredPurchases(data, f)) {
      add(invest, p.source, p.unitPrice * p.quantity);
      const cost = holdingUnitCost(p);
      for (const s of p.sales) {
        const profit = s.price * s.qty - s.deduction - cost * s.qty;
        add(revenue, s.target, s.price * s.qty);
        add(profitSource, p.source, profit);
        add(profitTarget, s.target, profit);
      }
    }
  }
  return {
    investBySource: toSlices(invest),
    revenueByTarget: toSlices(revenue),
    profitBySource: toSlices(profitSource),
    profitByTarget: toSlices(profitTarget),
  };
}
