// components/dashboard/ProfitTrendChart.tsx — 损益走势（复刻买取X：四种口径、30 天 / 90 天 / 年初至今 / 全部、日 / 周 / 月线，下方较前一期柱）
// 计算在 lib/dashboard/trend.ts；不受页面筛选影响，始终统计全部进货。
'use client';

import { useEffect, useMemo, useState } from 'react';
import EChart, { useChartTheme, type ChartTheme, type EChartOption } from '@/components/charts/EChart';
import { InfoTip, ToggleButton } from '@/components/dashboard/controls';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { DashboardData } from '@/lib/dashboard/data';
import { bucketize, buildTrend, type TrendBucket, type TrendSeries, type TrendUnit } from '@/lib/dashboard/trend';

type Mode = 'total' | 'realized' | 'unrealized' | 'asset';
type Range = '30' | '90' | 'ytd' | 'all';

const MODES: { id: Mode; label: string; tip: string }[] = [
  { id: 'total', label: '利润（含预估）', tip: '确定利润 + 预估利润。卖出时预估利润转成确定利润，线不会往下掉。' },
  { id: 'realized', label: '确定利润', tip: '已售出部分的利润 = 回收额 − 扣除 − 售出部分成本 − 退货损失 − 经费。' },
  { id: 'unrealized', label: '预估利润', tip: '未售出部分按当天最高买取价卖掉的利润 = Σ（当天最高买取价 − 单件成本）× 持有数。' },
  { id: 'asset', label: '库存估值', tip: '未售出部分按当天最高买取价估算的金额（未扣成本）。库存估值 − 成本 = 预估利润。' },
];
const RANGES: { id: Range; label: string; since: string; unit: TrendUnit }[] = [
  { id: '30', label: '30天', since: '近30天', unit: 'day' },
  { id: '90', label: '90天', since: '近90天', unit: 'day' },
  { id: 'ytd', label: '年初至今', since: '年初至今', unit: 'week' },
  { id: 'all', label: '全部', since: '全部期间', unit: 'month' },
];
const UNITS: { id: TrendUnit; label: string; change: string }[] = [
  { id: 'day', label: '日线', change: '较前日' },
  { id: 'week', label: '周线', change: '较前周' },
  { id: 'month', label: '月线', change: '较前月' },
];
/** 主线的参照虚线：利润（含预估）配确定利润，库存估值配成本 */
const REFERENCE: Partial<Record<Mode, { key: keyof TrendSeries; label: string }>> = {
  total: { key: 'realized', label: '确定利润' },
  asset: { key: 'cost', label: '成本' },
};
const SERIES_KEY: Record<Mode, keyof TrendSeries> = { total: 'total', realized: 'realized', unrealized: 'unrealized', asset: 'value' };

const MODE_STORAGE = 'dashboardTrendMode';
const SCOPE_STORAGE = 'dashboardTrendIncludePending';
const NICE_STEPS = [1, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeil(x: number): number {
  if (!(x > 0)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(x)));
  return (NICE_STEPS.find(s => x / base <= s + 1e-9) ?? 10) * base;
}

function yen(max: number) {
  const wan = max >= 1e6;
  return (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs === 0) return '¥0';
    return wan ? `${sign}¥${(abs / 1e4).toFixed(0)}万` : `${sign}¥${Math.round(abs).toLocaleString('ja-JP')}`;
  };
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

interface Props {
  data: DashboardData;
  best: Map<string, { price: number }>;
  enabledStores: ReadonlySet<string> | null;
  today: string;
}

export default function ProfitTrendChart({ data, best, enabledStores, today }: Props) {
  const theme = useChartTheme();
  const [mode, setMode] = useState<Mode>('total');
  const [range, setRange] = useState<Range>('90');
  const [unit, setUnit] = useState<TrendUnit>('day');
  const [includePending, setIncludePending] = useState(true);

  useEffect(() => {
    setMode(readStored(MODE_STORAGE, MODES.map(m => m.id), 'total'));
    setIncludePending(readStored(SCOPE_STORAGE, ['1', '0'], '1') === '1');
  }, []);

  const trend = useMemo(
    () => buildTrend(data, best, enabledStores, today, includePending),
    [data, best, enabledStores, today, includePending],
  );

  const view = useMemo(() => {
    if (!trend) return null;
    let from = 0;
    if (range === '30') from = Math.max(0, trend.n - 30);
    else if (range === '90') from = Math.max(0, trend.n - 90);
    else if (range === 'ytd') from = Math.max(0, trend.dates.findIndex(d => d >= `${today.slice(0, 4)}-01-01`));
    const slice = (key: keyof TrendSeries) => Array.from(trend[key] as ArrayLike<number>).slice(from);
    const dates = trend.dates.slice(from);
    const main = slice(SERIES_KEY[mode]);
    const ref = REFERENCE[mode];
    const buckets = bucketize(dates, main, unit);
    const indexByDate = new Map(dates.map((d, i) => [d, i]));
    const lastIndex = buckets.map(b => indexByDate.get(b.to)!);
    return {
      dates,
      buckets,
      lastIndex,
      reference: ref ? slice(ref.key) : null,
      columns: { total: slice('total'), realized: slice('realized'), unrealized: slice('unrealized'), value: slice('value'), cost: slice('cost'), held: slice('heldQty'), priced: slice('pricedQty') },
      changes: buckets.map((b, i) => (i === 0 ? null : b.close - buckets[i - 1].close)),
    };
  }, [trend, range, unit, mode, today]);

  const option = useMemo(() => (theme && view ? buildOption(theme, view, mode, unit) : null), [theme, view, mode, unit]);

  const headline = view?.buckets.length
    ? (() => {
        const last = view.buckets[view.buckets.length - 1].close;
        const diff = last - view.buckets[0].open;
        return { last, diff };
      })()
    : null;
  const modeInfo = MODES.find(m => m.id === mode)!;
  const rangeInfo = RANGES.find(r => r.id === range)!;

  return (
    <section className={card.primary + ' p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">损益走势</h2>
          <InfoTip text="确定利润（已售出）加上预估利润（未售出）的走势。周线、月线以 K 线显示，下方柱状图是较前一期的增减（行情变动、当天的进货 / 售出 / 经费都会计入）。买取价每天记录一次，从 2026-10-08 开始积累，之前的日子按最早一次的价格计算。不受上方筛选影响。" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {MODES.map(m => (
            <ToggleButton key={m.id} pressed={mode === m.id} onClick={() => { setMode(m.id); writeStored(MODE_STORAGE, m.id); }}>
              {m.label}
            </ToggleButton>
          ))}
          <ToggleButton
            pressed={false}
            onClick={() => {
              setIncludePending(!includePending);
              writeStored(SCOPE_STORAGE, includePending ? '0' : '1');
            }}
          >
            ⇄ {includePending ? '库存+未到货' : '仅库存'}
          </ToggleButton>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          {modeInfo.label}
          <InfoTip text={modeInfo.tip} />
        </span>
        {headline && (
          <>
            <span className={`text-2xl font-semibold ${headline.last < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
              {formatCurrency(headline.last)}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{rangeInfo.since}</span>
            <span className={`text-xs font-semibold ${headline.diff >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {headline.diff >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(headline.diff))}
            </span>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {RANGES.map(r => (
          <ToggleButton key={r.id} pressed={range === r.id} onClick={() => { setRange(r.id); setUnit(r.unit); }}>
            {r.label}
          </ToggleButton>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {UNITS.map(u => (
          <ToggleButton key={u.id} pressed={unit === u.id} onClick={() => setUnit(u.id)}>
            {u.label}
          </ToggleButton>
        ))}
      </div>

      {option ? (
        <EChart option={option} height={330} className="mt-2" />
      ) : (
        <div className="flex h-[330px] items-center justify-center text-sm text-[var(--color-text-muted)]">暂无数据</div>
      )}
    </section>
  );
}

interface View {
  dates: string[];
  buckets: TrendBucket[];
  lastIndex: number[];
  reference: number[] | null;
  columns: Record<'total' | 'realized' | 'unrealized' | 'value' | 'cost' | 'held' | 'priced', number[]>;
  changes: (number | null)[];
}

const GRID_LEFT = 68;

function buildOption(t: ChartTheme, v: View, mode: Mode, unit: TrendUnit): EChartOption {
  const kline = unit !== 'day';
  const main = MODES.find(m => m.id === mode)!.label;
  const ref = REFERENCE[mode];
  const changeLabel = UNITS.find(u => u.id === unit)!.change;
  const line = t.palette[0];
  const refColor = t.palette[9];
  const labels = v.buckets.map(b => (unit === 'month' ? b.key.slice(2) : b.key.slice(5).replace('-', '/')));
  const extremes = v.buckets.flatMap(b => [Math.abs(b.high), Math.abs(b.low)]);
  if (v.reference) for (const i of v.lastIndex) extremes.push(Math.abs(v.reference[i]));
  const mainMax = Math.max(1, ...extremes);
  const changeMax = niceCeil(Math.max(1, ...v.changes.map(c => Math.abs(c ?? 0))));
  const axisText = { color: t.muted, fontSize: 11 };

  const row = (label: string, value: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:16px;${bold ? 'font-weight:600;' : ''}"><span>${label}</span><span style="font-variant-numeric:tabular-nums;">${value}</span></div>`;
  const signed = (n: number | null) => (n == null ? '-' : `${n > 0 ? '▲ ' : n < 0 ? '▼ ' : ''}${formatCurrency(Math.abs(n))}`);

  const series: Record<string, unknown>[] = [
    kline
      ? {
          name: main,
          type: 'candlestick',
          data: v.buckets.map(b => [b.open, b.close, b.low, b.high]),
          itemStyle: { color: t.up, color0: t.down, borderColor: t.up, borderColor0: t.down },
          barMaxWidth: 26,
        }
      : {
          name: main,
          type: 'line',
          data: v.buckets.map(b => b.close),
          symbol: 'none',
          lineStyle: { color: line, width: 2 },
          itemStyle: { color: line },
          areaStyle: { color: line, opacity: 0.12 },
        },
  ];
  if (ref && v.reference) {
    series.push({
      name: ref.label,
      type: 'line',
      data: v.lastIndex.map(i => v.reference![i]),
      symbol: 'none',
      lineStyle: { color: refColor, width: 1.5, type: 'dashed' },
      itemStyle: { color: refColor },
    });
  }
  series.push({
    name: changeLabel,
    type: 'bar',
    xAxisIndex: 1,
    yAxisIndex: 1,
    itemStyle: { color: t.muted },
    data: v.changes.map(c => ({ value: c, itemStyle: { color: c == null ? 'transparent' : c >= 0 ? t.up : t.down } })),
    barMaxWidth: 26,
  });

  return {
    animation: false,
    textStyle: { color: t.text, fontFamily: t.font },
    legend: { data: series.map(s => s.name as string), top: 0, itemHeight: 8, itemWidth: 14, textStyle: { color: t.text, fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.text, fontSize: 12 },
      axisPointer: { type: 'cross', link: [{ xAxisIndex: 'all' }] },
      formatter: (params: unknown) => {
        const first = Array.isArray(params) ? params[0] : params;
        const k = (first as { dataIndex?: number })?.dataIndex;
        if (k == null) return '';
        const b = v.buckets[k];
        const i = v.lastIndex[k];
        const c = v.columns;
        const out = [`<div style="margin-bottom:4px;">${unit === 'day' ? b.from : `${b.from} 〜 ${b.to}`}</div>`];
        out.push(row('利润（含预估）', formatCurrency(c.total[i]), mode === 'total'));
        out.push(row('　确定利润', formatCurrency(c.realized[i]), mode === 'realized'));
        out.push(row('　预估利润', formatCurrency(c.unrealized[i]), mode === 'unrealized'));
        out.push(row('库存估值', formatCurrency(c.value[i]), mode === 'asset'));
        out.push(row('　成本', formatCurrency(c.cost[i])));
        if (kline) {
          out.push(row('最高', formatCurrency(b.high)));
          out.push(row('最低', formatCurrency(b.low)));
        }
        out.push(row(changeLabel, signed(v.changes[k])));
        out.push(row('持有数', `有报价 ${Math.round(c.priced[i])} / 共 ${Math.round(c.held[i])} 个`));
        return out.join('');
      },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: GRID_LEFT, right: 14, top: 30, height: 186 },
      { left: GRID_LEFT, right: 14, top: 248, height: 62 },
    ],
    xAxis: [
      { type: 'category', gridIndex: 0, data: labels, boundaryGap: true, axisLine: { lineStyle: { color: t.border } }, axisLabel: { show: false }, axisTick: { show: false } },
      { type: 'category', gridIndex: 1, data: labels, boundaryGap: true, axisLine: { lineStyle: { color: t.border } }, axisLabel: { ...axisText, hideOverlap: true } },
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, scale: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisText, formatter: yen(mainMax) }, splitLine: { lineStyle: { color: t.border } } },
      { type: 'value', gridIndex: 1, min: -changeMax, max: changeMax, interval: changeMax, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisText, formatter: yen(changeMax) }, splitLine: { lineStyle: { color: t.border } } },
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 }],
    series,
  };
}
