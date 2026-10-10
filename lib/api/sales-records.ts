// lib/api/sales-records.ts
// 销售记录 API 函数

import { supabase } from '@/lib/supabase/client';
import type { SalesRecord, SalesRecordFormData } from '@/types/database.types';

// ============================================================
// 利润计算 helper（只用于表单里的实时预览）
// 实际存库的利润由数据库触发器 calc_sale_profit / calc_transaction_profit 计算（supabase/schema.sql），
// 两边公式必须一致（与买取X 相同）：
//   单位成本 =（采购总价 − 网站积分 − 信用卡积分 − 其他积分）÷ 数量
//   利润 = 售价 × 数量 − 平台手续费 − 运费 − 单位成本 × 数量；现金利润同式但成本不减积分
// ============================================================

export interface SaleMathInput {
  quantity_sold: number;
  selling_price_per_unit: number;
  platform_fee: number;
  shipping_fee: number;
}

export interface SaleMathTxBasis {
  purchase_price_total: number;
  quantity: number;
  expected_platform_points: number | null;
  expected_card_points: number | null;
  extra_platform_points: number | null;
}

export interface SaleMathResult {
  cash_profit: number;
  total_profit: number;
  roi: number;
  actual_cash_spent: number;
}

export function computeSaleProfit(input: SaleMathInput, tx: SaleMathTxBasis): SaleMathResult {
  const quantity = tx.quantity || 1;
  const points = (tx.expected_platform_points || 0) + (tx.expected_card_points || 0) + (tx.extra_platform_points || 0);
  const grossUnit = tx.purchase_price_total / quantity;
  const netUnit = (tx.purchase_price_total - points) / quantity;
  const revenue = input.selling_price_per_unit * input.quantity_sold;
  const fees = input.platform_fee + input.shipping_fee;
  const basis = netUnit * input.quantity_sold;
  const totalProfit = revenue - fees - basis;

  return {
    cash_profit: revenue - fees - grossUnit * input.quantity_sold,
    total_profit: totalProfit,
    roi: basis > 0 ? (totalProfit / basis) * 100 : 0,
    actual_cash_spent: basis,
  };
}

/**
 * 创建销售记录
 * 利润由数据库触发器计算，交易上的利润合计也由触发器维护
 */
export async function createSalesRecord(
  transactionId: string,
  formData: SalesRecordFormData,
): Promise<{ data: SalesRecord | null; error: any }> {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: '未登录' } };
    }

    // 插入销售记录
    const { data, error } = await supabase
      .from('sales_records')
      .insert({
        transaction_id: transactionId,
        user_id: user.id,
        quantity_sold: formData.quantity_sold,
        selling_price_per_unit: formData.selling_price_per_unit,
        platform_fee: formData.platform_fee,
        shipping_fee: formData.shipping_fee,
        sale_date: formData.sale_date,
        selling_platform_id: formData.selling_platform_id || null,
        sale_order_number: formData.sale_order_number || null,
        notes: formData.notes || null,
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('创建销售记录失败:', error);
    return { data: null, error };
  }
}

/**
 * 获取交易的所有销售记录
 */
export async function getSalesRecords(transactionId: string): Promise<SalesRecord[]> {
  const { data, error } = await supabase
    .from('sales_records')
    .select('*, selling_platform:selling_platform_id(id, name)')
    .eq('transaction_id', transactionId)
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('获取销售记录失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 更新销售记录（利润由数据库触发器重算）
 */
export async function updateSalesRecord(
  recordId: string,
  formData: {
    sale_date: string;
    quantity_sold: number;
    selling_price_per_unit: number;
    platform_fee: number;
    shipping_fee: number;
    notes: string;
  },
): Promise<{ data: SalesRecord | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('sales_records')
      .update({
        sale_date: formData.sale_date,
        quantity_sold: formData.quantity_sold,
        selling_price_per_unit: formData.selling_price_per_unit,
        platform_fee: formData.platform_fee,
        shipping_fee: formData.shipping_fee,
        notes: formData.notes || null,
      })
      .eq('id', recordId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('更新销售记录失败:', error);
    return { data: null, error };
  }
}

/**
 * 删除销售记录
 */
export async function deleteSalesRecord(recordId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sales_records')
    .delete()
    .eq('id', recordId);

  if (error) {
    console.error('删除销售记录失败:', error);
    return false;
  }

  return true;
}
