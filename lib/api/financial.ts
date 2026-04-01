// lib/api/financial.ts
// 财务数据 API 函数

import { supabase } from '@/lib/supabase/client';
import { getTodayString, formatDateToLocal } from '@/lib/utils/dateUtils';

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
 * 获取即将过期的优惠券
 * @param days 未来天数(默认3天)
 */
export async function getExpiringCoupons(days: number = 3) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('is_used', false)
    .gte('expiry_date', getTodayString())
    .lte('expiry_date', formatDateToLocal(targetDate))
    .order('expiry_date', { ascending: true });

  if (error) {
    console.error('获取即将过期的优惠券失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 获取当前在库数量（所有 in_stock 交易的 quantity_in_stock 之和）
 */
export async function getInStockCount(): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('quantity_in_stock')
    .eq('status', 'in_stock');

  if (error) {
    console.error('获取在库数量失败:', error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.quantity_in_stock || 0), 0);
}

/**
 * 获取本月利润（本月 sales_records 的 total_profit 之和）
 */
export async function getMonthlyProfit(): Promise<number> {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('sales_records')
    .select('total_profit')
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonthStr);

  if (error) {
    console.error('获取本月利润失败:', error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.total_profit || 0), 0);
}

/**
 * 获取本月销售件数（本月 sales_records 的数量）
 */
export async function getMonthlySalesCount(): Promise<number> {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

  const { count, error } = await supabase
    .from('sales_records')
    .select('*', { count: 'exact', head: true })
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonthStr);

  if (error) {
    console.error('获取本月销售件数失败:', error);
    return 0;
  }

  return count ?? 0;
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
 * 获取仪表盘统计数据
 */
export async function getDashboardStats(): Promise<{
  inStockCount: number;
  monthlyProfit: number;
  monthlySalesCount: number;
  expiringCoupons: any[];
  totalInvestment: number;
  totalRecovered: number;
  confirmedProfit: number;
  unrealizedStockCost: number;
  expectedPoints: number;
}> {
  const [
    inStockCount,
    monthlyProfit,
    monthlySalesCount,
    expiringCoupons,
    kpiData,
  ] = await Promise.all([
    getInStockCount(),
    getMonthlyProfit(),
    getMonthlySalesCount(),
    getExpiringCoupons(3),
    getDashboardKPI(),
  ]);

  return {
    inStockCount,
    monthlyProfit,
    monthlySalesCount,
    expiringCoupons,
    ...kpiData,
  };
}

/**
 * 获取 KPI 数据：总投资、回收、确定利益、未回收在库、期待ポイント
 */
async function getDashboardKPI(): Promise<{
  totalInvestment: number;
  totalRecovered: number;
  confirmedProfit: number;
  unrealizedStockCost: number;
  expectedPoints: number;
}> {
  const [transactionsRes, salesRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('purchase_price_total, unit_price, status, quantity_in_stock, expected_platform_points, expected_card_points, extra_platform_points'),
    supabase
      .from('sales_records')
      .select('total_selling_price, total_profit'),
  ]);

  const transactions = transactionsRes.data || [];
  const sales = salesRes.data || [];

  const totalInvestment = transactions.reduce((sum, t) => sum + (t.purchase_price_total || 0), 0);
  const totalRecovered = sales.reduce((sum, s) => sum + (s.total_selling_price || 0), 0);
  const confirmedProfit = sales.reduce((sum, s) => sum + (s.total_profit || 0), 0);

  const unrealizedStockCost = transactions.reduce((sum, t) => {
    if (t.status === 'awaiting_payment') {
      // 未入金：已售出但收款未到，以全额仕入成本计入未回収
      return sum + (t.purchase_price_total || 0);
    }
    if (t.status === 'in_stock' || t.status === 'pending') {
      return sum + ((t.unit_price || 0) * (t.quantity_in_stock || 0));
    }
    return sum;
  }, 0);

  const expectedPoints = transactions
    .filter(t => t.status === 'in_stock' || t.status === 'pending' || t.status === 'awaiting_payment')
    .reduce((sum, t) => sum + (t.expected_platform_points || 0) + (t.expected_card_points || 0) + (t.extra_platform_points || 0), 0);

  return { totalInvestment, totalRecovered, confirmedProfit, unrealizedStockCost, expectedPoints };
}
