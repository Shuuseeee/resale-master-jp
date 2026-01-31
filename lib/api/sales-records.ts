// lib/api/sales-records.ts
// 销售记录 API 函数

import { supabase } from '@/lib/supabase/client';
import type { SalesRecord, SalesRecordFormData } from '@/types/database.types';
import { calculateSuppliesCostAllocation } from '@/lib/api/supplies';

/**
 * 创建销售记录
 * @param transactionId 交易ID
 * @param formData 销售记录表单数据
 * @param transaction 交易信息（用于计算利润和ROI）
 */
export async function createSalesRecord(
  transactionId: string,
  formData: SalesRecordFormData,
  transaction: {
    purchase_price_total: number;
    point_paid: number;
    quantity: number;
    expected_platform_points: number;
    expected_card_points: number;
    extra_platform_points: number;
    platform_points_platform_id: string | null;
    card_points_platform_id: string | null;
    extra_platform_points_platform_id: string | null;
    date: string; // 添加交易日期用于耗材成本分摊
  }
): Promise<{ data: SalesRecord | null; error: any }> {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: { message: '未登录' } };
    }

    // 计算单个商品的成本
    const costPerUnit = transaction.purchase_price_total / transaction.quantity;
    const totalCost = costPerUnit * formData.quantity_sold;

    // 计算耗材成本分摊
    const suppliesCostAllocation = await calculateSuppliesCostAllocation(
      transaction.date,
      formData.quantity_sold
    );

    // 计算总售价
    const totalSellingPrice = formData.selling_price_per_unit * formData.quantity_sold;

    // 计算现金利润（包含耗材成本）
    const cashProfit = totalSellingPrice - totalCost - formData.platform_fee - formData.shipping_fee - suppliesCostAllocation;

    // 计算积分价值（按比例分配）
    const pointsRatio = formData.quantity_sold / transaction.quantity;

    // 获取积分平台兑换率
    const platformPointsValue = await getPointsValue(
      transaction.expected_platform_points * pointsRatio,
      transaction.platform_points_platform_id
    );
    const cardPointsValue = await getPointsValue(
      transaction.expected_card_points * pointsRatio,
      transaction.card_points_platform_id
    );
    const extraPointsValue = await getPointsValue(
      transaction.extra_platform_points * pointsRatio,
      transaction.extra_platform_points_platform_id
    );

    const totalPointsValue = platformPointsValue + cardPointsValue + extraPointsValue;

    // 计算总利润
    const totalProfit = cashProfit + totalPointsValue;

    // 计算实际现金支出（按比例，包含耗材成本）
    const actualCashSpent = ((transaction.purchase_price_total - transaction.point_paid) * pointsRatio) + suppliesCostAllocation;

    // 计算 ROI
    const roi = actualCashSpent > 0 ? (totalProfit / actualCashSpent) * 100 : 0;

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
        cash_profit: cashProfit,
        total_profit: totalProfit,
        roi: roi,
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
 * 获取积分价值
 */
async function getPointsValue(points: number, platformId: string | null): Promise<number> {
  if (!points || !platformId) return 0;

  const { data } = await supabase
    .from('points_platforms')
    .select('yen_conversion_rate')
    .eq('id', platformId)
    .single();

  return points * (data?.yen_conversion_rate || 1.0);
}

/**
 * 获取交易的所有销售记录
 */
export async function getSalesRecords(transactionId: string): Promise<SalesRecord[]> {
  const { data, error } = await supabase
    .from('sales_records')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('sale_date', { ascending: false });

  if (error) {
    console.error('获取销售记录失败:', error);
    return [];
  }

  return data || [];
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
