// lib/dashboard/tabs.ts — 仪表盘底部标签页的数据（复刻买取X：库存 / 未到货 / 出售记录 / JAN 汇总 / 经费）
// 都跟随页面筛选（期间按进货日；经费按经费日）。单件成本用 holdingUnitCost（与买取X 的列表一致）。

import type { DashboardData, DashExpense, DashPurchase, DashSale } from './data';
import { filteredExpenses, filteredPurchases, holdingUnitCost, unitCost, type DashFilters } from './summary';

export interface PriceInfo {
  price: number;
  stores: string[];
}

export interface StockRow {
  p: DashPurchase;
  /** 未售数量（库存：已到货；未到货：未到货） */
  qty: number;
  unitCost: number;
  best: PriceInfo | null;
  /** 最高买取价较昨日 */
  diff: number | null;
  estimated: number | null;
}

export interface SaleRow {
  p: DashPurchase;
  s: DashSale;
  total: number;
  profit: number;
}

export interface JanRow {
  jan: string;
  productName: string;
  /** 最近一次进货（「再次购买」复制它） */
  latestId: string;
  totalQty: number;
  soldQty: number;
  stockQty: number;
  pendingQty: number;
  investment: number;
  revenue: number;
  profit: number;
  profitRate: number;
  avgSalePrice: number | null;
  best: PriceInfo | null;
  diff: number | null;
  estimated: number | null;
}

function unsoldOf(p: DashPurchase) {
  return Math.max(0, p.quantity - p.soldQty - p.returnedQty);
}

/** 每个 JAN 的最高买取价较昨日：今天的当前价 − 昨天结束时的价格历史最高价（按勾选店铺；没有昨天的记录为 null） */
export function priceDiffs(
  data: DashboardData,
  best: Map<string, PriceInfo>,
  enabledStores: ReadonlySet<string> | null,
  today: string,
): Map<string, number> {
  const state = new Map<string, Map<string, number>>();
  for (const h of data.priceHistory) {
    if (h.date >= today) break;
    if (enabledStores && !enabledStores.has(h.store)) continue;
    const stores = state.get(h.jan) ?? state.set(h.jan, new Map()).get(h.jan)!;
    if (h.price == null) stores.delete(h.store);
    else stores.set(h.store, h.price);
  }
  const out = new Map<string, number>();
  for (const [jan, stores] of state) {
    const current = best.get(jan)?.price;
    if (!current || !stores.size) continue;
    out.set(jan, current - Math.max(...stores.values()));
  }
  return out;
}

function stockRow(p: DashPurchase, qty: number, best: Map<string, PriceInfo>, diffs: Map<string, number>): StockRow {
  const cost = holdingUnitCost(p);
  const info = p.jan ? best.get(p.jan) ?? null : null;
  return {
    p,
    qty,
    unitCost: cost,
    best: info,
    diff: p.jan ? diffs.get(p.jan) ?? null : null,
    estimated: info ? (info.price - cost) * qty : null,
  };
}

/** 库存（已到货、未售） */
export function inStockRows(data: DashboardData, f: DashFilters, best: Map<string, PriceInfo>, diffs: Map<string, number>): StockRow[] {
  if (f.completedOnly) return [];
  return filteredPurchases(data, f)
    .filter(p => p.status !== 'pending' && unsoldOf(p) > 0)
    .map(p => stockRow(p, unsoldOf(p), best, diffs))
    .sort((a, b) => b.p.date.localeCompare(a.p.date));
}

/** 未到货 */
export function pendingRows(data: DashboardData, f: DashFilters, best: Map<string, PriceInfo>, diffs: Map<string, number>): StockRow[] {
  if (f.completedOnly) return [];
  return filteredPurchases(data, f)
    .filter(p => p.status === 'pending' && unsoldOf(p) > 0)
    .map(p => stockRow(p, unsoldOf(p), best, diffs))
    .sort((a, b) => b.p.date.localeCompare(a.p.date));
}

/** 出售记录（每次出售一行） */
export function saleRows(data: DashboardData, f: DashFilters): SaleRow[] {
  const rows: SaleRow[] = [];
  for (const p of filteredPurchases(data, f)) {
    const cost = holdingUnitCost(p);
    for (const s of p.sales) {
      rows.push({ p, s, total: s.price * s.qty, profit: s.price * s.qty - s.deduction - cost * s.qty });
    }
  }
  return rows.sort((a, b) => b.s.date.localeCompare(a.s.date));
}

/** JAN 汇总：同一 JAN 的多次进货合成一行（无 JAN 的不计入）；利润口径同确定利润（含退货损失） */
export function janRows(data: DashboardData, f: DashFilters, best: Map<string, PriceInfo>, diffs: Map<string, number>): JanRow[] {
  type Acc = JanRow & { latestDate: string; deduction: number; soldCost: number; loss: number };
  const map = new Map<string, Acc>();
  for (const p of filteredPurchases(data, f)) {
    if (!p.jan) continue;
    let r = map.get(p.jan);
    if (!r) {
      r = {
        jan: p.jan,
        productName: p.productName,
        latestId: p.id,
        latestDate: p.date,
        totalQty: 0,
        soldQty: 0,
        stockQty: 0,
        pendingQty: 0,
        investment: 0,
        revenue: 0,
        profit: 0,
        profitRate: 0,
        avgSalePrice: null,
        best: best.get(p.jan) ?? null,
        diff: diffs.get(p.jan) ?? null,
        estimated: null,
        deduction: 0,
        soldCost: 0,
        loss: 0,
      };
      map.set(p.jan, r);
    }
    if (p.date >= r.latestDate) {
      r.latestId = p.id;
      r.latestDate = p.date;
      r.productName = p.productName;
    }
    const unsold = unsoldOf(p);
    r.totalQty += p.quantity;
    r.soldQty += p.soldQty;
    if (p.status === 'pending') r.pendingQty += unsold;
    else r.stockQty += unsold;
    r.investment += p.unitPrice * p.quantity;
    r.soldCost += Math.round(unitCost(p) * p.soldQty);
    for (const s of p.sales) {
      r.revenue += s.price * s.qty;
      r.deduction += s.deduction;
    }
    for (const ret of p.returns) r.loss += ret.loss;
    if (r.best && unsold > 0) r.estimated = (r.estimated ?? 0) + (r.best.price - holdingUnitCost(p)) * unsold;
  }
  return [...map.values()]
    .map(({ latestDate: _d, deduction, soldCost, loss, ...r }) => {
      const profit = r.revenue - deduction - soldCost - loss;
      const basis = soldCost + loss;
      return {
        ...r,
        profit,
        profitRate: basis > 0 ? Math.round((profit / basis) * 1000) / 10 : 0,
        avgSalePrice: r.soldQty > 0 ? Math.round(r.revenue / r.soldQty) : null,
      };
    })
    .sort((a, b) => b.investment - a.investment);
}

export function expenseRows(data: DashboardData, f: DashFilters): DashExpense[] {
  return [...filteredExpenses(data, f)].sort((a, b) => b.date.localeCompare(a.date));
}

/** CSV（UTF-8 BOM，Excel 可直接打开） */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\n');
}
