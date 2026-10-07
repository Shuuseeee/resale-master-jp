// lib/api/analytics.ts
// 数据分析 API 函数

import { supabase } from '@/lib/supabase/client';
import { fetchAllRows, type SelectOpts } from '@/lib/api/fetchAll';
import { formatDateToLocal } from '@/lib/utils/dateUtils';

/**
 * 时间范围类型
 */
export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * 支付方式筛选
 */
export interface PaymentMethodFilter {
  id: string;
  name: string;
}

/**
 * 筛选条件
 */
export interface AnalyticsFilters {
  timeRange: TimeRange;
  startDate?: string;
  endDate?: string;
  paymentMethods?: string[]; // 支付方式ID数组
  platforms?: string[]; // 积分平台ID数组
}

/**
 * 趋势数据点
 */
export interface TrendDataPoint {
  date: string;
  sales: number;
  profit: number;
  roi: number;
  transactions: number;
  cost: number;
}

/**
 * 核心指标
 */
export interface CoreMetrics {
  totalSales: number;
  totalProfit: number;
  totalCost: number;
  avgROI: number;
  transactionCount: number;
  avgProfitPerTransaction: number;
  totalPlatformFees: number;
  totalShippingFees: number;
  totalSuppliesCosts: number;
  totalPointsValue: number;
}

/**
 * 对比指标（环比）
 */
export interface ComparisonMetrics {
  current: CoreMetrics;
  previous: CoreMetrics;
  salesChange: number; // 百分比
  profitChange: number; // 百分比
  roiChange: number; // 百分比
  transactionChange: number; // 百分比
}

/**
 * 支付方式分析
 */
export interface PaymentMethodAnalysis {
  paymentMethodId: string;
  paymentMethodName: string;
  transactionCount: number;
  totalSales: number;
  totalProfit: number;
  avgROI: number;
  percentage: number; // 占总销售额的百分比
}

/**
 * 平台分析
 */
export interface PlatformAnalysis {
  platformId: string;
  platformName: string;
  transactionCount: number;
  totalPoints: number;
  totalPointsValue: number;
  percentage: number; // 占总积分价值的百分比
}

/**
 * 购入平台分析
 */
export interface PurchasePlatformAnalysis {
  platformId: string;
  platformName: string;
  transactionCount: number;
  totalCost: number;
  totalProfit: number;
  avgROI: number;
  percentage: number; // 占总成本的百分比
}

/**
 * 出手平台分析
 */
export interface SellingPlatformAnalysis {
  platformId: string;
  platformName: string;
  transactionCount: number;
  totalSales: number;
  totalProfit: number;
  avgROI: number;
  percentage: number; // 占总销售额的百分比
}

/**
 * 成本结构
 */
export interface CostStructure {
  purchaseCost: number;
  platformFees: number;
  shippingFees: number;
  suppliesCosts: number;
  totalCost: number;
}

/**
 * 获取日期范围
 */
function getDateRange(timeRange: TimeRange, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  switch (timeRange) {
    case 'day':
      start = new Date(end);
      start.setDate(end.getDate() - 1);
      break;
    case 'week':
      start = new Date(end);
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start = new Date(end);
      start.setMonth(end.getMonth() - 1);
      break;
    case 'quarter':
      start = new Date(end);
      start.setMonth(end.getMonth() - 3);
      break;
    case 'year':
      start = new Date(end);
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(end.getTime());
      if (!startDate) {
        start.setMonth(end.getMonth() - 1);
      }
      break;
    default:
      start = new Date(end);
      start.setMonth(end.getMonth() - 1);
  }

  return { start, end };
}

/**
 * 获取上一个周期的日期范围（用于环比）
 */
function getPreviousDateRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - duration);
  return { start: prevStart, end: prevEnd };
}

/**
 * 构建查询条件（基于销售记录的销售日期）
 */
function buildQuery(filters: AnalyticsFilters, selectOpts: SelectOpts = {}) {
  const { start, end } = getDateRange(filters.timeRange, filters.startDate, filters.endDate);

  let query = supabase
    .from('sales_records')
    .select(`
      sale_date,
      quantity_sold,
      total_selling_price,
      total_profit,
      actual_cash_spent,
      platform_fee,
      shipping_fee,
      transaction:transaction_id(
        id,
        date,
        product_name,
        quantity,
        purchase_price_total,
        point_paid,
        card_id,
        expected_platform_points,
        expected_card_points,
        extra_platform_points,
        platform_points_platform_id,
        card_points_platform_id,
        extra_platform_points_platform_id,
        payment_method:payment_methods(id, name)
      )
    `, selectOpts)
    .not('sale_date', 'is', null)
    .gte('sale_date', formatDateToLocal(start))
    .lte('sale_date', formatDateToLocal(end));

  // 注意：支付方式筛选需要通过transaction关联查询
  // Supabase不支持深层次筛选，所以我们在获取数据后再筛选

  return query;
}

/**
 * 取回筛选范围内的全部销售记录。
 * 分页读取：PostgREST 单次响应有行数上限（默认 1000），超过会静默截断，销售额 / 利润 / ROI 都会偏小。
 * 排序带 id 兜底，保证分页没有重复 / 遗漏。
 */
function fetchSalesRows(filters: AnalyticsFilters): Promise<any[]> {
  return fetchAllRows<any>((from, to, opts) =>
    buildQuery(filters, opts).order('sale_date', { ascending: true }).order('id').range(from, to),
  );
}

/**
 * 计算核心指标（基于销售记录）
 */
async function calculateCoreMetrics(salesRecords: any[], platformsMap?: Map<string, any>): Promise<CoreMetrics> {
  const totalSales = salesRecords.reduce((sum, r) => sum + (r.total_selling_price || 0), 0);
  const totalProfit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);

  // 计算总成本（按比例分配）
  const totalCost = salesRecords.reduce((sum, r) => {
    const transaction = r.transaction as any;
    if (!transaction) return sum;
    const costPerUnit = (transaction.purchase_price_total || 0) / (transaction.quantity || 1);
    return sum + (costPerUnit * r.quantity_sold);
  }, 0);

  // 加权平均 ROI：sum(total_profit) / sum(actual_cash_spent)
  const totalActualCashSpent = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
  const avgROI = totalActualCashSpent > 0
    ? (totalProfit / totalActualCashSpent) * 100
    : 0;
  const avgProfitPerTransaction = salesRecords.length > 0
    ? totalProfit / salesRecords.length
    : 0;

  const totalPlatformFees = salesRecords.reduce((sum, r) => sum + (r.platform_fee || 0), 0);
  const totalShippingFees = salesRecords.reduce((sum, r) => sum + (r.shipping_fee || 0), 0);
  const totalSuppliesCosts = 0; // 耗材成本已包含在销售记录的利润计算中

  // 计算积分价值（按销售比例，使用各平台的 yen_conversion_rate）
  const totalPointsValue = salesRecords.reduce((sum, r) => {
    const transaction = r.transaction as any;
    if (!transaction) return sum;

    const pointsRatio = r.quantity_sold / (transaction.quantity || 1);

    let pointsValue = 0;

    // 平台积分
    if (transaction.expected_platform_points && transaction.platform_points_platform_id) {
      const rate = platformsMap?.get(transaction.platform_points_platform_id)?.yen_conversion_rate ?? 1;
      pointsValue += (transaction.expected_platform_points * pointsRatio * rate);
    }

    // 信用卡积分
    if (transaction.expected_card_points && transaction.card_points_platform_id) {
      const rate = platformsMap?.get(transaction.card_points_platform_id)?.yen_conversion_rate ?? 1;
      pointsValue += (transaction.expected_card_points * pointsRatio * rate);
    }

    // 额外平台积分
    if (transaction.extra_platform_points && transaction.extra_platform_points_platform_id) {
      const rate = platformsMap?.get(transaction.extra_platform_points_platform_id)?.yen_conversion_rate ?? 1;
      pointsValue += (transaction.extra_platform_points * pointsRatio * rate);
    }

    return sum + pointsValue;
  }, 0);

  return {
    totalSales,
    totalProfit,
    totalCost,
    avgROI,
    transactionCount: salesRecords.length,
    avgProfitPerTransaction,
    totalPlatformFees,
    totalShippingFees,
    totalSuppliesCosts,
    totalPointsValue,
  };
}

/**
 * 获取趋势数据
 */
export async function getTrendData(filters: AnalyticsFilters): Promise<TrendDataPoint[]> {
  try {
    const data = await fetchSalesRows(filters);

    // 按销售日期分组
    const groupedData = (data || []).reduce((acc: any, record: any) => {
      const date = record.sale_date;
      if (!date) return acc;

      // 应用支付方式筛选
      const transaction = record.transaction as any;
      if (filters.paymentMethods && filters.paymentMethods.length > 0) {
        if (!filters.paymentMethods.includes(transaction?.card_id)) {
          return acc;
        }
      }

      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          profit: 0,
          totalActualCashSpent: 0,
          transactions: 0,
          cost: 0,
        };
      }

      // 计算成本（按比例）
      const costPerUnit = (transaction?.purchase_price_total || 0) / (transaction?.quantity || 1);
      const recordCost = costPerUnit * record.quantity_sold;

      acc[date].sales += record.total_selling_price || 0;
      acc[date].profit += record.total_profit || 0;
      acc[date].cost += recordCost;
      acc[date].totalActualCashSpent += record.actual_cash_spent || 0;
      acc[date].transactions += 1;

      return acc;
    }, {});

    // 转换为数组并计算加权ROI
    const trendData: TrendDataPoint[] = Object.values(groupedData).map((item: any) => ({
      date: item.date,
      sales: item.sales,
      profit: item.profit,
      roi: item.totalActualCashSpent > 0 ? (item.profit / item.totalActualCashSpent) * 100 : 0,
      transactions: item.transactions,
      cost: item.cost,
    }));

    // 按日期排序
    return trendData.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取对比指标（环比）
 */
export async function getComparisonMetrics(filters: AnalyticsFilters): Promise<ComparisonMetrics> {
  try {
    // 当前周期
    const currentData = await fetchSalesRows(filters);

    // 上一个周期
    const { start, end } = getDateRange(filters.timeRange, filters.startDate, filters.endDate);
    const { start: prevStart, end: prevEnd } = getPreviousDateRange(start, end);

    const prevFilters = {
      ...filters,
      timeRange: 'custom' as TimeRange,
      startDate: formatDateToLocal(prevStart),
      endDate: formatDateToLocal(prevEnd),
    };

    const prevData = await fetchSalesRows(prevFilters);

    // 获取积分平台转换率
    const { data: platforms } = await supabase
      .from('points_platforms')
      .select('id, yen_conversion_rate');
    const platformsMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // 应用支付方式筛选
    const filterByPaymentMethod = (records: any[]) => {
      if (!filters.paymentMethods || filters.paymentMethods.length === 0) {
        return records;
      }
      return records.filter(r => {
        const transaction = r.transaction as any;
        return filters.paymentMethods?.includes(transaction?.card_id);
      });
    };

    const current = await calculateCoreMetrics(filterByPaymentMethod(currentData || []), platformsMap);
    const previous = await calculateCoreMetrics(filterByPaymentMethod(prevData || []), platformsMap);

    const salesChange = previous.totalSales > 0
      ? ((current.totalSales - previous.totalSales) / previous.totalSales) * 100
      : 0;
    const profitChange = previous.totalProfit !== 0
      ? ((current.totalProfit - previous.totalProfit) / Math.abs(previous.totalProfit)) * 100
      : 0;
    const roiChange = previous.avgROI > 0
      ? ((current.avgROI - previous.avgROI) / previous.avgROI) * 100
      : 0;
    const transactionChange = previous.transactionCount > 0
      ? ((current.transactionCount - previous.transactionCount) / previous.transactionCount) * 100
      : 0;

    return {
      current,
      previous,
      salesChange,
      profitChange,
      roiChange,
      transactionChange,
    };
  } catch (error) {
    console.error('获取对比指标失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取支付方式分析（基于销售记录）
 */
export async function getPaymentMethodAnalysis(filters: AnalyticsFilters): Promise<PaymentMethodAnalysis[]> {
  try {
    const data = await fetchSalesRows(filters);

    const totalSales = (data || []).reduce((sum, r) => sum + (r.total_selling_price || 0), 0);

    // 按支付方式分组
    const groupedData = (data || []).reduce((acc: any, record: any) => {
      const transaction = record.transaction as any;
      const methodId = transaction?.card_id || 'unknown';
      const methodName = (transaction?.payment_method as any)?.name || '未知';

      // 应用支付方式筛选
      if (filters.paymentMethods && filters.paymentMethods.length > 0) {
        if (!filters.paymentMethods.includes(methodId)) {
          return acc;
        }
      }

      if (!acc[methodId]) {
        acc[methodId] = {
          paymentMethodId: methodId,
          paymentMethodName: methodName,
          transactionCount: 0,
          totalSales: 0,
          totalProfit: 0,
          totalActualCashSpent: 0,
        };
      }

      acc[methodId].transactionCount += 1;
      acc[methodId].totalSales += record.total_selling_price || 0;
      acc[methodId].totalProfit += record.total_profit || 0;
      acc[methodId].totalActualCashSpent += record.actual_cash_spent || 0;

      return acc;
    }, {});

    // 转换为数组并计算百分比
    const analysis: PaymentMethodAnalysis[] = Object.values(groupedData).map((item: any) => ({
      paymentMethodId: item.paymentMethodId,
      paymentMethodName: item.paymentMethodName,
      transactionCount: item.transactionCount,
      totalSales: item.totalSales,
      totalProfit: item.totalProfit,
      avgROI: item.totalActualCashSpent > 0
        ? (item.totalProfit / item.totalActualCashSpent) * 100
        : 0,
      percentage: totalSales > 0 ? (item.totalSales / totalSales) * 100 : 0,
    }));

    // 按销售额排序
    return analysis.sort((a, b) => b.totalSales - a.totalSales);
  } catch (error) {
    console.error('获取支付方式分析失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取平台分析（基于销售记录）
 */
export async function getPlatformAnalysis(filters: AnalyticsFilters): Promise<PlatformAnalysis[]> {
  try {
    const data = await fetchSalesRows(filters);

    // 获取积分平台显示名称和转换率
    const { data: platforms } = await supabase
      .from('points_platforms')
      .select('id, display_name, yen_conversion_rate');

    const platformsMap = new Map((platforms || []).map(p => [p.id, p]));

    // 统计所有平台
    const platformMap = new Map<string, {
      platformId: string;
      platformName: string;
      transactionCount: number;
      totalPoints: number;
      totalPointsValue: number;
    }>();

    (data || []).forEach((record: any) => {
      const transaction = record.transaction as any;
      if (!transaction) return;

      // 应用支付方式筛选
      if (filters.paymentMethods && filters.paymentMethods.length > 0) {
        if (!filters.paymentMethods.includes(transaction.card_id)) {
          return;
        }
      }

      const pointsRatio = record.quantity_sold / (transaction.quantity || 1);

      // 平台积分
      if (transaction.expected_platform_points && transaction.platform_points_platform_id) {
        const platform = platformsMap.get(transaction.platform_points_platform_id);
        if (platform) {
          const platformId = platform.id;
          const platformName = platform.display_name;
          const conversionRate = (platform as any).yen_conversion_rate ?? 1;
          const points = transaction.expected_platform_points * pointsRatio;

          if (!platformMap.has(platformId)) {
            platformMap.set(platformId, {
              platformId,
              platformName,
              transactionCount: 0,
              totalPoints: 0,
              totalPointsValue: 0,
            });
          }

          const entry = platformMap.get(platformId)!;
          entry.transactionCount += 1;
          entry.totalPoints += points;
          entry.totalPointsValue += points * conversionRate;
        }
      }

      // 信用卡积分
      if (transaction.expected_card_points && transaction.card_points_platform_id) {
        const platform = platformsMap.get(transaction.card_points_platform_id);
        if (platform) {
          const platformId = platform.id;
          const platformName = platform.display_name;
          const conversionRate = (platform as any).yen_conversion_rate ?? 1;
          const points = transaction.expected_card_points * pointsRatio;

          if (!platformMap.has(platformId)) {
            platformMap.set(platformId, {
              platformId,
              platformName,
              transactionCount: 0,
              totalPoints: 0,
              totalPointsValue: 0,
            });
          }

          const entry = platformMap.get(platformId)!;
          entry.transactionCount += 1;
          entry.totalPoints += points;
          entry.totalPointsValue += points * conversionRate;
        }
      }

      // 额外平台积分
      if (transaction.extra_platform_points && transaction.extra_platform_points_platform_id) {
        const platform = platformsMap.get(transaction.extra_platform_points_platform_id);
        if (platform) {
          const platformId = platform.id;
          const platformName = platform.display_name;
          const conversionRate = (platform as any).yen_conversion_rate ?? 1;
          const points = transaction.extra_platform_points * pointsRatio;

          if (!platformMap.has(platformId)) {
            platformMap.set(platformId, {
              platformId,
              platformName,
              transactionCount: 0,
              totalPoints: 0,
              totalPointsValue: 0,
            });
          }

          const entry = platformMap.get(platformId)!;
          entry.transactionCount += 1;
          entry.totalPoints += points;
          entry.totalPointsValue += points * conversionRate;
        }
      }
    });

    const totalPointsValue = Array.from(platformMap.values()).reduce(
      (sum, p) => sum + p.totalPointsValue,
      0
    );

    // 转换为数组并计算百分比
    const analysis: PlatformAnalysis[] = Array.from(platformMap.values()).map(item => ({
      ...item,
      percentage: totalPointsValue > 0 ? (item.totalPointsValue / totalPointsValue) * 100 : 0,
    }));

    // 按积分价值排序
    return analysis.sort((a, b) => b.totalPointsValue - a.totalPointsValue);
  } catch (error) {
    console.error('获取平台分析失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取成本结构（基于销售记录）
 */
export async function getCostStructure(filters: AnalyticsFilters): Promise<CostStructure> {
  try {
    const data = await fetchSalesRows(filters);

    // 应用支付方式筛选
    const filteredRecords = (data || []).filter((r: any) => {
      const transaction = r.transaction as any;
      if (filters.paymentMethods && filters.paymentMethods.length > 0) {
        return filters.paymentMethods.includes(transaction?.card_id);
      }
      return true;
    });

    const purchaseCost = filteredRecords.reduce((sum, r) => {
      const transaction = r.transaction as any;
      if (!transaction) return sum;
      const costPerUnit = (transaction.purchase_price_total || 0) / (transaction.quantity || 1);
      return sum + (costPerUnit * r.quantity_sold);
    }, 0);

    const platformFees = filteredRecords.reduce((sum, r) => sum + (r.platform_fee || 0), 0);
    const shippingFees = filteredRecords.reduce((sum, r) => sum + (r.shipping_fee || 0), 0);
    const suppliesCosts = 0; // 耗材成本已包含在销售记录的利润计算中

    return {
      purchaseCost,
      platformFees,
      shippingFees,
      suppliesCosts,
      totalCost: purchaseCost + platformFees + shippingFees + suppliesCosts,
    };
  } catch (error) {
    console.error('获取成本结构失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取所有支付方式
 */
export async function getAllPaymentMethods(): Promise<PaymentMethodFilter[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('获取支付方式列表失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取购入平台分析（基于销售记录 + 交易的 purchase_platform_id）
 */
export async function getPurchasePlatformAnalysis(filters: AnalyticsFilters): Promise<PurchasePlatformAnalysis[]> {
  try {
    const { start, end } = getDateRange(filters.timeRange, filters.startDate, filters.endDate);

    const data = await fetchAllRows<any>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select(`
        quantity_sold,
        total_profit,
        actual_cash_spent,
        transaction:transaction_id(
          id,
          purchase_price_total,
          quantity,
          purchase_platform_id,
          purchase_platform:purchase_platform_id(id, name)
        )
      `, opts)
        .not('sale_date', 'is', null)
        .gte('sale_date', start.toISOString().split('T')[0])
        .lte('sale_date', end.toISOString().split('T')[0])
        .order('id')
        .range(from, to),
    );

    // 按购入平台分组
    const groupedData: Record<string, {
      platformId: string;
      platformName: string;
      transactionCount: number;
      totalCost: number;
      totalProfit: number;
      totalActualCashSpent: number;
    }> = {};

    (data || []).forEach((record: any) => {
      const transaction = record.transaction as any;
      if (!transaction) return;

      const platformId = transaction.purchase_platform_id || 'unknown';
      const platformName = (transaction.purchase_platform as any)?.name || '未設定';

      if (!groupedData[platformId]) {
        groupedData[platformId] = {
          platformId,
          platformName,
          transactionCount: 0,
          totalCost: 0,
          totalProfit: 0,
          totalActualCashSpent: 0,
        };
      }

      const costPerUnit = (transaction.purchase_price_total || 0) / (transaction.quantity || 1);
      const recordCost = costPerUnit * record.quantity_sold;

      groupedData[platformId].transactionCount += 1;
      groupedData[platformId].totalCost += recordCost;
      groupedData[platformId].totalProfit += record.total_profit || 0;
      groupedData[platformId].totalActualCashSpent += record.actual_cash_spent || 0;
    });

    const totalCost = Object.values(groupedData).reduce((sum, g) => sum + g.totalCost, 0);

    const analysis: PurchasePlatformAnalysis[] = Object.values(groupedData).map(item => ({
      platformId: item.platformId,
      platformName: item.platformName,
      transactionCount: item.transactionCount,
      totalCost: item.totalCost,
      totalProfit: item.totalProfit,
      avgROI: item.totalActualCashSpent > 0
        ? (item.totalProfit / item.totalActualCashSpent) * 100
        : 0,
      percentage: totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0,
    }));

    return analysis.sort((a, b) => b.totalCost - a.totalCost);
  } catch (error) {
    console.error('获取购入平台分析失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}

/**
 * 获取出手平台分析（基于销售记录的 selling_platform_id）
 */
export async function getSellingPlatformAnalysis(filters: AnalyticsFilters): Promise<SellingPlatformAnalysis[]> {
  try {
    const { start, end } = getDateRange(filters.timeRange, filters.startDate, filters.endDate);

    const data = await fetchAllRows<any>((from, to, opts) =>
      supabase
        .from('sales_records')
        .select(`
        selling_platform_id,
        total_selling_price,
        total_profit,
        actual_cash_spent,
        selling_platform:selling_platform_id(id, name)
      `, opts)
        .not('sale_date', 'is', null)
        .gte('sale_date', start.toISOString().split('T')[0])
        .lte('sale_date', end.toISOString().split('T')[0])
        .order('id')
        .range(from, to),
    );

    // 按出手平台分组
    const groupedData: Record<string, {
      platformId: string;
      platformName: string;
      transactionCount: number;
      totalSales: number;
      totalProfit: number;
      totalActualCashSpent: number;
    }> = {};

    (data || []).forEach((record: any) => {
      const platformId = record.selling_platform_id || 'unknown';
      const platformName = (record.selling_platform as any)?.name || '未設定';

      if (!groupedData[platformId]) {
        groupedData[platformId] = {
          platformId,
          platformName,
          transactionCount: 0,
          totalSales: 0,
          totalProfit: 0,
          totalActualCashSpent: 0,
        };
      }

      groupedData[platformId].transactionCount += 1;
      groupedData[platformId].totalSales += record.total_selling_price || 0;
      groupedData[platformId].totalProfit += record.total_profit || 0;
      groupedData[platformId].totalActualCashSpent += record.actual_cash_spent || 0;
    });

    const totalSales = Object.values(groupedData).reduce((sum, g) => sum + g.totalSales, 0);

    const analysis: SellingPlatformAnalysis[] = Object.values(groupedData).map(item => ({
      platformId: item.platformId,
      platformName: item.platformName,
      transactionCount: item.transactionCount,
      totalSales: item.totalSales,
      totalProfit: item.totalProfit,
      avgROI: item.totalActualCashSpent > 0
        ? (item.totalProfit / item.totalActualCashSpent) * 100
        : 0,
      percentage: totalSales > 0 ? (item.totalSales / totalSales) * 100 : 0,
    }));

    return analysis.sort((a, b) => b.totalSales - a.totalSales);
  } catch (error) {
    console.error('获取出手平台分析失败:', error);
    // 失败即抛错：分析数据已入离线缓存，返回空数组 / 全 0 会被当成成功结果并持久化（唯一调用方是分析页）
    throw error;
  }
}
