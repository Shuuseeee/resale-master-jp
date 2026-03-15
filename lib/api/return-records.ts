// lib/api/return-records.ts
// 退货记录 API

import { supabase } from '@/lib/supabase/client';
import type { ReturnRecord, ReturnRecordFormData } from '@/types/database.types';

/**
 * 创建退货记录
 */
export async function createReturnRecord(
  transactionId: string,
  formData: ReturnRecordFormData
): Promise<{ data: ReturnRecord | null; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: '未登录' } };
    }

    const { data, error } = await supabase
      .from('return_records')
      .insert({
        transaction_id: transactionId,
        user_id: user.id,
        quantity_returned: formData.quantity_returned,
        return_date: formData.return_date,
        return_amount: formData.return_amount || 0,
        points_deducted: formData.points_deducted || 0,
        return_reason: formData.return_reason || null,
        notes: formData.notes || null,
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('创建退货记录失败:', error);
    return { data: null, error };
  }
}

/**
 * 获取交易的所有退货记录
 */
export async function getReturnRecords(transactionId: string): Promise<ReturnRecord[]> {
  const { data, error } = await supabase
    .from('return_records')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('return_date', { ascending: false });

  if (error) {
    console.error('获取退货记录失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 删除退货记录
 */
export async function deleteReturnRecord(recordId: string): Promise<boolean> {
  const { error } = await supabase
    .from('return_records')
    .delete()
    .eq('id', recordId);

  if (error) {
    console.error('删除退货记录失败:', error);
    return false;
  }

  return true;
}
