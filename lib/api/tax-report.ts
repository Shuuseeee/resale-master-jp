// lib/api/tax-report.ts
// 確定申告レポート API

import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
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

    // 分页取全：PostgREST 单次响应有行数上限（默认 1000），一年的销售记录超过它就会静默截断，
    // 报税的收入 / 经费都会偏小且不报错。排序带 id 兜底，保证分页没有重复 / 遗漏。
    const data = await fetchAllRows<any>((from, to, opts) =>
      supabase
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
      `, opts)
      .not('sale_date', 'is', null)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true })
      .order('id')
      .range(from, to),
    );

    return data;
  } catch (error) {
    console.error('年度販売記録の取得に失敗:', error);
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
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

    // 求和：必须取全（见 getSalesRecordsByYear 的说明）
    const data = await fetchAllRows<{ amount: number }>((from, to, opts) =>
      supabase
        .from('supplies_costs')
        .select('amount', opts)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate)
        .order('id')
        .range(from, to),
    );

    return data.reduce((sum, item) => sum + item.amount, 0);
  } catch (error) {
    console.error('年度消耗品費の取得に失敗:', error);
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
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
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
  }
}

/**
 * 指定年度末時点の棚卸参考データを生成
 */
export async function generateTaxInventoryItems(year: number): Promise<TaxInventoryItem[]> {
  try {
    const endDate = `${year}-12-31`;

    // 全部分页取全（超过单次行数上限会静默截断，棚卸数量 / 金额会偏小）。
    const transactions = await fetchAllRows<any>((from, to, opts) =>
      supabase
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
      `, opts)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('id')
        .range(from, to),
    );
    if (transactions.length === 0) return [];

    // 销售 / 退货不再用 .in('transaction_id', 全部交易ID) 过滤：565 个 UUID 拼出的请求地址约 20KB，
    // 会随交易增多触及网关上限而失败。RLS 已限定为本人的行；多出来的行（理论上只有
    // 销售日早于采购日的异常数据）下面按交易 id 汇总、只取交易列表里有的，不会被计入。
    const salesRecords = await fetchAllRows<{ transaction_id: string; quantity_sold: number | null; sale_date: string }>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select('transaction_id, quantity_sold, sale_date', opts)
        .lte('sale_date', endDate)
        .order('id')
        .range(from, to),
    );

    const returnRecords = await fetchAllRows<{ transaction_id: string; quantity_returned: number | null; return_date: string }>((from, to, opts) =>
      supabase
        .from('return_records')
        .select('transaction_id, quantity_returned, return_date', opts)
        .lte('return_date', endDate)
        .order('id')
        .range(from, to),
    );

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
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
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
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
  }
}

/**
 * 利用可能な年度リストを取得
 */
export async function getAvailableYears(): Promise<number[]> {
  try {
    // 分页取全：只取日期列，数据量小；否则超过单次行数上限后最早的年份会静默消失
    const transactionDates = await fetchAllRows<{ date: string }>((from, to, opts) =>
      supabase
        .from('transactions')
        .select('date', opts)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to),
    );

    const saleDates = await fetchAllRows<{ sale_date: string | null }>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select('sale_date', opts)
        .not('sale_date', 'is', null)
        .order('sale_date', { ascending: false })
        .order('id')
        .range(from, to),
    );

    if (transactionDates.length === 0 && saleDates.length === 0) {
      return [new Date().getFullYear()];
    }

    const years = [
      ...transactionDates.map(t => t.date),
      ...saleDates.map(s => s.sale_date),
    ]
      .filter((date): date is string => !!date)
      .map(date => (parseDateFromLocal(date) ?? new Date()).getFullYear())
      .filter((year, index, self) => self.indexOf(year) === index)
      .sort((a, b) => b - a); // 降順

    return years;
  } catch (error) {
    console.error('利用可能な年度リストの取得に失敗:', error);
    // 失败即抛错：报税数据出错时静默返回 0 / 空会让人导出一份全 0 的报表，且会被离线缓存持久化
    throw error;
  }
}
