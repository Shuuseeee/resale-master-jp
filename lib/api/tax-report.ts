// lib/api/tax-report.ts
// 確定申告レポート API

import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database.types';
import { parseDateFromLocal } from '@/lib/utils/dateUtils';

/**
 * 税務レポート明細記録
 */
export interface TaxReportDetail {
  transactionId: string;
  saleRecordId: string; // 販売記録ID
  saleDate: string; // 販売日（税務申告の基準日）
  purchaseDate: string; // 購入日（参考）
  productName: string;
  janCode: string;
  purchaseOrderNumber: string;
  saleOrderNumber: string;
  quantity: number;
  quantitySold: number;
  purchaseUnitPrice: number;
  sellingPricePerUnit: number;
  purchasePrice: number; // 購入価格
  sellingPrice: number; // 売却価格
  platformFee: number; // 販売手数料
  shippingFee: number; // 送料
  suppliesCost: number; // 消耗品費
  pointsReward: number; // ポイント還元（円換算）
  cashProfit: number; // 現金利益
  totalProfit: number; // 総利益（ポイント含む）
  purchasePlatformName: string; // 購入先
  sellingPlatformName: string; // 販売先
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
  endingInventoryValue: number; // 期末棚卸資産
  endingInventoryQuantity: number; // 期末在庫数量
  inventoryItemCount: number; // 期末在庫品目数
}

/**
 * 年末棚卸参考データ
 */
export interface TaxInventoryItem {
  transactionId: string;
  purchaseDate: string;
  purchasePlatformName: string;
  productName: string;
  janCode: string;
  purchaseOrderNumber: string;
  quantityPurchased: number;
  quantitySoldByYearEnd: number;
  quantityReturnedByYearEnd: number;
  endingQuantity: number;
  unitCost: number;
  endingInventoryValue: number;
  notes: string;
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
        selling_platform:selling_platform_id(name),
        transaction:transaction_id(
          id,
          date,
          product_name,
          jan_code,
          quantity,
          purchase_price_total,
          unit_price,
          point_paid,
          expected_platform_points,
          expected_card_points,
          extra_platform_points,
          platform_points_platform_id,
          card_points_platform_id,
          extra_platform_points_platform_id,
          purchase_platform_id,
          order_number,
          purchase_platform:purchase_platform_id(name),
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
/**
 * 取引のポイント価値を計算（円換算、all 1:1）
 */
function calculatePointsValue(transaction: any): number {
  let totalPointsValue = 0;

  if (transaction.expected_platform_points) {
    totalPointsValue += transaction.expected_platform_points;
  }

  if (transaction.expected_card_points) {
    totalPointsValue += transaction.expected_card_points;
  }

  if (transaction.extra_platform_points) {
    totalPointsValue += transaction.extra_platform_points;
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

    const details: TaxReportDetail[] = salesRecords.map(record => {
      const transaction = record.transaction as any;

      // 販売数量に応じたポイント価値を計算（all 1:1）
      const pointsRatio = record.quantity_sold / (transaction?.quantity || 1);

      let pointsValue = 0;

      // プラットフォームポイント
      if (transaction?.expected_platform_points && transaction?.platform_points_platform_id) {
        pointsValue += (transaction.expected_platform_points * pointsRatio);
      }

      // クレジットカードポイント
      if (transaction?.expected_card_points && transaction?.card_points_platform_id) {
        pointsValue += (transaction.expected_card_points * pointsRatio);
      }

      // 追加プラットフォームポイント
      if (transaction?.extra_platform_points && transaction?.extra_platform_points_platform_id) {
        pointsValue += (transaction.extra_platform_points * pointsRatio);
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
        janCode: transaction?.jan_code || '',
        purchaseOrderNumber: transaction?.order_number || '',
        saleOrderNumber: record.sale_order_number || '',
        quantity: transaction?.quantity || 1,
        quantitySold: record.quantity_sold,
        purchaseUnitPrice: transaction?.unit_price || costPerUnit,
        sellingPricePerUnit: record.selling_price_per_unit || 0,
        purchasePrice: allocatedPurchasePrice,
        sellingPrice: record.total_selling_price || 0,
        platformFee: record.platform_fee || 0,
        shippingFee: record.shipping_fee || 0,
        suppliesCost: 0, // 消耗品費は集計で一括計算
        pointsReward: pointsValue,
        cashProfit: record.cash_profit || 0,
        totalProfit: record.total_profit || 0,
        purchasePlatformName: (transaction?.purchase_platform as any)?.name || '',
        sellingPlatformName: (record.selling_platform as any)?.name || '',
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
 * 指定年度末時点の棚卸参考データを生成
 */
export async function generateTaxInventoryItems(year: number): Promise<TaxInventoryItem[]> {
  try {
    const endDate = `${year}-12-31`;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id,
        date,
        product_name,
        jan_code,
        quantity,
        purchase_price_total,
        unit_price,
        order_number,
        notes,
        purchase_platform:purchase_platform_id(name)
      `)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) return [];

    const transactionIds = transactions.map(t => t.id);

    const { data: salesRecords, error: salesError } = await supabase
      .from('sales_records')
      .select('transaction_id, quantity_sold, sale_date')
      .in('transaction_id', transactionIds)
      .lte('sale_date', endDate);

    if (salesError) throw salesError;

    const { data: returnRecords, error: returnError } = await supabase
      .from('return_records')
      .select('transaction_id, quantity_returned, return_date')
      .in('transaction_id', transactionIds)
      .lte('return_date', endDate);

    if (returnError) throw returnError;

    const soldByTransaction = new Map<string, number>();
    for (const record of salesRecords || []) {
      soldByTransaction.set(
        record.transaction_id,
        (soldByTransaction.get(record.transaction_id) || 0) + (record.quantity_sold || 0),
      );
    }

    const returnedByTransaction = new Map<string, number>();
    for (const record of returnRecords || []) {
      returnedByTransaction.set(
        record.transaction_id,
        (returnedByTransaction.get(record.transaction_id) || 0) + (record.quantity_returned || 0),
      );
    }

    return transactions
      .map(tx => {
        const quantityPurchased = tx.quantity || 1;
        const quantitySoldByYearEnd = soldByTransaction.get(tx.id) || 0;
        const quantityReturnedByYearEnd = returnedByTransaction.get(tx.id) || 0;
        const endingQuantity = Math.max(
          0,
          quantityPurchased - quantitySoldByYearEnd - quantityReturnedByYearEnd,
        );
        const unitCost = tx.unit_price || ((tx.purchase_price_total || 0) / quantityPurchased);

        return {
          transactionId: tx.id,
          purchaseDate: tx.date || '',
          purchasePlatformName: (tx.purchase_platform as any)?.name || '',
          productName: tx.product_name || '',
          janCode: tx.jan_code || '',
          purchaseOrderNumber: tx.order_number || '',
          quantityPurchased,
          quantitySoldByYearEnd,
          quantityReturnedByYearEnd,
          endingQuantity,
          unitCost,
          endingInventoryValue: unitCost * endingQuantity,
          notes: tx.notes || '',
        };
      })
      .filter(item => item.endingQuantity > 0);
  } catch (error) {
    console.error('棚卸参考データの生成に失敗:', error);
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
    const inventoryItems = await generateTaxInventoryItems(year);

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
    const endingInventoryValue = inventoryItems.reduce((sum, item) => sum + item.endingInventoryValue, 0);
    const endingInventoryQuantity = inventoryItems.reduce((sum, item) => sum + item.endingQuantity, 0);

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
      endingInventoryValue,
      endingInventoryQuantity,
      inventoryItemCount: inventoryItems.length,
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
      endingInventoryValue: 0,
      endingInventoryQuantity: 0,
      inventoryItemCount: 0,
    };
  }
}

/**
 * 利用可能な年度リストを取得
 */
export async function getAvailableYears(): Promise<number[]> {
  try {
    const { data: transactionDates, error: txError } = await supabase
      .from('transactions')
      .select('date')
      .order('date', { ascending: false });

    if (txError) throw txError;

    const { data: saleDates, error: saleError } = await supabase
      .from('sales_records')
      .select('sale_date')
      .not('sale_date', 'is', null)
      .order('sale_date', { ascending: false });

    if (saleError) throw saleError;

    if ((!transactionDates || transactionDates.length === 0) && (!saleDates || saleDates.length === 0)) {
      return [new Date().getFullYear()];
    }

    const years = [
      ...(transactionDates || []).map(t => t.date),
      ...(saleDates || []).map(s => s.sale_date),
    ]
      .filter((date): date is string => !!date)
      .map(date => (parseDateFromLocal(date) ?? new Date()).getFullYear())
      .filter((year, index, self) => self.indexOf(year) === index)
      .sort((a, b) => b - a); // 降順

    return years;
  } catch (error) {
    console.error('利用可能な年度リストの取得に失敗:', error);
    return [new Date().getFullYear()];
  }
}
