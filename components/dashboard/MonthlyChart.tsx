// components/dashboard/MonthlyChart.tsx — 月度趋势（复刻买取X：投资额 / 回收额柱 + 确定利润线 + 预计损益虚线，按年切换）
'use client';

import { useMemo, useState } from 'react';
import EChart, { useChartTheme, type EChartOption } from '@/components/charts/EChart';
import Select from '@/components/Select';
import { InfoTip } from '@/components/dashboard/controls';
import { formatCurrency, formatCurrencyCompact } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { MonthlyRow } from '@/lib/dashboard/charts';

export default function MonthlyChart({ rows, completedOnly, today }: { rows: MonthlyRow[]; completedOnly: boolean; today: string }) {
  const theme = useChartTheme();
  const years = useMemo(() => [...new Set(rows.map(r => r.month.slice(0, 4)))].sort().reverse(), [rows]);
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

  const showEstimate = !completedOnly && months.some(m => m.estimated !== 0);

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
          <InfoTip text="投资额记在进货月；回收额和确定利润默认记在卖出月（打开「同一天统计」或「按售出日」后与成本记在同一个月）。预计损益 = 确定利润 + 该月进货中未售部分按当前最高买取价的预估利润。跟随上方筛选。" />
        </div>
        {years.length > 0 && (
          <div className="w-28">
            <Select value={year} onChange={setPicked} options={years.map(y => ({ value: y, label: `${y}年` }))} />
          </div>
        )}
      </div>
      {option ? (
        <EChart option={option} height={300} className="mt-2" />
      ) : (
        <div className="flex h-[300px] items-center justify-center text-sm text-[var(--color-text-muted)]">暂无数据</div>
      )}
    </section>
  );
}
