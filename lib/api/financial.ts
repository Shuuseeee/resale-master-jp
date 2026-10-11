// lib/api/financial.ts
// 财务数据 API 函数

import { supabase } from '@/lib/supabase/client';

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
