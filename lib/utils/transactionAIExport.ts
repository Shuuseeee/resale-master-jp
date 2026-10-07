// lib/utils/transactionAIExport.ts
// 把交易及其销售 / 退货 / 买取价缓存序列化为「AI 分析用」的格式化 JSON。
//
// 输出结构与原生 App 的 TransactionAIExport.swift 保持一致，下游（如 ResaleAssist 分销优化）
// 同时消费两端的导出，不要单方面改字段名或层级：
//   单笔：{ transaction, sales, returns, kaitorix_prices? }
//   多笔：{ transaction_count, transactions: [单笔, ...] }
// 约定：可空字段为 null 时整体省略（不输出 null）；键按字母序排序，便于 diff 与对比。
//
// 本文件是纯函数，不依赖 React / 网络，数据由 lib/api/transaction-ai-export.ts 加载。

import type { Transaction, SalesRecord, ReturnRecord } from '@/types/database.types';

export interface AIExportKaitorixPrice {
  store: string;
  price: number;
  url: string;
  updated?: string | null;
}

export interface AIExportKaitorixCache {
  jan: string;
  product_name: string | null;
  max_price: number | null;
  max_store: string | null;
  fetched_at: string | null;
  prices: AIExportKaitorixPrice[];
}

export interface AIExportSource {
  transaction: Transaction;
  /** 采购平台名（调用方按 purchase_platform_id 解析） */
  purchasePlatformName?: string | null;
  /** 支付方式名 */
  paymentMethodName?: string | null;
  sales: SalesRecord[];
  /** selling_platform_id → 平台名 */
  sellingPlatformNames: ReadonlyMap<string, string>;
  returns: ReturnRecord[];
  kaitorix?: AIExportKaitorixCache | null;
}

type JsonObject = { [key: string]: unknown };

const num = (v: number | string | null | undefined): number => Number(v ?? 0);

/** 仅当值非 null / undefined 时写入（对应 Swift 里的 `if let`） */
function setIfPresent(target: JsonObject, key: string, value: unknown) {
  if (value !== null && value !== undefined) target[key] = value;
}

function numIfPresent(target: JsonObject, key: string, value: number | string | null | undefined) {
  if (value !== null && value !== undefined) target[key] = Number(value);
}

export function buildTransactionAIExport(source: AIExportSource): JsonObject {
  const { transaction: t } = source;
  const root: JsonObject = {};

  const tx: JsonObject = {
    id: t.id,
    date: t.date,
    product_name: t.product_name,
    status: t.status,
    quantity: t.quantity,
    quantity_sold: t.quantity_sold,
    quantity_returned: t.quantity_returned,
    quantity_in_stock: t.quantity_in_stock,
    purchase_price_total: num(t.purchase_price_total),
    card_paid: num(t.card_paid),
    point_paid: num(t.point_paid),
    balance_paid: num(t.balance_paid),
    expected_platform_points: num(t.expected_platform_points),
    expected_card_points: num(t.expected_card_points),
    extra_platform_points: num(t.extra_platform_points),
  };
  numIfPresent(tx, 'unit_price', t.unit_price);
  setIfPresent(tx, 'jan_code', t.jan_code);
  setIfPresent(tx, 'order_number', t.order_number);
  numIfPresent(tx, 'cash_profit', t.cash_profit);
  numIfPresent(tx, 'total_profit', t.total_profit);
  numIfPresent(tx, 'roi', t.roi);
  setIfPresent(tx, 'expected_payment_date', t.expected_payment_date);
  setIfPresent(tx, 'notes', t.notes);
  setIfPresent(tx, 'created_at', t.created_at);
  setIfPresent(tx, 'updated_at', t.updated_at);
  setIfPresent(tx, 'purchase_platform', source.purchasePlatformName);
  setIfPresent(tx, 'payment_method', source.paymentMethodName);
  root.transaction = tx;

  root.sales = source.sales.map(r => {
    const s: JsonObject = {
      id: r.id,
      sale_date: r.sale_date,
      quantity_sold: r.quantity_sold,
      selling_price_per_unit: num(r.selling_price_per_unit),
      platform_fee: num(r.platform_fee),
      shipping_fee: num(r.shipping_fee),
      total_selling_price: num(r.total_selling_price),
    };
    numIfPresent(s, 'cash_profit', r.cash_profit);
    numIfPresent(s, 'total_profit', r.total_profit);
    numIfPresent(s, 'roi', r.roi);
    if (r.selling_platform_id) setIfPresent(s, 'selling_platform', source.sellingPlatformNames.get(r.selling_platform_id));
    setIfPresent(s, 'sale_order_number', r.sale_order_number);
    setIfPresent(s, 'notes', r.notes);
    return s;
  });

  root.returns = source.returns.map(r => {
    const ret: JsonObject = {
      id: r.id,
      return_date: r.return_date,
      quantity_returned: r.quantity_returned,
      return_amount: num(r.return_amount),
      points_deducted: num(r.points_deducted),
    };
    setIfPresent(ret, 'return_reason', r.return_reason);
    setIfPresent(ret, 'notes', r.notes);
    return ret;
  });

  if (source.kaitorix) {
    const k = source.kaitorix;
    const kp: JsonObject = {
      jan: k.jan,
      max_price: num(k.max_price),
    };
    setIfPresent(kp, 'fetched_at', k.fetched_at);
    setIfPresent(kp, 'product_name', k.product_name);
    setIfPresent(kp, 'max_store', k.max_store);
    kp.all_prices = k.prices.map(p => {
      const e: JsonObject = { store: p.store, price: num(p.price), url: p.url };
      setIfPresent(e, 'updated', p.updated);
      return e;
    });
    root.kaitorix_prices = kp;
  }

  return root;
}

/** 多笔导出的外层包装；顺序即传入顺序（与列表所见一致） */
export function buildBatchAIExport(items: JsonObject[]): JsonObject {
  return { transaction_count: items.length, transactions: items };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: JsonObject = {};
    for (const key of Object.keys(value as JsonObject).sort()) {
      out[key] = sortKeysDeep((value as JsonObject)[key]);
    }
    return out;
  }
  return value;
}

export function serializeAIExport(object: JsonObject): string {
  return JSON.stringify(sortKeysDeep(object), null, 2);
}
