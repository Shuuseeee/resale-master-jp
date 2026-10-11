// app/supplies/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Box20Filled, Box20Regular } from '@fluentui/react-icons/headless/svg/box';
import { Delete20Regular } from '@fluentui/react-icons/headless/svg/delete';
import { Edit20Regular } from '@fluentui/react-icons/headless/svg/edit';
import { MoreHorizontal20Filled, MoreHorizontal20Regular } from '@fluentui/react-icons/headless/svg/more-horizontal';
import { TextBulletListLtr20Filled, TextBulletListLtr20Regular } from '@fluentui/react-icons/headless/svg/text-bullet-list-ltr';
import { VehicleTruckProfile20Filled, VehicleTruckProfile20Regular } from '@fluentui/react-icons/headless/svg/vehicle-truck-profile';
import DualIcon from '@/components/fluent/DualIcon';
import { getSuppliesCosts, deleteSuppliesCost } from '@/lib/api/supplies';
import type { SuppliesCost } from '@/types/database.types';
import { formatCurrency } from '@/lib/financial/calculator';
import Link from 'next/link';
import { layout, heading, card, button, badge } from '@/lib/theme';
import PageSkeleton from '@/components/Skeleton';
import PullToRefresh from '@/components/PullToRefresh';
import OfflineNoCache from '@/components/OfflineNoCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { DataTable } from '@/components/DataTable';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { useSectionDrawer } from '@/lib/section-drawer';
import { Add20Filled, Add20Regular } from '@fluentui/react-icons/headless/svg/add';
import PageHeader from '@/components/shell/PageHeader';
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from '@/lib/expenses/categories';
import { VehicleCar20Filled, VehicleCar20Regular } from '@fluentui/react-icons/headless/svg/vehicle-car';
import { Archive20Filled, Archive20Regular } from '@fluentui/react-icons/headless/svg/archive';
import { Toolbox20Filled, Toolbox20Regular } from '@fluentui/react-icons/headless/svg/toolbox';
import { ArrowRepeatAll20Filled, ArrowRepeatAll20Regular } from '@fluentui/react-icons/headless/svg/arrow-repeat-all';
import RecurringExpensesPanel from '@/components/expenses/RecurringExpensesPanel';

// 桌面在分区抽屉里切换分类，手机在统计卡片下方的按钮组里切换（分类与买取X 一致，见 lib/expenses/categories.ts）。
// 最后一项「定期经费」不是分类，是规则管理视图（新建定期经费后跳到 ?view=recurring）。
const CATEGORY_ICONS: Record<string, ReactNode> = {
  送料: <DualIcon regular={VehicleTruckProfile20Regular} filled={VehicleTruckProfile20Filled} />,
  交通費: <DualIcon regular={VehicleCar20Regular} filled={VehicleCar20Filled} />,
  梱包材: <DualIcon regular={Box20Regular} filled={Box20Filled} />,
  保管費: <DualIcon regular={Archive20Regular} filled={Archive20Filled} />,
  消耗品: <DualIcon regular={Toolbox20Regular} filled={Toolbox20Filled} />,
  その他: <DualIcon regular={MoreHorizontal20Regular} filled={MoreHorizontal20Filled} />,
};
const RECURRING = 'recurring';
const FILTER_ITEMS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'all', label: '全部', icon: <DualIcon regular={TextBulletListLtr20Regular} filled={TextBulletListLtr20Filled} /> },
  ...EXPENSE_CATEGORIES.map(c => ({ id: c.value, label: c.label, icon: CATEGORY_ICONS[c.value] })),
  { id: RECURRING, label: '定期经费', icon: <DualIcon regular={ArrowRepeatAll20Regular} filled={ArrowRepeatAll20Filled} /> },
];

const columnHelper = createColumnHelper<SuppliesCost>();
const NO_SUPPLIES: SuppliesCost[] = [];

export default function SuppliesPage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // 新建定期经费后跳来时带 ?view=recurring：选中后把参数去掉，之后切换分类、刷新都不再被它拉回
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== RECURRING) return;
    setFilter(RECURRING);
    url.searchParams.delete('view');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  // 读取走 useQuery：切页回来先用缓存，离线可看；新增 / 编辑 / 删除后的失效由
  // QueryInvalidationBridge 统一处理（supplies_costs → ['supplies']，见 lib/queryInvalidation.ts）
  const { data: supplies = NO_SUPPLIES, isPending: loading, fetchStatus, refetch } = useQuery({
    queryKey: ['supplies'],
    queryFn: getSuppliesCosts,
  });

  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ['supplies'] });
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, [queryClient]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确定要删除这条经费吗？')) {
      return;
    }

    const success = await deleteSuppliesCost(id);
    if (success) {
      // 精准打补丁（同时清除写入事件留下的过期标记），不必为删一条重拉整张列表
      queryClient.setQueryData<SuppliesCost[]>(['supplies'], old => old?.filter(s => s.id !== id) ?? []);
    } else {
      alert('删除失败，请重试');
    }
  }, [queryClient]);

  const columns = useMemo(() => [
    columnHelper.accessor('purchase_date', {
      header: '日期',
      cell: info => parseDateFromLocal(info.getValue())?.toLocaleDateString('zh-CN') ?? info.getValue(),
      meta: { tdClassName: 'whitespace-nowrap', card: { slot: 'field', label: '日期' } },
    }),
    columnHelper.accessor('category', {
      header: '分类',
      enableSorting: false,
      cell: info => (
        <span className={badge.info}>
          {expenseCategoryLabel(info.getValue())}
        </span>
      ),
      meta: { card: { slot: 'badge' } },
    }),
    columnHelper.accessor('description', {
      header: '描述',
      enableSorting: false,
      cell: info => (
        <span className="inline-flex items-center gap-2">
          {info.getValue() || '-'}
          {info.row.original.recurring_id && <span className={badge.neutral}>定期</span>}
        </span>
      ),
      meta: { card: { slot: 'title' } },
    }),
    columnHelper.accessor('amount', {
      header: '金额',
      cell: info => formatCurrency(info.getValue()),
      meta: {
        align: 'right',
        tdClassName: 'font-mono font-semibold whitespace-nowrap',
        card: { slot: 'field', label: '金额' },
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/supplies/${row.original.id}/edit`}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-[var(--radius-md)] transition-all"
            title="编辑"
          >
            <Edit20Regular />
          </Link>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-[var(--radius-md)] transition-all"
            title="删除"
          >
            <Delete20Regular />
          </button>
        </div>
      ),
      meta: { align: 'right', card: { slot: 'actions' } },
    }),
  ], [handleDelete]);

  useSectionDrawer({ path: '/supplies', items: FILTER_ITEMS, selected: filter, onSelect: setFilter });

  const filteredSupplies = filter === 'all'
    ? supplies
    : supplies.filter(s => s.category === filter);

  const totalCost = filteredSupplies.reduce((sum, s) => sum + s.amount, 0);

  // 按月份统计
  const monthlyStats = supplies.reduce((acc, supply) => {
    const month = supply.purchase_date.substring(0, 7);
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += supply.amount;
    return acc;
  }, {} as Record<string, number>);

  // 还要确认真的离线：fetchStatus 为 paused 也可能是后台标签页暂停重试，那时应继续显示加载中
  if (loading && fetchStatus === 'paused' && !online) return <OfflineNoCache what="经费" />;

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }}>
    <div className={layout.page}>
      <PageHeader
        crumbs={[{ label: '经费' }, { label: FILTER_ITEMS.find(item => item.id === filter)?.label ?? '' }]}
        actions={[{ id: 'add', label: '添加经费', icon: { regular: Add20Regular, filled: Add20Filled }, href: '/supplies/add', primary: true }]}
      />
      <div className={layout.container}>
        {/* 标题区域（桌面的「添加」在文档头工具栏里） */}
        <div className={layout.section + ' md:mb-0'}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:block">
            <h1 className={heading.page}>经费</h1>
            <Link
              href="/supplies/add"
              className={button.primary + ' flex items-center gap-2 md:hidden'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加经费
            </Link>
          </div>
        </div>

        {/* 定期经费视图（手机的切换按钮在下面的筛选器里） */}
        {filter === RECURRING && <MobileFilter filter={filter} onChange={setFilter} />}
        {filter === RECURRING ? <RecurringExpensesPanel /> : (<>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">经费合计</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(totalCost)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">记录数量</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {filteredSupplies.length}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">本月经费</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(monthlyStats[formatDateToLocal(new Date()).substring(0, 7)] || 0)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">平均单笔</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(filteredSupplies.length > 0 ? totalCost / filteredSupplies.length : 0)}
            </div>
          </div>
        </div>

        <MobileFilter filter={filter} onChange={setFilter} />

        {/* 经费列表 */}
        {filteredSupplies.length === 0 ? (
          <div className={card.primary + ' overflow-hidden p-12 text-center'}>
            <svg className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-[var(--color-text-muted)] text-lg">暂无经费</p>
            <Link
              href="/supplies/add"
              className={button.primary + ' inline-block mt-4'}
            >
              添加第一条记录
            </Link>
          </div>
        ) : (
          <DataTable
            data={filteredSupplies}
            columns={columns}
            getRowId={s => s.id}
            mobile="cards"
          />
        )}

        {/* 月度统计 */}
        {Object.keys(monthlyStats).length > 0 && (
          <div className={card.primary + ' p-6 mt-8'}>
            <h2 className={heading.h3 + ' mb-4'}>月度统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(monthlyStats)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, amount]) => (
                  <div key={month} className="bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] p-4">
                    <div className="text-sm text-[var(--color-text-muted)] mb-1">
                      {month}
                    </div>
                    <div className="text-lg font-bold text-[var(--color-text)]">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
    </PullToRefresh>
  );
}

/** 手机端的分类 / 定期经费切换（桌面在分区抽屉里切换） */
function MobileFilter({ filter, onChange }: { filter: string; onChange: (id: string) => void }) {
  return (
    <div className={card.primary + ' p-4 mb-6 md:hidden'}>
      <div className="flex gap-3 flex-wrap">
        {FILTER_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === id
                ? 'bg-[var(--color-primary-bg)] text-white'
                : 'bg-[var(--color-bg-subtle)] text-[var(--color-text)] active:opacity-80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
