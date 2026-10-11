// lib/api/supplies.ts
// 经费（supplies_costs）API

import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
import type { SuppliesCost, SuppliesCostFormData } from '@/types/database.types';

/**
 * 获取所有耗材成本记录
 */
export async function getSuppliesCosts(): Promise<SuppliesCost[]> {
  // 失败即抛错：耗材列表已入离线缓存，返回 [] 会被当成成功的空列表并持久化（唯一调用方是耗材页）。
  // 分页取全：超过单次行数上限（默认 1000）会静默截断。
  return fetchAllRows<SuppliesCost>((from, to, opts) =>
    supabase
      .from('supplies_costs')
      .select('*', opts)
      .order('purchase_date', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

/**
 * 创建耗材成本记录
 */
export async function createSuppliesCost(
  formData: SuppliesCostFormData
): Promise<{ data: SuppliesCost | null; error: any }> {
  try {
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('获取用户信息失败:', authError);
      return { data: null, error: { message: '获取用户信息失败: ' + authError.message } };
    }

    if (!user) {
      console.error('用户未登录');
      return { data: null, error: { message: '用户未登录，请先登录' } };
    }

    // 插入数据
    const { data, error } = await supabase
      .from('supplies_costs')
      .insert({
        user_id: user.id,
        category: formData.category,
        amount: formData.amount,
        purchase_date: formData.purchase_date,
        description: formData.description || null,
        notes: formData.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('创建耗材成本失败:', error);
      return { data: null, error: { message: error.message, details: error } };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('创建耗材成本异常:', err);
    return { data: null, error: { message: err.message || '创建失败' } };
  }
}

/**
 * 删除耗材成本记录
 */
export async function deleteSuppliesCost(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('supplies_costs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除耗材成本失败:', error);
    return false;
  }

  return true;
}
