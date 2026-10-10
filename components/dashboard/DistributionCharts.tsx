// components/dashboard/DistributionCharts.tsx — 四个分布图（复刻买取X：投资额按进货来源、回收额按出售渠道、利润按进货来源 / 出售渠道）
// 饼图（环形）/ 柱状图可切换：金额两张共用一个开关、利润两张共用一个开关；利润饼图不显示亏损项（切到柱状图看全部）
'use client';

import { useEffect, useMemo, useState } from 'react';
import EChart, { useChartTheme, type ChartTheme, type EChartOption } from '@/components/charts/EChart';
import { InfoTip, ToggleButton } from '@/components/dashboard/controls';
import { formatCurrency, formatCurrencyCompact } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { Distributions, Slice } from '@/lib/dashboard/charts';

type Kind = 'pie' | 'bar';

const AMOUNT_STORAGE = 'dashboardAmountChart';
const PROFIT_STORAGE = 'dashboardProfitChart';

function useStoredKind(key: string): [Kind, (k: Kind) => void] {
  const [kind, setKind] = useState<Kind>('pie');
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === 'bar') setKind('bar');
    } catch {}
  }, [key]);
  return [
    kind,
    (k: Kind) => {
      setKind(k);
      try {
        localStorage.setItem(key, k);
      } catch {}
    },
  ];
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

function pieOption(t: ChartTheme, slices: Slice[], narrow: boolean): EChartOption {
  return {
    animation: false,
    textStyle: { color: t.text, fontFamily: t.font },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 12 },
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${formatCurrency(p.value)} (${p.percent}%)`,
    },
    legend: narrow
      ? { type: 'scroll', bottom: 0, textStyle: { color: t.text, fontSize: 11 }, inactiveColor: t.border }
      : { type: 'scroll', orient: 'vertical', right: 0, top: 'center', textStyle: { color: t.text, fontSize: 11, overflow: 'truncate', width: 96 }, inactiveColor: t.border, tooltip: { show: true } },
    series: [
      {
        type: 'pie',
        radius: ['38%', '62%'],
        center: narrow ? ['50%', '42%'] : ['32%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { label: { show: true, fontWeight: 'bold', color: t.text } },
        data: slices.map((s, i) => ({ name: s.name, value: s.value, itemStyle: { color: t.palette[i % t.palette.length] } })),
      },
    ],
  };
}

function barOption(t: ChartTheme, slices: Slice[]): EChartOption {
  return {
    animation: false,
    textStyle: { color: t.text, fontFamily: t.font },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 12 },
      formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${formatCurrency(p[0].value)}`,
    },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: slices.map(s => s.name),
      axisLine: { lineStyle: { color: t.border } },
      axisLabel: { color: t.muted, fontSize: 11, interval: 0, rotate: slices.length > 5 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) },
      splitLine: { lineStyle: { color: t.border } },
    },
    series: [{ type: 'bar', barMaxWidth: 40, data: slices.map(s => ({ value: s.value, itemStyle: { color: s.value >= 0 ? t.up : t.down } })) }],
  };
}

function ChartCard({ title, tip, kind, onKind, slices, note }: { title: string; tip: string; kind: Kind; onKind: (k: Kind) => void; slices: Slice[]; note?: string }) {
  const theme = useChartTheme();
  const narrow = useNarrow();
  const shown = kind === 'pie' ? slices.filter(s => s.value > 0) : slices;
  const option = useMemo(
    () => (theme && shown.length ? (kind === 'pie' ? pieOption(theme, shown, narrow) : barOption(theme, shown)) : null),
    [theme, shown, kind, narrow],
  );
  return (
    <section className={card.primary + ' flex flex-col p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          <InfoTip text={tip} />
        </div>
        <div className="flex items-center gap-1">
          <ToggleButton pressed={kind === 'pie'} onClick={() => onKind('pie')}>饼图</ToggleButton>
          <ToggleButton pressed={kind === 'bar'} onClick={() => onKind('bar')}>柱状图</ToggleButton>
        </div>
      </div>
      {option ? (
        <EChart option={option} height={260} className="mt-2" />
      ) : (
        <div className="flex h-[260px] items-center justify-center text-sm text-[var(--color-text-muted)]">暂无数据</div>
      )}
      {note && kind === 'pie' && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{note}</p>}
    </section>
  );
}

export default function DistributionCharts({ d }: { d: Distributions }) {
  const [amountKind, setAmountKind] = useStoredKind(AMOUNT_STORAGE);
  const [profitKind, setProfitKind] = useStoredKind(PROFIT_STORAGE);
  const lossNote = '※ 亏损项不显示，切换柱状图查看全部';
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartCard title="投资额分布（进货来源）" tip="按进货店铺（Amazon、楽天市場 等）统计投资额（单价 × 数量），看资金花在哪些店铺。" kind={amountKind} onKind={setAmountKind} slices={d.investBySource} />
      <ChartCard title="回收额分布（出售渠道）" tip="按出售渠道（买取店等）统计回收额，看在哪些渠道卖得多。" kind={amountKind} onKind={setAmountKind} slices={d.revenueByTarget} />
      <ChartCard title="利润分布（进货来源）" tip="按进货店铺统计已售部分的利润（售价 − 扣除 − 成本），看从哪里买的商品在赚钱。" kind={profitKind} onKind={setProfitKind} slices={d.profitBySource} note={lossNote} />
      <ChartCard title="利润分布（出售渠道）" tip="按出售渠道统计已售部分的利润，看哪个渠道最赚。" kind={profitKind} onKind={setProfitKind} slices={d.profitByTarget} note={lossNote} />
    </div>
  );
}
