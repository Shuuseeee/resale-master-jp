// app/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getTrendData,
  getComparisonMetrics,
  getPaymentMethodAnalysis,
  getPlatformAnalysis,
  getCostStructure,
  getAllPaymentMethods,
  type TimeRange,
  type AnalyticsFilters,
  type TrendDataPoint,
  type ComparisonMetrics,
  type PaymentMethodAnalysis,
  type PlatformAnalysis,
  type CostStructure,
  type PaymentMethodFilter,
} from '@/lib/api/analytics';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { layout, heading, card, button, badge, input } from '@/lib/theme';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodFilter[]>([]);

  // 数据状态
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodAnalysis[]>([]);
  const [platformData, setPlatformData] = useState<PlatformAnalysis[]>([]);
  const [costStructure, setCostStructure] = useState<CostStructure | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, startDate, endDate, selectedPaymentMethods]);

  const loadPaymentMethods = async () => {
    const methods = await getAllPaymentMethods();
    setPaymentMethods(methods);
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const filters: AnalyticsFilters = {
        timeRange,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        paymentMethods: selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
      };

      const [trend, comp, payment, platform, cost] = await Promise.all([
        getTrendData(filters),
        getComparisonMetrics(filters),
        getPaymentMethodAnalysis(filters),
        getPlatformAnalysis(filters),
        getCostStructure(filters),
      ]);

      setTrendData(trend);
      setComparison(comp);
      setPaymentMethodData(payment);
      setPlatformData(platform);
      setCostStructure(cost);
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMethod = (methodId: string) => {
    setSelectedPaymentMethods(prev =>
      prev.includes(methodId)
        ? prev.filter(id => id !== methodId)
        : [...prev, methodId]
    );
  };

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case 'day': return '日报';
      case 'week': return '周报';
      case 'month': return '月报';
      case 'quarter': return '季报';
      case 'year': return '年报';
      case 'custom': return '自定义';
      default: return '月报';
    }
  };

  const formatChangePercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    return <span className={color}>{sign}{value.toFixed(2)}%</span>;
  };

  if (loading && !comparison) {
    return (
      <div className={layout.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-900 dark:text-white text-xl">加载中...</div>
        </div>
      </div>
    );
  }

  // 准备成本结构饼图数据
  const costPieData = costStructure ? [
    { name: '采购成本', value: costStructure.purchaseCost },
    { name: '平台费用', value: costStructure.platformFees },
    { name: '运费', value: costStructure.shippingFees },
    { name: '耗材成本', value: costStructure.suppliesCosts },
  ].filter(item => item.value > 0) : [];

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题和筛选器 */}
        <div className={layout.section}>
          <h1 className={heading.h1 + ' mb-2'}>数据分析仪表板</h1>
          <p className="text-gray-600 dark:text-gray-400">深度分析您的业务数据</p>
        </div>

        {/* 筛选器 */}
        <div className={layout.section}>
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>筛选条件</h2>

            {/* 时间范围选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                时间范围
              </label>
              <div className="flex flex-wrap gap-2">
                {(['day', 'week', 'month', 'quarter', 'year', 'custom'] as TimeRange[]).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义日期范围 */}
            {timeRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={input.base + ' w-full'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={input.base + ' w-full'}
                  />
                </div>
              </div>
            )}

            {/* 支付方式筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                支付方式
              </label>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => togglePaymentMethod(method.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedPaymentMethods.includes(method.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {method.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 核心指标卡片 */}
        {comparison && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总销售额</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(comparison.current.totalSales)}
              </div>
              <div className="text-sm">
                环比: {formatChangePercentage(comparison.salesChange)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总利润</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(comparison.current.totalProfit)}
              </div>
              <div className="text-sm">
                环比: {formatChangePercentage(comparison.profitChange)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">平均ROI</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatROI(comparison.current.avgROI)}
              </div>
              <div className="text-sm">
                环比: {formatChangePercentage(comparison.roiChange)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">交易数量</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {comparison.current.transactionCount}
              </div>
              <div className="text-sm">
                环比: {formatChangePercentage(comparison.transactionChange)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">平均单笔利润</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(comparison.current.avgProfitPerTransaction)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总成本</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(comparison.current.totalCost)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">积分回报</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(comparison.current.totalPointsValue)}
              </div>
            </div>

            <div className={card.stat}>
              <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总费用</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(
                  comparison.current.totalPlatformFees +
                  comparison.current.totalShippingFees +
                  comparison.current.totalSuppliesCosts
                )}
              </div>
            </div>
          </div>
        )}

        {/* 趋势图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 销售额趋势 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>销售额趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  name="销售额"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 利润趋势 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>利润趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="利润"
                  dot={{ fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ROI趋势 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>ROI趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                  formatter={(value) => `${(value as number).toFixed(2)}%`}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="ROI"
                  dot={{ fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 交易数量趋势 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>交易数量趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                />
                <Bar dataKey="transactions" fill="#8b5cf6" name="交易数量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 支付方式和平台分析 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 支付方式分析 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>支付方式分析</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  dataKey="totalSales"
                  nameKey="paymentMethodName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.paymentMethodName} (${entry.percentage.toFixed(1)}%)`}
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* 支付方式详细列表 */}
            <div className="mt-4 space-y-2">
              {paymentMethodData.map((method, index) => (
                <div
                  key={method.paymentMethodId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {method.paymentMethodName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {method.transactionCount} 笔交易
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(method.totalSales)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ROI: {formatROI(method.avgROI)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 积分平台分析 */}
          <div className={card.primary + ' p-6'}>
            <h2 className={heading.h3 + ' mb-4'}>积分平台分析</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis
                  type="category"
                  dataKey="platformName"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f3f4f6',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Bar dataKey="totalPointsValue" fill="#06b6d4" name="积分价值" />
              </BarChart>
            </ResponsiveContainer>

            {/* 平台详细列表 */}
            <div className="mt-4 space-y-2">
              {platformData.map((platform) => (
                <div
                  key={platform.platformId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {platform.platformName}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {(platform.totalPoints || 0).toLocaleString()} 积分
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(platform.totalPointsValue)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {platform.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 成本结构分析 */}
        {costStructure && costPieData.length > 0 && (
          <div className={card.primary + ' p-6 mb-8'}>
            <h2 className={heading.h3 + ' mb-4'}>成本结构分析</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => {
                      const percentage = (entry.value / costStructure.totalCost) * 100;
                      return `${entry.name} (${percentage.toFixed(1)}%)`;
                    }}
                  >
                    {costPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                      color: '#f3f4f6',
                    }}
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-4">
                {costPieData.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(item.value)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {((item.value / costStructure.totalCost) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
