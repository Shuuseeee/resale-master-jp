// lib/api/transactions-cache.ts
// 交易列表查询聚合（TanStack Query 驱动，无需手动内存缓存）

import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
import type { Transaction, PaymentMethod } from '@/types/database.types';

export interface TransactionWithProfit extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
  aggregated_actual_cash_spent?: number | null;
  aggregated_total_selling_price?: number | null;
  aggregated_selling_platform_ids?: string[];
  aggregated_sale_order_numbers?: string[];
}

// sales_records 查询结果的元素类型（仅包含列表页所需字段）
interface SalesRecordRow {
  transaction_id: string;
  total_profit: number | null;
  actual_cash_spent: number | null;
  total_selling_price: number | null;
  sale_date: string;
  selling_platform_id: string | null;
  sale_order_number: string | null;
}

interface ReturnLossRow {
  transaction_id: string;
  loss_amount: number | null;
}

/**
 * 单笔交易的列表聚合。利润口径与买取X / 数据库触发器 calc_transaction_profit 一致：
 * 利润 = 各次出售利润之和 − 退货损失额；利润率 = 利润 ÷（售出部分成本 + 退货损失额）
 */
function aggregate(transaction: Transaction, salesRecords: SalesRecordRow[], loss: number): TransactionWithProfit {
  let latest_sale_date: string | null = null;
  let aggregated_profit: number | null = null;
  let aggregated_roi: number | null = null;
  let aggregated_actual_cash_spent: number | null = null;
  let aggregated_total_selling_price: number | null = null;
  let aggregated_selling_platform_ids: string[] = [];

  if (salesRecords.length > 0) {
    latest_sale_date = salesRecords[0].sale_date;
    aggregated_total_selling_price = salesRecords.reduce((sum, r) => sum + (r.total_selling_price || 0), 0);
    aggregated_selling_platform_ids = Array.from(
      new Set(salesRecords.map(r => r.selling_platform_id).filter(Boolean) as string[])
    );
  }
  if (salesRecords.length > 0 || loss > 0) {
    const basis = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0) + loss;
    aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0) - loss;
    aggregated_actual_cash_spent = basis;
    aggregated_roi = basis > 0 ? (aggregated_profit / basis) * 100 : 0;
  }

  const aggregated_sale_order_numbers = salesRecords
    .map(r => r.sale_order_number)
    .filter(Boolean) as string[];

  return {
    ...transaction,
    latest_sale_date,
    aggregated_profit,
    aggregated_roi,
    aggregated_actual_cash_spent,
    aggregated_total_selling_price,
    aggregated_selling_platform_ids,
    aggregated_sale_order_numbers,
  } as TransactionWithProfit;
}

function lossByTransaction(rows: ReturnLossRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach(r => map.set(r.transaction_id, (map.get(r.transaction_id) || 0) + (r.loss_amount || 0)));
  return map;
}

// ------- 查询 + 聚合 -------
export async function fetchTransactionsWithProfit(): Promise<TransactionWithProfit[]> {
  // 交易与销售记录并行拉取（原先是先取交易、再用全部交易 ID 拼 .in() 串行取销售）。
  // 不再需要 .in('transaction_id', ids)：sales_records 的 RLS 已限定为当前用户本人的行，
  // 与 transactions 的可见范围一致；去掉后请求 URL 不再随交易数量增长（565 笔时约 20KB）。
  //
  // 两个查询都分页读取：PostgREST 单次响应有行数上限（默认 1000），超过的部分会被静默截断，
  // 表现为列表少几笔、利润聚合偏小而不报错。排序带 id 兜底，保证分页时没有重复 / 遗漏。
  // 销售记录读取失败现在会让整个列表失败（原先只记日志、利润列静默为空）：
  // 缺销售记录的列表会显示错误的利润，并被离线缓存持久化，比显示错误页更糟。
  const [txList, salesRows, returnRows] = await Promise.all([
    fetchAllRows<Transaction & { payment_method: unknown }>((from, to, opts) =>
      supabase
        .from('transactions')
        .select(`
      *,
      payment_method:payment_methods(id, name)
    `, opts)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    fetchAllRows<SalesRecordRow>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select('transaction_id, total_profit, actual_cash_spent, total_selling_price, sale_date, selling_platform_id, sale_order_number', opts)
        .order('sale_date', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    fetchAllRows<ReturnLossRow>((from, to, opts) =>
      supabase
        .from('return_records')
        .select('transaction_id, loss_amount', opts)
        .order('id')
        .range(from, to),
    ),
  ]);

  // 按 transaction_id 分组
  const salesByTx = new Map<string, SalesRecordRow[]>();
  salesRows.forEach(r => {
    const list = salesByTx.get(r.transaction_id) || [];
    list.push(r);
    salesByTx.set(r.transaction_id, list);
  });

  const lossByTx = lossByTransaction(returnRows);
  return txList.map(transaction =>
    aggregate(transaction, salesByTx.get(transaction.id) || [], lossByTx.get(transaction.id) || 0),
  );
}

// ------- 单条刷新（mutation 后精准更新，避免全量重拉）-------
export async function fetchSingleTransaction(id: string): Promise<TransactionWithProfit> {
  const { data: tx, error } = await supabase
    .from('transactions')
    .select('*, payment_method:payment_methods(id, name)')
    .eq('id', id)
    .single();
  if (error || !tx) throw error ?? new Error('Transaction not found');

  const [{ data: srData }, { data: rrData }] = await Promise.all([
    supabase
      .from('sales_records')
      .select('transaction_id, total_profit, actual_cash_spent, total_selling_price, sale_date, selling_platform_id, sale_order_number')
      .eq('transaction_id', id)
      .order('sale_date', { ascending: false }),
    supabase.from('return_records').select('transaction_id, loss_amount').eq('transaction_id', id),
  ]);

  return aggregate(
    tx,
    (srData as SalesRecordRow[] | null) ?? [],
    lossByTransaction((rrData as ReturnLossRow[] | null) ?? []).get(id) || 0,
  );
}
