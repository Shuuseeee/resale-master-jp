// lib/api/financial.ts
// 财务数据 API 函数

import { supabase } from '@/lib/supabase/client';

export interface PendingArrivalTransaction {
  id: string;
  product_name: string;
  date: string;
  quantity: number;
  order_number: string | null;
  purchase_platforms: { name: string } | null;
}

/**
 * 根据 JAN 码查找未着荷的交易
 */
export async function getTransactionsByJanCode(janCode: string): Promise<PendingArrivalTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, product_name, date, quantity, order_number, purchase_platforms!purchase_platform_id(name)')
    .eq('jan_code', janCode)
    .eq('status', 'pending')
    .order('date', { ascending: false });

  if (error) {
    console.error('JAN码查询失败:', error);
    return [];
  }
  return (data ?? []) as unknown as PendingArrivalTransaction[];
}

/**
 * 标记交易为已到着（pending → in_stock）
 */
export async function markTransactionArrived(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'in_stock' })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    console.error('标记到着失败:', error);
    return false;
  }
  return true;
}

/**
 * 确认入金（awaiting_payment → sold）
 */
export async function confirmPaymentReceived(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'sold' })
    .eq('id', id)
    .eq('status', 'awaiting_payment');

  if (error) {
    console.error('入金確認失敗:', error);
    return false;
  }
  return true;
}

/**
 * 批量确认入金（awaiting_payment → sold）
 * 返回实际确认和跳过的数量，保证幂等
 */
export async function confirmBatchPaymentReceived(ids: string[]): Promise<{ confirmed: number; skipped: number }> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'sold' })
    .in('id', ids)
    .eq('status', 'awaiting_payment')
    .select('id');

  if (error) {
    console.error('批量入金确认失败:', error);
    return { confirmed: 0, skipped: ids.length };
  }

  const confirmed = (data || []).length;
  return { confirmed, skipped: ids.length - confirmed };
}
