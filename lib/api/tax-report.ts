// lib/api/tax-report.ts
// 確定申告レポート API

import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database.types';

/**
 * 税務レポート明細記録
 */
export interface TaxReportDetail {
  transactionId: string;
  transactionDate: string;
  productName: string;
  quantity: number;
  quantitySold: number;
  purchasePrice: number; // 購入価格
  sellingPrice: number; // 売却価格
  platformFee: number; // 販売手数料
  shippingFee: number; // 送料
  suppliesCost: number; // 消耗品費
  pointsReward: number; // ポイント還元（円換算）
  cashProfit: number; // 現金利益
  totalProfit: number; // 総利益（ポイント含む）
  notes: string;
}

/**
 * 税務レポート年度集計
 */
export interface TaxReportSummary {
  year: number;
  totalRevenue: number; // 売上高（現金）
  totalPointsValue: number; // ポイント収入
  totalIncome: number; // 総収入（現金 + ポイント）
  totalExpenses: number; // 必要経費合計
  purchaseCosts: number; // 仕入費
  platformFees: number; // 販売手数料
  shippingFees: number; // 送料
  suppliesCosts: number; // 消耗品費
  netIncome: number; // 所得金額（収入 - 経費）
  cashIncome: number; // 現金収入
  transactionCount: number; // 取引件数
}

/**
 * 指定年度の売却済み取引を取得
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
    console.error('年度取引記録の取得に失敗:', error);
    return [];
  }
}

/**
 * 取引のポイント価値を計算（円換算）
 */
function calculatePointsValue(transaction: any): number {
  let totalPointsValue = 0;

  // プラットフォームポイント価値
  if (transaction.expected_platform_points && transaction.platform_points_platform) {
    const rate = (transaction.platform_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.expected_platform_points * rate;
  }

  // クレジットカードポイント価値
  if (transaction.expected_card_points && transaction.card_points_platform) {
    const rate = (transaction.card_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.expected_card_points * rate;
  }

  // 追加プラットフォームポイント価値
  if (transaction.extra_platform_points && transaction.extra_platform_points_platform) {
    const rate = (transaction.extra_platform_points_platform as any).yen_conversion_rate || 1.0;
    totalPointsValue += transaction.extra_platform_points * rate;
  }

  return totalPointsValue;
}

/**
 * 年度消耗品費を取得
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
    console.error('年度消耗品費の取得に失敗:', error);
    return 0;
  }
}

/**
 * 税務レポート明細を生成
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
        suppliesCost: 0, // 消耗品費は集計で一括計算
        pointsReward: pointsValue,
        cashProfit: cashProfit,
        totalProfit: totalProfit,
        notes: transaction.notes || '',
      };
    });

    return details;
  } catch (error) {
    console.error('税務レポート明細の生成に失敗:', error);
    return [];
  }
}

/**
 * 税務レポート年度集計を生成
 */
export async function generateTaxReportSummary(year: number): Promise<TaxReportSummary> {
  try {
    const transactions = await getSoldTransactionsByYear(year);
    const yearlySuppliesCosts = await getYearlySuppliesCosts(year);

    // 各項目を計算
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
    console.error('税務レポート集計の生成に失敗:', error);
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
 * 利用可能な年度リストを取得
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

    // 全年度を抽出して重複を削除
    const years = data
      .map(t => new Date(t.date).getFullYear())
      .filter((year, index, self) => self.indexOf(year) === index)
      .sort((a, b) => b - a); // 降順

    return years;
  } catch (error) {
    console.error('利用可能な年度リストの取得に失敗:', error);
    return [new Date().getFullYear()];
  }
}
