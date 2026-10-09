// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getDashboardStats } from '@/lib/api/financial';
import { formatCurrencyCompact } from '@/lib/financial/calculator';
import { card, heading, layout } from '@/lib/theme';
import PullToRefresh from '@/components/PullToRefresh';
import OfflineNoCache from '@/components/OfflineNoCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Gift20Filled, Gift20Regular } from '@fluentui/react-icons/headless/svg/gift';
import PageHeader from '@/components/shell/PageHeader';

function MetricCard({
  label,
  value,
  note,
  tone = 'primary',
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  icon: ReactNode;
}) {
  const toneClass = {
    primary: 'text-[var(--color-primary)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
    neutral: 'text-[var(--color-text)]',
  }[tone];

  return (
    <div className={card.primary + ' p-4'}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className={`truncate text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--color-text-muted)]">{note}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [includePoints, setIncludePoints] = useState(true);
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  // 读取走 useQuery：切页回来先用缓存（30 秒内不重拉），离线可看上次的数据；
  // 写入后的失效由 QueryInvalidationBridge 统一处理（见 lib/queryInvalidation.ts）
  const { data, isPending, fetchStatus, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
  });

  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, [queryClient]);

  // isPending 而非 isLoading：离线缓存恢复期间查询被暂停，isLoading 为 false 但还没有数据
  // 还要确认真的离线：fetchStatus 为 paused 也可能是后台标签页暂停重试，那时应继续显示加载中
  if (isPending && fetchStatus === 'paused' && !online) return <OfflineNoCache what="仪表盘数据" />;

  if (isPending) {
    return (
      <div className="min-h-screen md:min-h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg className="h-8 w-8 animate-spin text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  // 加载失败且没有任何数据可显示：给出重试入口，而不是显示一屏 0。
  // 注意不能用 isError 判断：后台刷新失败时 Query 会保留旧数据且 isError 为真，那时应继续显示旧数据
  if (!data) {
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

  const {
    monthlyProfit,
    monthlySalesCount,
    totalInvestment,
    totalRecovered,
    confirmedProfit,
    unrealizedStockCost,
    expectedPoints,
    inStockCount,
  } = data;

  const profitTone = confirmedProfit >= 0 ? 'success' : 'danger';
  const monthlyTone = monthlyProfit >= 0 ? 'success' : 'danger';

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }}>
      <div className={layout.page}>
        <PageHeader
          crumbs={[{ label: '仪表盘' }]}
          actions={[
            {
              id: 'points',
              label: '包含积分价值',
              icon: { regular: Gift20Regular, filled: Gift20Filled },
              pressed: includePoints,
              onClick: () => setIncludePoints(!includePoints),
            },
          ]}
        />
        <div className={layout.container}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between md:mb-0 md:block">
            <h1 className={heading.page}>仪表盘</h1>
            <button
              onClick={() => setIncludePoints(!includePoints)}
              className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition-colors md:hidden ${
                includePoints
                  ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <span className={`relative inline-flex h-4 w-8 rounded-full ${includePoints ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--color-border)]'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${includePoints ? 'left-4' : 'left-0.5'}`} />
              </span>
              包含积分价值
            </button>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard
              label="库存数"
              value={inStockCount.toLocaleString()}
              note="个"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            />
            <MetricCard
              label="总投资额"
              value={formatCurrencyCompact(totalInvestment)}
              note="全部交易总计"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            />
            <MetricCard
              label="已回收"
              value={formatCurrencyCompact(totalRecovered)}
              note="销售总额"
              tone="success"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            />
            <MetricCard
              label="确认利润"
              value={formatCurrencyCompact(confirmedProfit)}
              note="已售出部分"
              tone={profitTone}
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
            <MetricCard
              label="未回收库存"
              value={formatCurrencyCompact(unrealizedStockCost)}
              note="在库 + 未到货 + 未入账"
              tone="warning"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <MetricCard
              label={includePoints ? '预期积分' : '本月利润'}
              value={includePoints ? expectedPoints.toLocaleString() : formatCurrencyCompact(monthlyProfit)}
              note={includePoints ? 'pt（在库 + 未到货 + 未入账）' : `${monthlySalesCount} 笔`}
              tone={includePoints ? 'warning' : monthlyTone}
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{includePoints ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />}</svg>}
            />
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}
