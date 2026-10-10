// lib/dashboard/data.ts — 仪表盘的原始数据（复刻买取X：一次取全，筛选 / 汇总 / 走势都在前端现算）
/* eslint-disable @typescript-eslint/no-explicit-any -- 读取带关联的行，按列名取值 */
// 全部分页读取（fetchAllRows / fetchAllByIds），任何一次失败都抛错：仪表盘进了离线白名单，不能把失败当成空数据持久化。

import { supabase } from '@/lib/supabase/client';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';
import { normalizeStoreName } from '@/lib/kaitorix-config';
import { paymentMethodDisplayName } from '@/lib/utils/paymentMethods';

export interface DashSale {
  date: string;
  qty: number;
  price: number;
  /** 扣除额 = 平台手续费 + 运费（买取X「控除額」） */
  deduction: number;
  target: string | null;
  orderId: string | null;
}

export interface DashReturn {
  date: string;
  qty: number;
  loss: number;
}

export interface DashPurchase {
  id: string;
  date: string;
  jan: string | null;
  productName: string;
  /** 进货单价（不含运费） */
  unitPrice: number;
  quantity: number;
  shippingFee: number;
  /** 获得积分（网站 + 信用卡 + 其他） */
  pointsEarned: number;
  /** 使用积分（付款方式，不减成本） */
  pointsUsed: number;
  source: string | null;
  cardId: string | null;
  status: string;
  notes: string | null;
  soldQty: number;
  returnedQty: number;
  /** 未到货数量（我们只有整笔到货：未到货状态时 = 未售数量） */
  notArrivedQty: number;
  sales: DashSale[];
  returns: DashReturn[];
}

export interface DashExpense {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  category: string;
}

export interface DashPrice {
  store: string;
  price: number;
  /** 该店报价超过 7 天（不参考） */
  stale: boolean;
}

export interface DashPriceChange {
  jan: string;
  store: string;
  /** YYYY-MM-DD（JST） */
  date: string;
  /** null = 该店不再报价 */
  price: number | null;
}

export interface DashboardData {
  purchases: DashPurchase[];
  expenses: DashExpense[];
  /** JAN → 各店当前报价（官方 API 缓存与每日 CSV 取较新，见视图 assistant_buyback_prices） */
  prices: Record<string, DashPrice[]>;
  /** 买取价变动历史（每日 CSV 同步只记变动，2026-10-08 起） */
  priceHistory: DashPriceChange[];
  paymentMethods: { id: string; name: string }[];
}

const num = (v: unknown) => Number(v) || 0;

/** timestamptz → JST 日期（买取价每日同步按 JST 记日） */
function jstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [txRows, saleRows, returnRows, expenseRows, pmRows] = await Promise.all([
    fetchAllRows<any>((from, to, opts) =>
      supabase
        .from('transactions')
        .select(
          'id, date, jan_code, product_name, unit_price, quantity, purchase_price_total, shipping_fee, point_paid, expected_platform_points, expected_card_points, extra_platform_points, status, notes, quantity_sold, quantity_returned, quantity_in_stock, card_id, purchase_platform:purchase_platforms(name)',
          opts,
        )
        .order('date')
        .order('id')
        .range(from, to),
    ),
    fetchAllRows<any>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select('transaction_id, sale_date, quantity_sold, selling_price_per_unit, platform_fee, shipping_fee, sale_order_number, selling_platform:selling_platforms(name)', opts)
        .order('sale_date')
        .order('id')
        .range(from, to),
    ),
    fetchAllRows<any>((from, to, opts) =>
      supabase
        .from('return_records')
        .select('transaction_id, return_date, quantity_returned, loss_amount', opts)
        .order('return_date')
        .order('id')
        .range(from, to),
    ),
    fetchAllRows<any>((from, to, opts) =>
      supabase.from('supplies_costs').select('id, purchase_date, amount, category, description', opts).order('purchase_date').order('id').range(from, to),
    ),
    fetchAllRows<any>((from, to, opts) => supabase.from('payment_methods').select('*', opts).order('id').range(from, to)),
  ]);

  const salesByTx = new Map<string, DashSale[]>();
  for (const s of saleRows) {
    const list = salesByTx.get(s.transaction_id) ?? [];
    list.push({
      date: s.sale_date,
      qty: num(s.quantity_sold),
      price: num(s.selling_price_per_unit),
      deduction: num(s.platform_fee) + num(s.shipping_fee),
      target: s.selling_platform?.name ?? null,
      orderId: s.sale_order_number || null,
    });
    salesByTx.set(s.transaction_id, list);
  }
  const returnsByTx = new Map<string, DashReturn[]>();
  for (const r of returnRows) {
    const list = returnsByTx.get(r.transaction_id) ?? [];
    list.push({ date: r.return_date, qty: num(r.quantity_returned), loss: num(r.loss_amount) });
    returnsByTx.set(r.transaction_id, list);
  }

  const purchases: DashPurchase[] = txRows.map(t => {
    const quantity = num(t.quantity) || 1;
    const shippingFee = num(t.shipping_fee);
    const unitPrice = t.unit_price != null ? num(t.unit_price) : (num(t.purchase_price_total) - shippingFee) / quantity;
    return {
      id: t.id,
      date: t.date,
      jan: t.jan_code || null,
      productName: t.product_name,
      unitPrice,
      quantity,
      shippingFee,
      pointsEarned: num(t.expected_platform_points) + num(t.expected_card_points) + num(t.extra_platform_points),
      pointsUsed: num(t.point_paid),
      source: t.purchase_platform?.name ?? null,
      cardId: t.card_id ?? null,
      status: t.status,
      notes: t.notes || null,
      soldQty: num(t.quantity_sold),
      returnedQty: num(t.quantity_returned),
      notArrivedQty: t.status === 'pending' ? num(t.quantity_in_stock) : 0,
      sales: salesByTx.get(t.id) ?? [],
      returns: returnsByTx.get(t.id) ?? [],
    };
  });

  const jans = [...new Set(purchases.map(p => p.jan).filter((j): j is string => !!j))];
  const [priceRows, historyRows] = jans.length
    ? await Promise.all([
        fetchAllByIds<any>(jans, (chunk, from, to, opts) =>
          supabase
            .from('assistant_buyback_prices')
            .select('jan, store, price, is_stale', opts)
            .in('jan', chunk)
            .order('jan')
            .order('store')
            .range(from, to),
        ),
        fetchAllByIds<any>(jans, (chunk, from, to, opts) =>
          supabase
            .from('kaitorix_price_history')
            .select('jan, store, observed_at, price', opts)
            .in('jan', chunk)
            .order('observed_at')
            .order('jan')
            .order('store')
            .range(from, to),
        ),
      ])
    : [[], []];

  const prices: Record<string, DashPrice[]> = {};
  for (const p of priceRows) {
    (prices[p.jan] ??= []).push({ store: normalizeStoreName(p.store), price: num(p.price), stale: !!p.is_stale });
  }

  return {
    purchases,
    expenses: expenseRows.map(e => ({ id: e.id, date: e.purchase_date, description: e.description || null, amount: num(e.amount), category: e.category })),
    prices,
    priceHistory: historyRows
      .map(h => ({ jan: h.jan, store: normalizeStoreName(h.store), date: jstDate(h.observed_at), price: h.price == null ? null : num(h.price) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    paymentMethods: pmRows.map(pm => ({ id: pm.id, name: paymentMethodDisplayName(pm) })),
  };
}
