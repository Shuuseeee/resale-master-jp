// lib/api/tax-report.ts
// 日本税务申报报表 API

import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database.types';

/**
 * 税务报表明细记录
 */
export interface TaxReportDetail {
  transactionId: string;
  transactionDate: string;
  productName: string;
  quantity: number;
  quantitySold: number;
  purchasePrice: number; // 购入价格
  sellingPrice: number; // 売却価格
  platformFee: number; // 平台手数料
  shippingFee: number; // 送料
  suppliesCost: number; // 耗材費
  pointsReward: number; // 積分回報（日元价值）
  cashProfit: number; // 现金利益
  totalProfit: number; // 総利益（含积分）
  notes: string;
}

/**
 * 税务报表年度汇总
 */
export interface TaxReportSummary {
  year: number;
  totalRevenue: number; // 総売上高（现金）
  totalPointsValue: number; // 積分収入
  totalIncome: number; // 総収入（现金 + 积分）
  totalExpenses: number; // 必要経費合計
  purchaseCosts: number; // 仕入れコスト
  platformFees: number; // 平台手数料
  shippingFees: number; // 送料
  suppliesCosts: number; // 耗材費
  netIncome: number; // 所得金額（収入 - 経費）
  cashIncome: number; // 现金収入
  transactionCount: number; // 取引件数
}

/**
 * 获取指定年度的所有已售交易记录
 */
async function getSoldTransactionsByYear(year: number): Promise<Transaction[]> {
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        payment_method:payment_methods(id, name),
        platform_points_platform:platform_points_platform_id(id, display_name, yen_conversion_rate),
        card_points_platform:card_points_platform_id(id, display_name, yen_conversion_rate),
        extra_platform_points_platform:extra_platform_points_platform_id(id, display_name, yen_conversion_rate)
      `)
      .eq('status', 'sold')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('获取年度交易记录失败:', error);
    return [];
  }
}

/**
 * 计算交易的积分价值（日元）
 */
function calculatePointsValue(transaction: any): number {
  let totalPointsValue = 0;

  // 平台积分价值
  if (transaction.expected_platform_points && transaction.platform_points_platform) {
    const rate = (transaction.platform_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.expected_platform_points * rate;
  }

  // 信用卡积分价值
  if (transaction.expected_card_points && transaction.card_points_platform) {
    const rate = (transaction.card_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.expected_card_points * rate;
  }

  // 额外平台积分价值
  if (transaction.extra_platform_points && transaction.extra_platform_points_platform) {
    const rate = (transaction.extra_platform_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.extra_platform_points * rate;
  }

  return totalPointsValue;
}

/**
 * 获取年度耗材成本
 */
async function getYearlySuppliesCosts(year: number): Promise<number> {
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from('supplies_costs')
      .select('amount')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);

    if (error) throw error;

    return (data || []).reduce((sum, item) => sum + item.amount, 0);
  } catch (error) {
    console.error('获取年度耗材成本失败:', error);
    return 0;
  }
}

/**
 * 生成税务报表明细
 */
export async function generateTaxReportDetails(year: number): Promise<TaxReportDetail[]> {
  try {
    const transactions = await getSoldTransactionsByYear(year);

    const details: TaxReportDetail[] = transactions.map(transaction => {
      const pointsValue = calculatePointsValue(transaction);
      const cashProfit = transaction.cash_profit || 0;
      const totalProfit = transaction.total_profit || 0;

      return {
        transactionId: transaction.id,
        transactionDate: transaction.date,
        productName: transaction.product_name,
        quantity: transaction.quantity || 1,
        quantitySold: transaction.quantity_sold || 1,
        purchasePrice: transaction.purchase_price_total,
        sellingPrice: transaction.selling_price || 0,
        platformFee: transaction.platform_fee || 0,
        shippingFee: transaction.shipping_fee || 0,
        suppliesCost: 0, // 耗材成本在汇总中统一计算
        pointsReward: pointsValue,
        cashProfit: cashProfit,
        totalProfit: totalProfit,
        notes: transaction.notes || '',
      };
    });

    return details;
  } catch (error) {
    console.error('生成税务报表明细失败:', error);
    return [];
  }
}

/**
 * 生成税务报表年度汇总
 */
export async function generateTaxReportSummary(year: number): Promise<TaxReportSummary> {
  try {
    const transactions = await getSoldTransactionsByYear(year);
    const yearlySuppliesCosts = await getYearlySuppliesCosts(year);

    // 计算各项指标
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.selling_price || 0), 0);
    const totalPointsValue = transactions.reduce((sum, t) => sum + calculatePointsValue(t), 0);
    const totalIncome = totalRevenue + totalPointsValue;

    const purchaseCosts = transactions.reduce((sum, t) => sum + t.purchase_price_total, 0);
    const platformFees = transactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
    const shippingFees = transactions.reduce((sum, t) => sum + (t.shipping_fee || 0), 0);

    const totalExpenses = purchaseCosts + platformFees + shippingFees + yearlySuppliesCosts;
    const netIncome = totalIncome - totalExpenses;
    const cashIncome = totalRevenue - (purchaseCosts + platformFees + shippingFees + yearlySuppliesCosts);

    return {
      year,
      totalRevenue,
      totalPointsValue,
      totalIncome,
      totalExpenses,
      purchaseCosts,
      platformFees,
      shippingFees,
      suppliesCosts: yearlySuppliesCosts,
      netIncome,
      cashIncome,
      transactionCount: transactions.length,
    };
  } catch (error) {
    console.error('生成税务报表汇总失败:', error);
    return {
      year,
      totalRevenue: 0,
      totalPointsValue: 0,
      totalIncome: 0,
      totalExpenses: 0,
      purchaseCosts: 0,
      platformFees: 0,
      shippingFees: 0,
      suppliesCosts: 0,
      netIncome: 0,
      cashIncome: 0,
      transactionCount: 0,
    };
  }
}

/**
 * 获取可用的年份列表
 */
export async function getAvailableYears(): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('date')
      .order('date', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [new Date().getFullYear()];
    }

    // 提取所有年份并去重
    const years = data
      .map(t => new Date(t.date).getFullYear())
      .filter((year, index, self) => self.indexOf(year) === index)
      .sort((a, b) => b - a); // 降序排列

    return years;
  } catch (error) {
    console.error('获取可用年份列表失败:', error);
    return [new Date().getFullYear()];
  }
}
