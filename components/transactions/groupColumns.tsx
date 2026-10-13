// components/transactions/groupColumns.tsx — 交易列表「JAN 分组」桌面表格的列（照买取X 売買管理的 janGroup 表）
// 分组模式是另一张表：每个 JAN 一行（只有一笔也成组，没有 JAN 的每笔各自一行），列为整组设计；
// 点展开在行下方显示这组的进货小表（列 = 平铺表格的列去掉商品，见 app/transactions/page.tsx 的 renderSubComponent）。
'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDown12Regular } from '@fluentui/react-icons/headless/svg/arrow-down';
import { ArrowUp12Regular } from '@fluentui/react-icons/headless/svg/arrow-up';
import { ChevronRight20Regular } from '@fluentui/react-icons/headless/svg/chevron-right';
import { formatCurrency } from '@/lib/financial/calculator';
import { badge } from '@/lib/theme';
import type { TransactionGroup } from '@/app/transactions/page';
import { SELECT_COLUMN_ID } from '@/components/DataTable';
import CopyableJan from '@/components/CopyableJan';
import { ProductImage } from '@/components/OptimizedImage';

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi' | 'buyback_price' | 'expected_profit';

export interface GroupTableDeps {
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  toggleSelectAllVisible: () => void;
  expandedGroups: Set<string>;
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  toggleSort: (field: SortField) => void;
  onToggleExpand: (janCode: string) => void;
  onSelectGroup: (ids: string[]) => void;
  onSellGroup: (group: TransactionGroup) => void;
}

function SortChevron({ asc }: { asc: boolean }) {
  return asc ? <ArrowUp12Regular className="shrink-0" /> : <ArrowDown12Regular className="shrink-0" />;
}

function CheckMark({ state }: { state: boolean | 'mixed' }) {
  return <span className="fluent-checkbox" data-checked={state === 'mixed' ? 'mixed' : state ? 'true' : 'false'} aria-hidden="true" />;
}

function Money({ value }: { value: number }) {
  return (
    <span className={`font-medium ${value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
      {value >= 0 ? '+' : ''}
      {formatCurrency(value)}
    </span>
  );
}

export function buildGroupColumns(deps: GroupTableDeps): ColumnDef<TransactionGroup>[] {
  const columns: ColumnDef<TransactionGroup>[] = [];

  // 勾选列常驻（桌面表格，照买取X；手机卡片另有选择模式）
  columns.push({
    id: SELECT_COLUMN_ID,
    enableSorting: false,
    header: () => (
      <button type="button" onClick={deps.toggleSelectAllVisible} aria-label="全选当前显示的记录" title="全选当前显示的记录" className="flex items-center">
        <CheckMark state={deps.allVisibleSelected ? true : deps.someVisibleSelected ? 'mixed' : false} />
      </button>
    ),
    cell: ({ row }) => {
      const ids = row.original.transactions.map(t => t.id);
      const n = ids.filter(id => deps.selectedIds.has(id)).length;
      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            deps.onSelectGroup(ids);
          }}
          aria-label="全选该组"
          className="flex items-center"
        >
          <CheckMark state={n === ids.length ? true : n > 0 ? 'mixed' : false} />
        </button>
      );
    },
    meta: { thClassName: 'w-10 !pl-4 !pr-1', tdClassName: 'w-10 !pl-4 !pr-1' },
  });
  columns.push(
    {
      id: 'expand',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const open = deps.expandedGroups.has(row.original.key);
        return (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              deps.onToggleExpand(row.original.key);
            }}
            aria-expanded={open}
            aria-label={open ? '收起进货明细' : '展开进货明细'}
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
          >
            <ChevronRight20Regular className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          </button>
        );
      },
      meta: { thClassName: 'w-8 !px-1', tdClassName: 'w-8 !px-1' },
    },
    {
      id: 'product',
      enableSorting: false,
      header: '商品',
      cell: ({ row }) => {
        const g = row.original;
        return (
          <div className="flex items-center gap-2">
            {g.imageUrl && <ProductImage src={g.imageUrl} alt={g.productName} size="sm" className="flex-shrink-0" />}
            <div className="min-w-0">
              <div className="line-clamp-2 break-cjk text-sm font-medium leading-snug text-[var(--color-text)]">{g.productName}</div>
              {g.janCode && <CopyableJan jan={g.janCode} className="mt-0.5 block text-xs text-[var(--color-text-muted)]" />}
            </div>
          </div>
        );
      },
    },
    {
      id: 'avg_price',
      enableSorting: false,
      header: () => (
        <div className="text-right">
          <div>平均单价</div>
          <div className="text-[10px] font-normal text-[var(--color-text-muted)]">(不含返点)</div>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-medium text-[var(--color-text)]">{formatCurrency(row.original.avgUnitPrice)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">合计 {formatCurrency(row.original.totalPurchasePrice)}</div>
        </div>
      ),
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'qty',
      enableSorting: false,
      header: '数量',
      cell: ({ row }) => <span className="text-[var(--color-text)]">{row.original.totalQuantity}</span>,
      meta: { align: 'right' },
    },
    {
      id: 'status',
      enableSorting: false,
      header: '状态',
      cell: ({ row }) => {
        const g = row.original;
        // 买取X：未到 / 库存 / 已售 / 退货 分项标签，有几项显示几项
        return (
          <div className="flex flex-wrap gap-0.5">
            {g.totalPending > 0 && <span className={`${badge.pending} whitespace-nowrap`}>未到货 {g.totalPending}</span>}
            {g.totalInStock > 0 && <span className={`${badge.info} whitespace-nowrap`}>库存 {g.totalInStock}</span>}
            {g.totalSold > 0 && <span className={`${badge.success} whitespace-nowrap`}>已售 {g.totalSold}</span>}
            {g.totalReturned > 0 && <span className={`${badge.error} whitespace-nowrap`}>退货 {g.totalReturned}</span>}
          </div>
        );
      },
    },
    {
      id: 'profit',
      enableSorting: false,
      header: () => (
        <button onClick={() => deps.toggleSort('total_profit')} className="ml-auto flex items-center gap-1 whitespace-nowrap hover:text-[var(--color-text)]">
          利润 / 预估
          {deps.sortField === 'total_profit' && <SortChevron asc={deps.sortOrder === 'asc'} />}
        </button>
      ),
      cell: ({ row }) => {
        const g = row.original;
        return (
          <div className="text-right">
            <div>{g.totalProfit != null ? <Money value={g.totalProfit} /> : <span className="text-[var(--color-text-muted)]">—</span>}</div>
            {g.totalExpectedProfit !== 0 && (
              <div className={`text-xs ${g.totalExpectedProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                ≈{formatCurrency(g.totalExpectedProfit)}
              </div>
            )}
          </div>
        );
      },
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'buyback',
      enableSorting: false,
      header: () => (
        <button onClick={() => deps.toggleSort('buyback_price')} className="ml-auto flex items-center gap-1 whitespace-nowrap hover:text-[var(--color-text)]">
          当前最高价
          {deps.sortField === 'buyback_price' && <SortChevron asc={deps.sortOrder === 'asc'} />}
        </button>
      ),
      cell: ({ row }) => {
        const g = row.original;
        if (!g.bestBuybackPrice) return <span className="text-[var(--color-text-muted)]">—</span>;
        return (
          <div className="text-right">
            <div className="font-medium text-[var(--color-text)]">{formatCurrency(g.bestBuybackPrice)}</div>
            <div className="text-xs text-[var(--color-primary)]">{g.bestBuybackStore}</div>
          </div>
        );
      },
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            deps.onSellGroup(row.original);
          }}
          disabled={row.original.totalInStock <= 0}
          className="whitespace-nowrap rounded px-2 py-0.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          出售
        </button>
      ),
      meta: { align: 'center', thClassName: '!px-2', tdClassName: '!px-2' },
    },
  );

  return columns;
}
