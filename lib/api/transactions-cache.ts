// lib/api/transactions-cache.ts
// 交易列表查询聚合（TanStack Query 驱动，无需手动内存缓存）

import { supabase } from '@/lib/supabase/client';
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

// ------- 查询 + 聚合 -------
export async function fetchTransactionsWithProfit(): Promise<TransactionWithProfit[]> {
  // 交易与销售记录并行拉取（原先是先取交易、再用全部交易 ID 拼 .in() 串行取销售）。
  // 不再需要 .in('transaction_id', ids)：sales_records 的 RLS 已限定为当前用户本人的行，
  // 与 transactions 的可见范围一致；去掉后请求 URL 不再随交易数量增长（565 笔时约 20KB）。
  const [txResult, srResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
      *,
      payment_method:payment_methods(id, name)
    `)
      .order('date', { ascending: false }),
    supabase
      .from('sales_records')
      .select('transaction_id, total_profit, actual_cash_spent, total_selling_price, sale_date, selling_platform_id, sale_order_number')
      .order('sale_date', { ascending: false }),
  ]);

  if (txResult.error) throw txResult.error;
  const txList = txResult.data || [];

  // 沿用原行为：销售记录查询失败不让整个列表失败，仅记录日志（此时利润等聚合列为空）
  if (srResult.error) console.error('加载销售记录失败:', srResult.error);
  const salesRows = (srResult.data as SalesRecordRow[] | null) || [];

  // 按 transaction_id 分组
  const salesByTx = new Map<string, SalesRecordRow[]>();
  salesRows.forEach(r => {
    const list = salesByTx.get(r.transaction_id) || [];
    list.push(r);
    salesByTx.set(r.transaction_id, list);
  });

  return txList.map(transaction => {
    const salesRecords = salesByTx.get(transaction.id) || [];

    let latest_sale_date: string | null = null;
    let aggregated_profit: number | null = null;
    let aggregated_roi: number | null = null;
    let aggregated_actual_cash_spent: number | null = null;
    let aggregated_total_selling_price: number | null = null;
    let aggregated_selling_platform_ids: string[] = [];

    if (salesRecords.length > 0) {
      latest_sale_date = salesRecords[0].sale_date;

      if (transaction.quantity_sold > 0) {
        aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);
        const totalCashSpent = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
        aggregated_actual_cash_spent = totalCashSpent;
        aggregated_roi = totalCashSpent > 0 ? (aggregated_profit / totalCashSpent) * 100 : 0;
        aggregated_total_selling_price = salesRecords.reduce((sum, r) => sum + (r.total_selling_price || 0), 0);
      }
      aggregated_selling_platform_ids = Array.from(
        new Set(salesRecords.map(r => r.selling_platform_id).filter(Boolean) as string[])
      );
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
  });
}

// ------- 单条刷新（mutation 后精准更新，避免全量重拉）-------
export async function fetchSingleTransaction(id: string): Promise<TransactionWithProfit> {
  const { data: tx, error } = await supabase
    .from('transactions')
    .select('*, payment_method:payment_methods(id, name)')
    .eq('id', id)
    .single();
  if (error || !tx) throw error ?? new Error('Transaction not found');

  const { data: srData } = await supabase
    .from('sales_records')
    .select('transaction_id, total_profit, actual_cash_spent, total_selling_price, sale_date, selling_platform_id, sale_order_number')
    .eq('transaction_id', id)
    .order('sale_date', { ascending: false });

  const salesRecords = (srData as SalesRecordRow[] | null) ?? [];

  let latest_sale_date: string | null = null;
  let aggregated_profit: number | null = null;
  let aggregated_roi: number | null = null;
  let aggregated_actual_cash_spent: number | null = null;
  let aggregated_total_selling_price: number | null = null;
  let aggregated_selling_platform_ids: string[] = [];

  if (salesRecords.length > 0) {
    latest_sale_date = salesRecords[0].sale_date;
    if (tx.quantity_sold > 0) {
      aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);
      const totalCashSpent = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
      aggregated_actual_cash_spent = totalCashSpent;
      aggregated_roi = totalCashSpent > 0 ? (aggregated_profit / totalCashSpent) * 100 : 0;
      aggregated_total_selling_price = salesRecords.reduce((sum, r) => sum + (r.total_selling_price || 0), 0);
    }
    aggregated_selling_platform_ids = Array.from(
      new Set(salesRecords.map(r => r.selling_platform_id).filter(Boolean) as string[])
    );
  }

  const aggregated_sale_order_numbers = salesRecords
    .map(r => r.sale_order_number)
    .filter(Boolean) as string[];

  return {
    ...tx,
    latest_sale_date,
    aggregated_profit,
    aggregated_roi,
    aggregated_actual_cash_spent,
    aggregated_total_selling_price,
    aggregated_selling_platform_ids,
    aggregated_sale_order_numbers,
  } as TransactionWithProfit;
}
