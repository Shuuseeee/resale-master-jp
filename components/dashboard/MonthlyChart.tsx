// components/dashboard/MonthlyChart.tsx — 月度趋势（复刻买取X：投资额 / 回收额柱 + 确定利润线 + 预计损益虚线，按年切换）
// 「利润率 · 笔数」视图（从数据分析页搬来）：当月卖出部分的利润率折线 + 进货笔数 / 卖出件数柱（lib/dashboard/charts.ts 的 monthlyRates）
'use client';

import { useMemo, useState } from 'react';
import EChart, { useChartTheme, type EChartOption } from '@/components/charts/EChart';
import Select from '@/components/Select';
import { InfoTip, ToggleButton } from '@/components/dashboard/controls';
import { formatCurrency, formatCurrencyCompact } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { MonthlyRate, MonthlyRow } from '@/lib/dashboard/charts';

type View = 'amount' | 'rate';

export default function MonthlyChart({ rows, rates, completedOnly, today }: { rows: MonthlyRow[]; rates: MonthlyRate[]; completedOnly: boolean; today: string }) {
  const theme = useChartTheme();
  const [view, setView] = useState<View>('amount');
  const years = useMemo(() => [...new Set([...rows, ...rates].map(r => r.month.slice(0, 4)))].sort().reverse(), [rows, rates]);
  const [picked, setPicked] = useState('');
  const year = years.includes(picked) ? picked : years.includes(today.slice(0, 4)) ? today.slice(0, 4) : years[0] ?? '';

  // 选中年份的 1 月到 12 月（今年到本月为止），没有数据的月份补 0
  const months = useMemo(() => {
    if (!year) return [];
    const last = year === today.slice(0, 4) ? Number(today.slice(5, 7)) : 12;
    const byMonth = new Map(rows.map(r => [r.month, r]));
    return Array.from({ length: last }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      return byMonth.get(month) ?? { month, investment: 0, revenue: 0, profit: 0, estimated: 0 };
    });
  }, [rows, year, today]);

  const rateMonths = useMemo(() => {
    const byMonth = new Map(rates.map(r => [r.month, r]));
    return months.map(m => byMonth.get(m.month) ?? { month: m.month, roi: null, purchases: 0, soldQty: 0 });
  }, [months, rates]);

  const showEstimate = !completedOnly && months.some(m => m.estimated !== 0);

  const rateOption = useMemo((): EChartOption | null => {
    if (!theme || !rateMonths.length) return null;
    const [purchaseColor, soldColor, roiColor] = [theme.palette[0], theme.palette[4], theme.palette[1]];
    return {
      animation: false,
      textStyle: { color: theme.text, fontFamily: theme.font },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
      },
      legend: { data: ['进货笔数', '卖出件数', '利润率'], textStyle: { color: theme.text, fontSize: 11 }, itemHeight: 8, itemWidth: 14 },
      grid: { left: 10, right: 10, bottom: 10, top: 40, containLabel: true },
      xAxis: { type: 'category', data: rateMonths.map(m => m.month.slice(5)), axisLine: { lineStyle: { color: theme.border } }, axisLabel: { color: theme.muted, fontSize: 11 } },
      yAxis: [
        { type: 'value', minInterval: 1, axisLine: { show: false }, axisLabel: { color: theme.muted, fontSize: 11 }, splitLine: { lineStyle: { color: theme.border } } },
        { type: 'value', axisLine: { show: false }, axisLabel: { color: theme.muted, fontSize: 11, formatter: '{value}%' }, splitLine: { show: false } },
      ],
      series: [
        { name: '进货笔数', type: 'bar', data: rateMonths.map(m => m.purchases), itemStyle: { color: purchaseColor }, tooltip: { valueFormatter: (v: unknown) => `${v} 笔` } },
        { name: '卖出件数', type: 'bar', data: rateMonths.map(m => m.soldQty), itemStyle: { color: soldColor }, tooltip: { valueFormatter: (v: unknown) => `${v} 件` } },
        {
          name: '利润率',
          type: 'line',
          yAxisIndex: 1,
          connectNulls: true,
          data: rateMonths.map(m => m.roi),
          itemStyle: { color: roiColor },
          lineStyle: { color: roiColor },
          tooltip: { valueFormatter: (v: unknown) => (v == null ? '-' : `${v}%`) },
        },
      ],
    };
  }, [theme, rateMonths]);

  const option = useMemo((): EChartOption | null => {
    if (!theme || !months.length) return null;
    const [investColor, revenueColor, profitColor, estimateColor] = [theme.palette[0], theme.palette[4], theme.palette[1], theme.palette[9]];
    const series: Record<string, unknown>[] = [
      { name: '投资额', type: 'bar', data: months.map(m => m.investment), itemStyle: { color: investColor } },
      { name: '回收额', type: 'bar', data: months.map(m => m.revenue), itemStyle: { color: revenueColor } },
      { name: '确定利润', type: 'line', data: months.map(m => m.profit), itemStyle: { color: profitColor }, lineStyle: { color: profitColor } },
    ];
    if (showEstimate) {
      series.push({
        name: '预计损益',
        type: 'line',
        data: months.map(m => m.profit + m.estimated),
        itemStyle: { color: estimateColor },
        lineStyle: { color: estimateColor, type: 'dashed' },
      });
    }
    return {
      animation: false,
      textStyle: { color: theme.text, fontFamily: theme.font },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
        valueFormatter: (v: unknown) => formatCurrency(Number(v)),
      },
      legend: { data: series.map(s => s.name as string), textStyle: { color: theme.text, fontSize: 11 }, itemHeight: 8, itemWidth: 14 },
      grid: { left: 10, right: 10, bottom: 10, top: 40, containLabel: true },
      xAxis: { type: 'category', data: months.map(m => m.month.slice(5)), axisLine: { lineStyle: { color: theme.border } }, axisLabel: { color: theme.muted, fontSize: 11 } },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) },
        splitLine: { lineStyle: { color: theme.border } },
      },
      series,
    };
  }, [theme, months, showEstimate]);

  return (
    <section className={card.primary + ' p-4'}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">月度趋势</h2>
          <InfoTip
            text={
              view === 'amount'
                ? '投资额记在进货月；回收额和确定利润默认记在卖出月（打开「同一天统计」或「按售出日」后与成本记在同一个月）。预计损益 = 确定利润 + 该月进货中未售部分按当前最高买取价的预估利润。跟随上方筛选。'
                : '利润率 = 当月卖出部分的利润 ÷ 这部分的成本（按卖出月，不含退货损失与经费）。进货笔数按进货月，卖出件数按卖出月。跟随上方筛选。'
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ToggleButton pressed={view === 'amount'} onClick={() => setView('amount')}>金额</ToggleButton>
            <ToggleButton pressed={view === 'rate'} onClick={() => setView('rate')}>利润率 · 笔数</ToggleButton>
          </div>
          {years.length > 0 && (
            <div className="w-28">
              <Select value={year} onChange={setPicked} options={years.map(y => ({ value: y, label: `${y}年` }))} />
            </div>
          )}
        </div>
      </div>
      {(view === 'amount' ? option : rateOption) ? (
        <EChart option={(view === 'amount' ? option : rateOption)!} height={300} className="mt-2" />
      ) : (
        <div className="flex h-[300px] items-center justify-center text-sm text-[var(--color-text-muted)]">暂无数据</div>
      )}
    </section>
  );
}
