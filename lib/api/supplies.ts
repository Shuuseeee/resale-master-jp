// lib/api/supplies.ts
// 耗材成本管理API

import { supabase } from '@/lib/supabase/client';
import type { SuppliesCost, SuppliesCostFormData } from '@/types/database.types';

/**
 * 获取所有耗材成本记录
 */
export async function getSuppliesCosts(): Promise<SuppliesCost[]> {
  const { data, error } = await supabase
    .from('supplies_costs')
    .select('*')
    .order('purchase_date', { ascending: false });

  if (error) {
    console.error('获取耗材成本失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 获取指定时间范围的耗材成本
 */
export async function getSuppliesCostsByDateRange(
  startDate: string,
  endDate: string
): Promise<SuppliesCost[]> {
  const { data, error } = await supabase
    .from('supplies_costs')
    .select('*')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDate)
    .order('purchase_date', { ascending: false });

  if (error) {
    console.error('获取耗材成本失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 获取单个耗材成本记录
 */
export async function getSuppliesCost(id: string): Promise<SuppliesCost | null> {
  const { data, error } = await supabase
    .from('supplies_costs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('获取耗材成本失败:', error);
    return null;
  }

  return data;
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

    console.log('当前用户ID:', user.id);

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

    console.log('创建成功:', data);
    return { data, error: null };
  } catch (err: any) {
    console.error('创建耗材成本异常:', err);
    return { data: null, error: { message: err.message || '创建失败' } };
  }
}

/**
 * 更新耗材成本记录
 */
export async function updateSuppliesCost(
  id: string,
  formData: SuppliesCostFormData
): Promise<{ data: SuppliesCost | null; error: any }> {
  const { data, error } = await supabase
    .from('supplies_costs')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('更新耗材成本失败:', error);
    return { data: null, error };
  }

  return { data, error: null };
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

/**
 * 计算指定月份的耗材成本总额
 */
export async function getMonthlySuppliesCost(year: number, month: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('supplies_costs')
    .select('amount')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDate);

  if (error) {
    console.error('获取月度耗材成本失败:', error);
    return 0;
  }

  return data?.reduce((sum, item) => sum + item.amount, 0) || 0;
}

/**
 * 计算耗材成本分摊（按交易数量分摊）
 */
export async function calculateSuppliesCostAllocation(
  transactionDate: string,
  transactionCount: number = 1
): Promise<number> {
  const date = new Date(transactionDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // 获取当月耗材总成本
  const monthlyCost = await getMonthlySuppliesCost(year, month);

  // 获取当月交易总数
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !count || count === 0) {
    return 0;
  }

  // 按交易数量平均分摊
  return monthlyCost / count;
}
