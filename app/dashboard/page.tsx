// app/dashboard/page.tsx — 仪表盘（复刻买取X 売買管理的仪表盘，视觉用 Loop）
// 一次取全部原始数据（lib/dashboard/data.ts），筛选 / 指标卡 / 走势都在前端现算，切换筛选不再请求
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { heading, layout } from '@/lib/theme';
import PageSkeleton from '@/components/Skeleton';
import PullToRefresh from '@/components/PullToRefresh';
import OfflineNoCache from '@/components/OfflineNoCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import PageHeader from '@/components/shell/PageHeader';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SummaryCards from '@/components/dashboard/SummaryCards';
import ProfitTrendChart from '@/components/dashboard/ProfitTrendChart';
import { fetchDashboardData } from '@/lib/dashboard/data';
import { bestPrices, computeSummary, defaultFilters, filterOptions, type DashFilters } from '@/lib/dashboard/summary';
import { loadKaitorixConfig } from '@/lib/kaitorix-config';
import { getTodayString } from '@/lib/utils/dateUtils';

const FILTER_STORAGE = 'dashboardFilters';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const today = getTodayString();
  const [filters, setFilters] = useState<DashFilters>(() => defaultFilters(today));
  const [enabledStores, setEnabledStores] = useState<ReadonlySet<string> | null>(null);

  // 读取走 useQuery：切页回来先用缓存（30 秒内不重拉），离线可看上次的数据；
  // 写入后的失效由 QueryInvalidationBridge 统一处理（见 lib/queryInvalidation.ts）
  const { data, isPending, fetchStatus, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  });

  // 筛选记在本机；买取价按「设置 > 买取价格检查」勾选的店铺过滤（同交易页）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE);
      if (saved) setFilters({ ...defaultFilters(today), ...JSON.parse(saved) });
    } catch {}
    setEnabledStores(new Set(loadKaitorixConfig().enabledStores));
  }, [today]);

  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, [queryClient]);

  const updateFilters = (next: DashFilters) => {
    setFilters(next);
    try {
      localStorage.setItem(FILTER_STORAGE, JSON.stringify(next));
    } catch {}
  };

  const best = useMemo(() => (data ? bestPrices(data, enabledStores) : new Map<string, { price: number; stores: string[] }>()), [data, enabledStores]);
  const summary = useMemo(() => (data ? computeSummary(data, filters, best) : null), [data, filters, best]);
  const options = useMemo(() => (data ? filterOptions(data) : null), [data]);
  const filtersActive =
    filters.period !== 'all' || !!filters.jan || !!filters.source || !!filters.card || filters.completedOnly || filters.sellBasis;

  // isPending 而非 isLoading：离线缓存恢复期间查询被暂停，isLoading 为 false 但还没有数据
  // 还要确认真的离线：fetchStatus 为 paused 也可能是后台标签页暂停重试，那时应继续显示加载中
  if (isPending && fetchStatus === 'paused' && !online) return <OfflineNoCache what="仪表盘数据" />;

  if (isPending) {
    return <PageSkeleton />;
  }

  // 加载失败且没有任何数据可显示：给出重试入口，而不是显示一屏 0。
  // 注意不能用 isError 判断：后台刷新失败时 Query 会保留旧数据且 isError 为真，那时应继续显示旧数据
  if (!data || !summary || !options) {
    return (
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="max-w-sm px-6 text-center">
          <p className="text-lg font-semibold text-[var(--color-text)]">仪表盘数据加载失败</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">请检查网络后重试。</p>
          <button onClick={() => refetch()} className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] active:bg-[var(--color-bg-pressed)]">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }}>
      <div className={layout.page}>
        <PageHeader crumbs={[{ label: '仪表盘' }]} actions={[]} />
        <div className={layout.container}>
          <h1 className={heading.page + ' mb-4'}>仪表盘</h1>

          <DashboardFilters
            filters={filters}
            onChange={updateFilters}
            onReset={() => updateFilters(defaultFilters(today))}
            options={options}
            paymentMethods={data.paymentMethods}
            active={filtersActive}
          />

          <SummaryCards s={summary} />

          <div className="mt-6">
            <ProfitTrendChart data={data} best={best} enabledStores={enabledStores} today={today} />
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}
