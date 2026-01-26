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
 * 积分记录
 */
export interface PointRecord {
  id: string;
  product_name: string;
  purchase_date: string;
  expected_platform_points: number;
  expected_card_points: number;
  extra_platform_points: number; // 额外平台积分
  point_status: 'pending' | 'received' | 'expired';
  total_points: number; // 积分的日元价值总和
  payment_method_name: string | null;
  card_id: string | null;
  platform_points_value: number; // 平台积分的日元价值
  card_points_value: number; // 信用卡积分的日元价值
  extra_platform_points_value: number; // 额外平台积分的日元价值
  platform_points_platform_name: string | null; // 平台积分平台名称
  card_points_platform_name: string | null; // 信用卡积分平台名称
  extra_platform_points_platform_name: string | null; // 额外平台积分平台名称
}

/**
 * 积分统计数据
 */
export interface PointsStats {
  total_pending_count: number;
  total_received_count: number;
  total_expired_count: number;
  total_pending_points: number;
  total_received_points: number;
  total_value: number;
}

/**
 * 获取指定状态的积分记录
 * @param status 积分状态 (pending | received | expired)，不传则返回所有
 */
export async function getPointsByStatus(
  status?: 'pending' | 'received' | 'expired'
): Promise<PointRecord[]> {
  let query = supabase
    .from('transactions')
    .select(`
      id,
      product_name,
      date,
      expected_platform_points,
      expected_card_points,
      extra_platform_points,
      point_status,
      card_id,
      payment_methods:card_id (
        name
      ),
      platform_points_platform:platform_points_platform_id (
        display_name,
        yen_conversion_rate
      ),
      card_points_platform:card_points_platform_id (
        display_name,
        yen_conversion_rate
      ),
      extra_platform_points_platform:extra_platform_points_platform_id (
        display_name,
        yen_conversion_rate
      )
    `)
    .not('expected_platform_points', 'is', null)
    .order('date', { ascending: false });

  if (status) {
    query = query.eq('point_status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取积分记录失败:', error);
    return [];
  }

  // 计算总积分并格式化数据
  return (data || []).map(record => {
    const platformPointsValue = (record.expected_platform_points || 0) *
      (record.platform_points_platform?.yen_conversion_rate || 1.0);
    const cardPointsValue = (record.expected_card_points || 0) *
      (record.card_points_platform?.yen_conversion_rate || 1.0);
    const extraPlatformPointsValue = (record.extra_platform_points || 0) *
      (record.extra_platform_points_platform?.yen_conversion_rate || 1.0);

    return {
      id: record.id,
      product_name: record.product_name,
      purchase_date: record.date,
      expected_platform_points: record.expected_platform_points,
      expected_card_points: record.expected_card_points,
      extra_platform_points: record.extra_platform_points || 0,
      point_status: record.point_status,
      total_points: platformPointsValue + cardPointsValue + extraPlatformPointsValue,
      payment_method_name: record.payment_methods?.name || null,
      card_id: record.card_id,
      platform_points_value: platformPointsValue,
      card_points_value: cardPointsValue,
      extra_platform_points_value: extraPlatformPointsValue,
      platform_points_platform_name: record.platform_points_platform?.display_name || null,
      card_points_platform_name: record.card_points_platform?.display_name || null,
      extra_platform_points_platform_name: record.extra_platform_points_platform?.display_name || null
    };
  });
}

/**
 * 获取积分统计数据（使用积分平台兑换率）
 */
export async function getPointsStats(): Promise<PointsStats> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      point_status,
      expected_platform_points,
      expected_card_points,
      extra_platform_points,
      platform_points_platform:platform_points_platform_id (
        yen_conversion_rate
      ),
      card_points_platform:card_points_platform_id (
        yen_conversion_rate
      ),
      extra_platform_points_platform:extra_platform_points_platform_id (
        yen_conversion_rate
      )
    `)
    .not('expected_platform_points', 'is', null);

  if (error) {
    console.error('获取积分统计失败:', error);
    return {
      total_pending_count: 0,
      total_received_count: 0,
      total_expired_count: 0,
      total_pending_points: 0,
      total_received_points: 0,
      total_value: 0,
    };
  }

  const stats = {
    total_pending_count: 0,
    total_received_count: 0,
    total_expired_count: 0,
    total_pending_points: 0,
    total_received_points: 0,
    total_value: 0,
  };

  (data || []).forEach(record => {
    const platformPointsValue = (record.expected_platform_points || 0) *
      (record.platform_points_platform?.yen_conversion_rate || 1.0);
    const cardPointsValue = (record.expected_card_points || 0) *
      (record.card_points_platform?.yen_conversion_rate || 1.0);
    const extraPlatformPointsValue = (record.extra_platform_points || 0) *
      (record.extra_platform_points_platform?.yen_conversion_rate || 1.0);
    const totalValue = platformPointsValue + cardPointsValue + extraPlatformPointsValue;

    if (record.point_status === 'pending') {
      stats.total_pending_count++;
      stats.total_pending_points += totalValue;
    } else if (record.point_status === 'received') {
      stats.total_received_count++;
      stats.total_received_points += totalValue;
      stats.total_value += totalValue;
    } else if (record.point_status === 'expired') {
      stats.total_expired_count++;
    }
  });

  return stats;
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