// lib/api/tax-report.ts
// 確定申告レポート API

import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database.types';

/**
 * 税務レポート明細記録
 */
export interface TaxReportDetail {
  transactionId: string;
  saleRecordId: string; // 販売記録ID
  saleDate: string; // 販売日（税務申告の基準日）
  purchaseDate: string; // 購入日（参考）
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
 * 指定年度の販売記録を取得（販売日基準）
 */
async function getSalesRecordsByYear(year: number): Promise<any[]> {
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from('sales_records')
      .select(`
        *,
        transaction:transaction_id(
          id,
          date,
          product_name,
          quantity,
          purchase_price_total,
          point_paid,
          expected_platform_points,
          expected_card_points,
          extra_platform_points,
          platform_points_platform_id,
          card_points_platform_id,
          extra_platform_points_platform_id,
          notes
        )
      `)
      .not('sale_date', 'is', null)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('年度販売記録の取得に失敗:', error);
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
 * 税務レポート明細を生成（販売記録ベース）
 */
export async function generateTaxReportDetails(year: number): Promise<TaxReportDetail[]> {
  try {
    const salesRecords = await getSalesRecordsByYear(year);

    // 積分平台情報を取得
    const { data: platforms } = await supabase
      .from('points_platforms')
      .select('*');

    const platformsMap = new Map((platforms || []).map(p => [p.id, p]));

    const details: TaxReportDetail[] = salesRecords.map(record => {
      const transaction = record.transaction as any;

      // 販売数量に応じたポイント価値を計算
      const pointsRatio = record.quantity_sold / (transaction?.quantity || 1);

      let pointsValue = 0;

      // プラットフォームポイント
      if (transaction?.expected_platform_points && transaction?.platform_points_platform_id) {
        const platform = platformsMap.get(transaction.platform_points_platform_id);
        const rate = platform?.yen_conversion_rate || 1.0;
        pointsValue += (transaction.expected_platform_points * pointsRatio) * rate;
      }

      // クレジットカードポイント
      if (transaction?.expected_card_points && transaction?.card_points_platform_id) {
        const platform = platformsMap.get(transaction.card_points_platform_id);
        const rate = platform?.yen_conversion_rate || 1.0;
        pointsValue += (transaction.expected_card_points * pointsRatio) * rate;
      }

      // 追加プラットフォームポイント
      if (transaction?.extra_platform_points && transaction?.extra_platform_points_platform_id) {
        const platform = platformsMap.get(transaction.extra_platform_points_platform_id);
        const rate = platform?.yen_conversion_rate || 1.0;
        pointsValue += (transaction.extra_platform_points * pointsRatio) * rate;
      }

      // 購入価格を数量で按分
      const costPerUnit = (transaction?.purchase_price_total || 0) / (transaction?.quantity || 1);
      const allocatedPurchasePrice = costPerUnit * record.quantity_sold;

      return {
        transactionId: transaction?.id || '',
        saleRecordId: record.id,
        saleDate: record.sale_date || '', // 販売日（税務申告の基準）
        purchaseDate: transaction?.date || '', // 購入日（参考）
        productName: transaction?.product_name || '',
        quantity: transaction?.quantity || 1,
        quantitySold: record.quantity_sold,
        purchasePrice: allocatedPurchasePrice,
        sellingPrice: record.total_selling_price || 0,
        platformFee: record.platform_fee || 0,
        shippingFee: record.shipping_fee || 0,
        suppliesCost: 0, // 消耗品費は集計で一括計算
        pointsReward: pointsValue,
        cashProfit: record.cash_profit || 0,
        totalProfit: record.total_profit || 0,
        notes: record.notes || transaction?.notes || '',
      };
    });

    return details;
  } catch (error) {
    console.error('税務レポート明細の生成に失敗:', error);
    return [];
  }
}

/**
 * 税務レポート年度集計を生成（販売記録ベース）
 */
export async function generateTaxReportSummary(year: number): Promise<TaxReportSummary> {
  try {
    const details = await generateTaxReportDetails(year);
    const yearlySuppliesCosts = await getYearlySuppliesCosts(year);

    // 各項目を計算（販売記録から集計）
    const totalRevenue = details.reduce((sum, d) => sum + d.sellingPrice, 0);
    const totalPointsValue = details.reduce((sum, d) => sum + d.pointsReward, 0);
    const totalIncome = totalRevenue + totalPointsValue;

    const purchaseCosts = details.reduce((sum, d) => sum + d.purchasePrice, 0);
    const platformFees = details.reduce((sum, d) => sum + d.platformFee, 0);
    const shippingFees = details.reduce((sum, d) => sum + d.shippingFee, 0);

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
      transactionCount: details.length, // 販売記録の件数
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
