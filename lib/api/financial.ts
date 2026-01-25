// lib/api/financial.ts
// 财务数据 API 函数

import { supabase } from '@/lib/supabase/client';

/**
 * 财务安全水位线数据
 */
export interface WaterLevelData {
  total_balance: number;
  upcoming_payments_30d: number;
  upcoming_payments_7d: number;
  expiring_coupons_3d: number;
  expiring_points_7d: number;
}

/**
 * 即将到期的支付
 */
export interface UpcomingPayment {
  payment_method_name: string;
  expected_payment_date: string;
  total_amount: number;
  transaction_count: number;
  payment_method_id: string;
}

/**
 * 待确认积分
 */
export interface PendingPoint {
  id: string;
  product_name: string;
  purchase_date: string;
  expected_platform_points: number;
  expected_card_points: number;
  points_expiry_date: string | null;
  total_points: number;
  payment_method_name: string | null;
  point_conversion_rate: number;
  urgency_level: 'urgent' | 'warning' | 'normal';
}

/**
 * 银行账户
 */
export interface BankAccount {
  id: string;
  name: string;
  account_type: 'checking' | 'savings' | 'wallet';
  current_balance: number;
  currency: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 获取财务安全水位线数据
 */
export async function getWaterLevelData(): Promise<WaterLevelData | null> {
  const { data, error } = await supabase
    .from('financial_water_level')
    .select('*')
    .single();

  if (error) {
    console.error('获取财务水位线失败:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log('Water level data:', data);
  return data;
}

/**
 * 获取即将到期的支付
 * @param days 未来天数(默认30天)
 */
export async function getUpcomingPayments(days: number = 30): Promise<UpcomingPayment[]> {
  const { data, error } = await supabase
    .from('upcoming_payments')
    .select('*')
    .lte('expected_payment_date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('expected_payment_date', { ascending: true });

  if (error) {
    console.error('获取即将到期的支付失败:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return [];
  }

  console.log('Upcoming payments data:', data);
  return data || [];
}

/**
 * 获取待确认积分列表
 */
export async function getPendingPoints(): Promise<PendingPoint[]> {
  const { data, error } = await supabase
    .from('pending_points')
    .select('*')
    .order('urgency_level', { ascending: true })
    .order('points_expiry_date', { ascending: true });

  if (error) {
    console.error('获取待确认积分失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 确认积分已收到
 * @param transactionId 交易ID
 */
export async function confirmPointsReceived(transactionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({ point_status: 'received' })
    .eq('id', transactionId);

  if (error) {
    console.error('确认积分失败:', error);
    return false;
  }

  return true;
}

/**
 * 批量确认积分
 * @param transactionIds 交易ID数组
 */
export async function batchConfirmPoints(transactionIds: string[]): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ point_status: 'received' })
    .in('id', transactionIds)
    .select('id');

  if (error) {
    console.error('批量确认积分失败:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * 获取所有银行账户
 */
export async function getBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('获取银行账户失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 更新银行账户余额
 * @param accountId 账户ID
 * @param newBalance 新余额
 */
export async function updateBankBalance(
  accountId: string,
  newBalance: number
): Promise<boolean> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({ current_balance: newBalance })
    .eq('id', accountId);

  if (error) {
    console.error('更新银行余额失败:', error);
    return false;
  }

  return true;
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
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .lte('expiry_date', targetDate.toISOString().split('T')[0])
    .order('expiry_date', { ascending: true });

  if (error) {
    console.error('获取即将过期的优惠券失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 获取仪表盘统计数据
 */
export async function getDashboardStats() {
  const [
    waterLevel,
    upcomingPayments,
    pendingPoints,
    expiringCoupons,
    bankAccounts,
  ] = await Promise.all([
    getWaterLevelData(),
    getUpcomingPayments(30),
    getPendingPoints(),
    getExpiringCoupons(3),
    getBankAccounts(),
  ]);

  return {
    waterLevel,
    upcomingPayments,
    pendingPoints,
    expiringCoupons,
    bankAccounts,
  };
}