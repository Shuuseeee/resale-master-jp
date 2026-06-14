// lib/api/sales-records.ts
// 销售记录 API 函数

import { supabase } from '@/lib/supabase/client';
import type { SalesRecord, SalesRecordFormData } from '@/types/database.types';

// ============================================================
// 利润计算 helper（纯同步函数，供 create/update/批量售出共用）
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
  expected_platform_points: number;
  expected_card_points: number;
  extra_platform_points: number;
  platform_points_platform_id: string | null;
  card_points_platform_id: string | null;
  extra_platform_points_platform_id: string | null;
}

export interface SaleMathResult {
  cash_profit: number;
  total_profit: number;
  roi: number;
  actual_cash_spent: number;
}

/**
 * 计算单次售出的利润与ROI（纯同步，无副作用）
 * 积分当前按 1:1（1点=1円）计算，platformId 为 null 时积分价值为 0
 */
export function computeSaleProfit(input: SaleMathInput, tx: SaleMathTxBasis): SaleMathResult {
  const costPerUnit = tx.purchase_price_total / tx.quantity;
  const totalCost = costPerUnit * input.quantity_sold;
  const totalSellingPrice = input.selling_price_per_unit * input.quantity_sold;
  const cashProfit = totalSellingPrice - totalCost - input.platform_fee - input.shipping_fee;

  const pointsRatio = input.quantity_sold / tx.quantity;

  // All points are 1:1 (1 point = 1 yen); platformId null → 0
  const platformPointsValue = (tx.expected_platform_points && tx.platform_points_platform_id)
    ? tx.expected_platform_points * pointsRatio : 0;
  const cardPointsValue = (tx.expected_card_points && tx.card_points_platform_id)
    ? tx.expected_card_points * pointsRatio : 0;
  const extraPointsValue = (tx.extra_platform_points && tx.extra_platform_points_platform_id)
    ? tx.extra_platform_points * pointsRatio : 0;

  const totalProfit = cashProfit + platformPointsValue + cardPointsValue + extraPointsValue;
  const actualCashSpent = tx.purchase_price_total * pointsRatio;
  const roi = actualCashSpent > 0 ? (totalProfit / actualCashSpent) * 100 : 0;

  return { cash_profit: cashProfit, total_profit: totalProfit, roi, actual_cash_spent: actualCashSpent };
}

/**
 * 创建销售记录
 * @param transactionId 交易ID
 * @param formData 销售记录表单数据
 * @param transaction 交易信息（用于计算利润和ROI）
 */
export async function createSalesRecord(
  transactionId: string,
  formData: SalesRecordFormData,
  transaction: SaleMathTxBasis & { point_paid: number; date: string }
): Promise<{ data: SalesRecord | null; error: any }> {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: '未登录' } };
    }

    const { cash_profit, total_profit, roi, actual_cash_spent } = computeSaleProfit(formData, transaction);

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
        cash_profit,
        total_profit,
        roi,
        actual_cash_spent,
        selling_platform_id: formData.selling_platform_id || null,
        sale_order_number: formData.sale_order_number || null,
        notes: formData.notes || null,
      })
      .select()
      .single();

    // 更新 transaction 的聚合 ROI
    if (data) {
      await updateTransactionROI(transactionId);
    }

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
 * 更新销售记录（重新计算利润）
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
  transaction: SaleMathTxBasis & { point_paid: number; date: string }
): Promise<{ data: SalesRecord | null; error: any }> {
  try {
    const { cash_profit, total_profit, roi, actual_cash_spent } = computeSaleProfit(formData, transaction);

    const { data, error } = await supabase
      .from('sales_records')
      .update({
        sale_date: formData.sale_date,
        quantity_sold: formData.quantity_sold,
        selling_price_per_unit: formData.selling_price_per_unit,
        platform_fee: formData.platform_fee,
        shipping_fee: formData.shipping_fee,
        notes: formData.notes || null,
        cash_profit,
        total_profit,
        roi,
        actual_cash_spent,
      })
      .eq('id', recordId)
      .select()
      .single();

    // 更新 transaction 的聚合 ROI
    if (data) {
      await updateTransactionROI(data.transaction_id);
    }

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
  // 删除前先查 transaction_id，以便删除后更新聚合 ROI
  const { data: record } = await supabase
    .from('sales_records')
    .select('transaction_id')
    .eq('id', recordId)
    .single();

  const { error } = await supabase
    .from('sales_records')
    .delete()
    .eq('id', recordId);

  if (error) {
    console.error('删除销售记录失败:', error);
    return false;
  }

  // 删除后更新 transaction 的聚合 ROI
  if (record) {
    await updateTransactionROI(record.transaction_id);
  }

  return true;
}

/**
 * 从 sales_records 聚合利润和 ROI，写入 transactions 表
 */
export async function updateTransactionROI(transactionId: string): Promise<void> {
  const { data: records } = await supabase
    .from('sales_records')
    .select('total_profit, actual_cash_spent, cash_profit')
    .eq('transaction_id', transactionId);

  if (!records || records.length === 0) {
    await supabase.from('transactions')
      .update({ cash_profit: null, total_profit: null, roi: null })
      .eq('id', transactionId);
    return;
  }

  const totalProfit = records.reduce((sum, r) => sum + (r.total_profit || 0), 0);
  const totalCashProfit = records.reduce((sum, r) => sum + (r.cash_profit || 0), 0);
  const totalCashSpent = records.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
  const roi = totalCashSpent > 0 ? (totalProfit / totalCashSpent) * 100 : 0;

  await supabase.from('transactions')
    .update({ cash_profit: totalCashProfit, total_profit: totalProfit, roi })
    .eq('id', transactionId);
}
