// components/charts/EChart.tsx — ECharts 的最小 React 封装（按需引入，canvas 渲染）
// 尺寸跟随容器（ResizeObserver）；option 变化时整体替换（notMerge），避免旧系列残留。
// 颜色不能直接写 CSS 变量（canvas 不认），用 useChartTheme() 取当前主题的实际色值。
'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, CandlestickChart, LineChart, PieChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, CandlestickChart, PieChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

export type EChartOption = echarts.EChartsCoreOption;

export default function EChart({ option, height, className }: { option: EChartOption; height: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} className={className} style={{ height, width: '100%' }} />;
}

export interface ChartTheme {
  text: string;
  muted: string;
  border: string;
  surface: string;
  font: string;
  /** --chart-1..8 */
  palette: string[];
  up: string;
  down: string;
}

function readTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const palette = Array.from({ length: 8 }, (_, i) => v(`--chart-${i + 1}`));
  return {
    text: v('--color-text-secondary'),
    muted: v('--color-text-muted'),
    border: v('--color-border'),
    surface: v('--color-bg-elevated'),
    font: v('--font-sans'),
    palette,
    up: palette[0],
    down: palette[3],
  };
}

/** 当前主题的图表色值；切换浅色 / 深色（<html data-theme>）时更新 */
export function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
