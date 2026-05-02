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
  ResponsiveContainer,
} from 'recharts';
import {
  getTrendData,
  getComparisonMetrics,
  getPaymentMethodAnalysis,
  getPlatformAnalysis,
  getCostStructure,
  getAllPaymentMethods,
  getPurchasePlatformAnalysis,
  getSellingPlatformAnalysis,
  type TimeRange,
  type AnalyticsFilters,
  type TrendDataPoint,
  type ComparisonMetrics,
  type PaymentMethodAnalysis,
  type PlatformAnalysis,
  type CostStructure,
  type PaymentMethodFilter,
  type PurchasePlatformAnalysis,
  type SellingPlatformAnalysis,
} from '@/lib/api/analytics';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { layout, heading, input } from '@/lib/theme';
import PullToRefresh from '@/components/PullToRefresh';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const CHART_GRID = '#e2e8f0';
const CHART_TICK = '#64748b';
const chartCardClass = 'sn-detail-card';
const statCardClass = 'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)]';
const listRowClass = 'flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3';
const statLabelClass = 'text-sm text-[var(--color-text-muted)] mb-1';
const statValueClass = 'text-2xl font-bold text-[var(--color-text)]';
const listTitleClass = 'font-medium text-[var(--color-text)]';
const listMetaClass = 'text-sm text-[var(--color-text-muted)]';


// 统一 Tooltip 样式
const tooltipStyle = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  boxShadow: 'var(--shadow-md)',
  color: 'var(--color-text)',
};
const tooltipItemStyle = { color: 'var(--color-text)' };
const tooltipLabelStyle = { color: 'var(--color-text-muted)' };

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
  const [purchasePlatformData, setPurchasePlatformData] = useState<PurchasePlatformAnalysis[]>([]);
  const [sellingPlatformData, setSellingPlatformData] = useState<SellingPlatformAnalysis[]>([]);


  useEffect(() => {
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, startDate, endDate, selectedPaymentMethods]);

  useEffect(() => {
    const handler = () => loadAnalyticsData();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

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

      const [trend, comp, payment, platform, cost, purchasePlatform, sellingPlatform] = await Promise.all([
        getTrendData(filters),
        getComparisonMetrics(filters),
        getPaymentMethodAnalysis(filters),
        getPlatformAnalysis(filters),
        getCostStructure(filters),
        getPurchasePlatformAnalysis(filters),
        getSellingPlatformAnalysis(filters),
      ]);

      setTrendData(trend);
      setComparison(comp);
      setPaymentMethodData(payment);
      setPlatformData(platform);
      setCostStructure(cost);
      setPurchasePlatformData(purchasePlatform);
      setSellingPlatformData(sellingPlatform);
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

  if (loading && !comparison) {
    return (
      <div className={layout.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-[var(--color-text)] text-xl">加载中...</div>
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
    <PullToRefresh onRefresh={loadAnalyticsData}>
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题和筛选器 */}
        <div className={layout.section}>
          <h1 className={heading.h1 + ' mb-2'}>数据分析仪表板</h1>
          <p className="text-[var(--color-text-muted)]">深度分析您的业务数据</p>
        </div>

        {/* 筛选器 */}
        <div className={layout.section}>
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">筛选条件</h2>

            {/* 时间范围选择 */}
            <div className="mb-4">
              <label className="sn-form-label">
                时间范围
              </label>
              <div className="flex flex-wrap gap-2" data-testid="time-range-selector">
                {(['day', 'week', 'month', 'quarter', 'year', 'custom'] as TimeRange[]).map(range => (
                  <button
                    key={range}
                    data-testid={`time-range-${range}`}
                    onClick={() => setTimeRange(range)}
                    className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors ${
                      timeRange === range
                        ? 'bg-[var(--color-primary)] text-white shadow-[0_4px_8px_rgba(16,185,129,0.22)]'
                        : 'border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] active:opacity-70'
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义日期范围 */}
            {timeRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" data-testid="custom-date-range">
                <div>
                  <label className="sn-form-label">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={input.base + ' w-full'}
                    data-testid="date-start"
                  />
                </div>
                <div>
                  <label className="sn-form-label">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={input.base + ' w-full'}
                    data-testid="date-end"
                  />
                </div>
                {startDate && endDate && startDate > endDate && (
                  <div className="col-span-full text-sm text-[var(--color-danger)]" data-testid="date-range-error">
                    开始日期不能晚于结束日期
                  </div>
                )}
              </div>
            )}

            {/* 支付方式筛选 */}
            <div>
              <label className="sn-form-label">
                支付方式
              </label>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => togglePaymentMethod(method.id)}
                    className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-semibold transition-colors ${
                      selectedPaymentMethods.includes(method.id)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] active:opacity-70'
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="metrics-grid">
            <div className={statCardClass} data-testid="metric-total-sales">
              <div className={statLabelClass}>总销售额</div>
              <div className={statValueClass}>
                {formatCurrency(comparison.current.totalSales)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-total-profit">
              <div className={statLabelClass}>总利润</div>
              <div className={statValueClass}>
                {formatCurrency(comparison.current.totalProfit)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-avg-roi">
              <div className={statLabelClass}>平均ROI</div>
              <div className={statValueClass}>
                {formatROI(comparison.current.avgROI)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-transaction-count">
              <div className={statLabelClass}>交易数量</div>
              <div className={statValueClass}>
                {comparison.current.transactionCount}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-avg-profit-per-transaction">
              <div className={statLabelClass}>平均单笔利润</div>
              <div className={statValueClass}>
                {formatCurrency(comparison.current.avgProfitPerTransaction)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-total-cost">
              <div className={statLabelClass}>总成本</div>
              <div className={statValueClass}>
                {formatCurrency(comparison.current.totalCost)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-total-points-value">
              <div className={statLabelClass}>积分回报</div>
              <div className={statValueClass}>
                {formatCurrency(comparison.current.totalPointsValue)}
              </div>
            </div>

            <div className={statCardClass} data-testid="metric-total-fees">
              <div className={statLabelClass}>总费用</div>
              <div className="text-xl font-bold text-[var(--color-text)]">
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
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">销售额趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="date"
                  stroke={CHART_TICK}
                  tick={{ fill: CHART_TICK }}
                />
                <YAxis stroke={CHART_TICK} tick={{ fill: CHART_TICK }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
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
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">利润趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="date"
                  stroke={CHART_TICK}
                  tick={{ fill: CHART_TICK }}
                />
                <YAxis stroke={CHART_TICK} tick={{ fill: CHART_TICK }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
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
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">ROI趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="date"
                  stroke={CHART_TICK}
                  tick={{ fill: CHART_TICK }}
                />
                <YAxis stroke={CHART_TICK} tick={{ fill: CHART_TICK }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
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
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">交易数量趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="date"
                  stroke={CHART_TICK}
                  tick={{ fill: CHART_TICK }}
                />
                <YAxis stroke={CHART_TICK} tick={{ fill: CHART_TICK }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar dataKey="transactions" fill="#8b5cf6" name="交易数量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 支付方式和平台分析 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 支付方式分析 */}
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">支付方式分析</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  dataKey="totalSales"
                  nameKey="paymentMethodName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value) => formatCurrency(value as number)}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* 支付方式详细列表 */}
            <div className="mt-4 space-y-2">
              {paymentMethodData.map((method, index) => (
                <div
                  key={method.paymentMethodId}
                  className={listRowClass}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <div className={listTitleClass}>
                        {method.paymentMethodName}
                      </div>
                      <div className={listMetaClass}>
                        {method.transactionCount} 笔交易
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[var(--color-text)]">
                      {formatCurrency(method.totalSales)}
                    </div>
                    <div className={listMetaClass}>
                      ROI: {formatROI(method.avgROI)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 积分平台分析 */}
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">积分平台分析</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis type="number" stroke={CHART_TICK} tick={{ fill: CHART_TICK }} />
                <YAxis
                  type="category"
                  dataKey="platformName"
                  stroke={CHART_TICK}
                  tick={{ fill: CHART_TICK }}
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
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
                  className={listRowClass}
                >
                  <div>
                    <div className={listTitleClass}>
                      {platform.platformName}
                    </div>
                    <div className={listMetaClass}>
                      {(platform.totalPoints || 0).toLocaleString()} 积分
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[var(--color-text)]">
                      {formatCurrency(platform.totalPointsValue)}
                    </div>
                    <div className={listMetaClass}>
                      {platform.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 购入平台和出手平台分析 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 购入平台分析 */}
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">购入平台分析</h2>
            {purchasePlatformData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={purchasePlatformData}
                      dataKey="totalCost"
                      nameKey="platformName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                    >
                      {purchasePlatformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* 购入平台详细列表 */}
                <div className="mt-4 space-y-2">
                  {purchasePlatformData.map((platform, index) => (
                    <div
                      key={platform.platformId}
                      className={listRowClass}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className={listTitleClass}>
                            {platform.platformName}
                          </div>
                          <div className={listMetaClass}>
                            {platform.transactionCount} 笔交易
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-text)]">
                          {formatCurrency(platform.totalCost)}
             </div>
                        <div className={listMetaClass}>
                          ROI: {formatROI(platform.avgROI)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-[var(--color-text-muted)]">
                暂无购入平台数据
              </div>
            )}
          </div>

          {/* 出手平台分析 */}
          <div className={chartCardClass}>
            <h2 className="sn-detail-title">出手平台分析</h2>
            {sellingPlatformData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sellingPlatformData}
                      dataKey="totalSales"
                      nameKey="platformName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                    >
                      {sellingPlatformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* 出手平台详细列表 */}
                <div className="mt-4 space-y-2">
                  {sellingPlatformData.map((platform, index) => (
                    <div
                      key={platform.platformId}
                      className={listRowClass}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className={listTitleClass}>
                            {platform.platformName}
                          </div>
                          <div className={listMetaClass}>
                            {platform.transactionCount} 笔交易
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-text)]">
                          {formatCurrency(platform.totalSales)}
                        </div>
                        <div className={listMetaClass}>
                          ROI: {formatROI(platform.avgROI)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-[var(--color-text-muted)]">
                暂无出手平台数据
              </div>
            )}
          </div>
        </div>

        {/* 成本结构分析 */}
        {costStructure && costPieData.length > 0 && (
          <div className={chartCardClass + ' mb-8'}>
            <h2 className="sn-detail-title">成本结构分析</h2>
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
                    labelLine={false}
                  >
                    {costPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-4">
                {costPieData.map((item, index) => (
                  <div
                    key={item.name}
                    className={listRowClass}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className={listTitleClass}>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--color-text)]">
                        {formatCurrency(item.value)}
                      </div>
                      <div className={listMetaClass}>
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
    </PullToRefresh>
  );
}
