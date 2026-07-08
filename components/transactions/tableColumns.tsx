// components/transactions/tableColumns.tsx
// 交易列表桌面表格的 ColumnDef 工厂（TanStack Table）
// cell 内容按 row.original.kind 分支，一对一移植自 TransactionRow / TransactionGroupRow 的 cellMap
// 排序/多选状态不进 TanStack：表头按钮直接调 page 的 toggleSort 等 handler（机械移植，零桥接）

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/financial/calculator';
import type { TransactionWithProfit } from '@/lib/api/transactions-cache';
import type { TransactionGroup } from '@/app/transactions/page';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import { COLUMN_LABELS } from '@/lib/transactions/columns';
import { SELECT_COLUMN_ID } from '@/components/DataTable';
import CopyableJan from '@/components/CopyableJan';
import Toast from '@/components/Toast';
import { ProductImage } from '@/components/OptimizedImage';

export type TxRowItem =
  | { kind: 'group'; group: TransactionGroup; children: TxRowItem[] }
  | { kind: 'tx'; tx: TransactionWithProfit };

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi' | 'buyback_price' | 'expected_profit';

export interface TransactionTableDeps {
  compareMode: boolean;
  dateSortMode: 'purchase' | 'sale';
  profitSortMode: 'actual' | 'expected';
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  buybackPrices: Map<string, BuybackInfo>;
  purchasePlatforms: Array<{ id: string; name: string }>;
  getJanThumbnail: (janCode: string | null | undefined) => string | undefined;
  toggleSort: (field: SortField) => void;
  onToggleDateSortMode: () => void;
  onToggleProfitSortMode: () => void;
  toggleSelectAllVisible: () => void;
  onSelectGroup: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onMarkArrived: (id: string) => void;
  onConfirmPayment: (id: string) => void;
  onQuickSale: (id: string) => void;
  onQuickReturn: (id: string) => void;
  onQuickEdit: (id: string) => void;
  onQuickCopy: (id: string) => void;
}

/** 表头排序方向箭头（asc 时旋转） */
function SortChevron({ asc }: { asc: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${asc ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

/** 点击复制 + Toast 的通用文本（订单号列用；参照 CopyableJan） */
function CopyableText({ text, className = '' }: { text: string; className?: string }) {
  const [showToast, setShowToast] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text).then(() => setShowToast(true));
  };
  return (
    <>
      <span role="button" onClick={handleCopy} title={text} className={`cursor-pointer ${className}`}>
        {text}
      </span>
      {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
}

function statusBadge(tx: TransactionWithProfit) {
  const remainingQty = tx.quantity - (tx.quantity_sold || 0);
  switch (tx.status) {
    case 'pending':
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] bg-[var(--color-warning-subtle)] rounded whitespace-nowrap">未到货</span>;
    case 'in_stock':
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-subtle)] rounded whitespace-nowrap">库存{remainingQty}</span>;
    case 'awaiting_payment':
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] bg-[var(--color-warning-subtle)] rounded whitespace-nowrap">待入账</span>;
    case 'sold':
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-success)] bg-[var(--color-primary-subtle)] rounded whitespace-nowrap">已完成</span>;
    case 'returned':
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-subtle)] rounded whitespace-nowrap">已退货</span>;
    default:
      return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] rounded whitespace-nowrap">-</span>;
  }
}

export function buildTransactionColumns(deps: TransactionTableDeps): ColumnDef<TxRowItem>[] {
  const columns: ColumnDef<TxRowItem>[] = [];

  // 多选模式：独立选择列，与列定制解耦（page 侧在 columnOrder 前插 '_select'）
  if (deps.compareMode) {
    columns.push({
      id: SELECT_COLUMN_ID,
      enableSorting: false,
      header: () => (
        <button
          type="button"
          onClick={deps.toggleSelectAllVisible}
          aria-label="全选当前显示的记录"
          title="全选当前显示的记录"
          className="flex items-center"
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            deps.allVisibleSelected
              ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
              : deps.someVisibleSelected
                ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)]'
                : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
          }`}>
            {deps.allVisibleSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            )}
            {deps.someVisibleSelected && (
              <div className="w-2 h-0.5 bg-[var(--color-primary)] rounded" />
            )}
          </div>
        </button>
      ),
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const groupIds = row.original.group.transactions.map(t => t.id);
          const selectedCount = groupIds.filter(id => deps.selectedIds.has(id)).length;
          const allSelected = selectedCount === groupIds.length;
          const someSelected = selectedCount > 0 && !allSelected;
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deps.onSelectGroup(groupIds); }}
              aria-label="全选该组"
              className="flex items-center flex-shrink-0"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                allSelected
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                  : someSelected
                    ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
              }`}>
                {allSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                )}
                {someSelected && (
                  <div className="w-2 h-0.5 bg-[var(--color-primary)] rounded" />
                )}
              </div>
            </button>
          );
        }
        const isSelected = deps.selectedIds.has(row.original.tx.id);
        return (
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
          }`}>
            {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </div>
        );
      },
      meta: { thClassName: 'w-10 !pl-4 !pr-1', tdClassName: 'w-10 !pl-4 !pr-1' },
    });
  }

  columns.push(
    {
      id: 'date',
      enableSorting: false,
      header: () => (
        <div className="flex items-center gap-1">
          <button onClick={() => deps.toggleSort('date')} className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors">
            {deps.dateSortMode === 'purchase' ? '进货日期' : '销售日期'}
            {deps.sortField === 'date' && <SortChevron asc={deps.sortOrder === 'asc'} />}
          </button>
          <button
            onClick={deps.onToggleDateSortMode}
            className="ml-2 px-1.5 py-0.5 text-[11px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            title={deps.dateSortMode === 'purchase' ? '切换为按售出日期' : '切换为按进货日期'}
          >
            {deps.dateSortMode === 'purchase' ? '售出' : '进货'}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          return (
            <div className="flex items-center gap-1.5">
              <svg
                className={`w-3.5 h-3.5 text-[var(--color-primary)] transition-transform duration-200 flex-shrink-0 ${row.getIsExpanded() ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-xs text-[var(--color-text-muted)]">{row.original.group.latestDate}</span>
            </div>
          );
        }
        const tx = row.original.tx;
        const displayDate = deps.dateSortMode === 'sale' && tx.latest_sale_date
          ? new Date(tx.latest_sale_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : new Date(tx.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
        return <span>{displayDate}</span>;
      },
      meta: { tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'product',
      enableSorting: false,
      header: COLUMN_LABELS.product,
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const group = row.original.group;
          return (
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[var(--color-text)] truncate max-w-[200px]">
                    {group.productName}
                  </span>
                  <span className="flex-shrink-0 text-xs bg-[var(--color-primary)] text-[var(--color-text-inverted)] px-1.5 py-0.5 rounded-full font-medium">
                    ×{group.transactions.length}
                  </span>
                </div>
                <CopyableJan jan={group.janCode} className="block text-xs text-[var(--color-text-muted)]" />
              </div>
            </div>
          );
        }
        const tx = row.original.tx;
        const parent = row.getParentRow()?.original;
        const thumbSrc = tx.image_url
          || (parent && parent.kind === 'group' ? parent.group.imageUrl : deps.getJanThumbnail(tx.jan_code));
        return (
          <div className="flex items-center gap-2">
            {thumbSrc && (
              <ProductImage
                src={thumbSrc}
                alt={tx.product_name}
                size="sm"
                className="flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <Link
                href={`/transactions/${tx.id}`}
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] line-clamp-2 break-cjk leading-snug text-sm font-medium"
              >
                {tx.product_name}
              </Link>
              {tx.jan_code && (
                <CopyableJan jan={tx.jan_code} className="block mt-0.5 text-xs text-[var(--color-text-muted)]" />
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'price',
      enableSorting: false,
      header: () => (
        <div>
          <div>进货单价</div>
          <div className="text-[10px] text-[var(--color-text-muted)] font-normal normal-case">(不含返点)</div>
        </div>
      ),
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const group = row.original.group;
          return (
            <div className="text-right">
              <div className="text-sm font-mono text-[var(--color-text)]">{formatCurrency(group.totalPurchasePrice)}</div>
              <div className="text-xs text-[var(--color-text-muted)]">合计 ×{group.totalQuantity}</div>
            </div>
          );
        }
        const tx = row.original.tx;
        const totalPoints = (tx.expected_platform_points || 0)
          + (tx.expected_card_points || 0)
          + (tx.extra_platform_points || 0);
        return (
          <div>
            <div className="text-[var(--color-text)] font-medium">
              {formatCurrency(tx.unit_price || tx.purchase_price_total)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {tx.quantity > 1 && <span>×{tx.quantity} </span>}
              {totalPoints > 0 && <span>返{formatCurrency(totalPoints)}</span>}
            </div>
          </div>
        );
      },
      meta: { tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'channel',
      enableSorting: false,
      header: COLUMN_LABELS.channel,
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const tx = row.original.tx;
        const platformName = deps.purchasePlatforms.find(p => p.id === tx.purchase_platform_id)?.name || null;
        return platformName ? (
          <span className="text-[var(--color-primary)]">{platformName}</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        );
      },
      meta: { tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'order',
      enableSorting: false,
      header: COLUMN_LABELS.order,
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const tx = row.original.tx;
        return tx.order_number ? (
          <CopyableText
            text={tx.order_number}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] text-sm max-w-[100px] truncate block"
          />
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        );
      },
    },
    {
      id: 'account',
      enableSorting: false,
      header: COLUMN_LABELS.account,
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        return row.original.tx.payment_method?.name || '-';
      },
      meta: { tdClassName: 'whitespace-nowrap text-sm' },
    },
    {
      id: 'status',
      enableSorting: false,
      header: COLUMN_LABELS.status,
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const group = row.original.group;
          return (
            <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
              <div>库存 <span className="font-medium text-[var(--color-text)]">{group.totalInStock}</span></div>
              <div>已售 <span className="font-medium text-[var(--color-text)]">{group.totalSold}</span></div>
            </div>
          );
        }
        return statusBadge(row.original.tx);
      },
    },
    {
      id: 'arrived',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const tx = row.original.tx;
        if (tx.status !== 'pending') return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deps.onMarkArrived(tx.id);
            }}
            className="px-2 py-1 text-xs font-semibold bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] text-white rounded transition-colors whitespace-nowrap"
          >
            着荷
          </button>
        );
      },
      meta: { align: 'center', thClassName: '!px-2', tdClassName: '!px-2 !py-2' },
    },
    {
      id: 'profit',
      enableSorting: false,
      header: () => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          <button onClick={() => deps.toggleSort('total_profit')} className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors">
            {deps.profitSortMode === 'actual' ? '利润' : '预估利润'}
            {deps.sortField === 'total_profit' && <SortChevron asc={deps.sortOrder === 'asc'} />}
          </button>
          <button
            onClick={deps.onToggleProfitSortMode}
            className="px-1 py-0.5 text-[10px] bg-[var(--color-bg-elevated)] rounded hover:text-[var(--color-primary)] transition-colors"
            title="切换利润类型"
          >
            ⇄
          </button>
        </div>
      ),
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const group = row.original.group;
          return group.totalProfit != null ? (
            <span className={`text-sm font-mono font-medium ${group.totalProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {group.totalProfit >= 0 ? '+' : ''}{formatCurrency(group.totalProfit)}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          );
        }
        const tx = row.original.tx;
        const buybackInfo = deps.buybackPrices.get(tx.id);
        return (
          <>
            <div>
              {tx.aggregated_profit != null ? (
                <span className={`font-medium ${tx.aggregated_profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {formatCurrency(tx.aggregated_profit)}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]">-</span>
              )}
            </div>
            {buybackInfo && buybackInfo.maxPrice > 0 && buybackInfo.expectedProfit !== 0 && (
              <div className={`text-xs ${buybackInfo.expectedProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                ≈{formatCurrency(buybackInfo.expectedProfit)}
              </div>
            )}
          </>
        );
      },
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'buyback',
      enableSorting: false,
      header: () => (
        <button
          onClick={() => deps.toggleSort('buyback_price')}
          className="flex items-center justify-end gap-1 whitespace-nowrap hover:text-[var(--color-text)] transition-colors"
        >
          {COLUMN_LABELS.buyback}
          {deps.sortField === 'buyback_price' && <SortChevron asc={deps.sortOrder === 'asc'} />}
        </button>
      ),
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          const group = row.original.group;
          return group.bestBuybackPrice > 0 ? (
            <div>
              <div className="text-sm font-mono font-medium text-[var(--color-text)]">
                {formatCurrency(group.bestBuybackPrice)}
              </div>
              <div className="text-xs text-[var(--color-primary)]">{group.bestBuybackStore}</div>
            </div>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          );
        }
        const buybackInfo = deps.buybackPrices.get(row.original.tx.id);
        if (buybackInfo?.loading) {
          return (
            <div className="flex flex-col items-end gap-1">
              <div className="h-4 w-16 bg-[var(--color-bg-subtle)] rounded animate-pulse"></div>
              <div className="h-3 w-12 bg-[var(--color-bg-subtle)] rounded animate-pulse"></div>
            </div>
          );
        }
        if (buybackInfo && buybackInfo.maxPrice > 0) {
          return (
            <div>
              <div className="text-[var(--color-text)] font-medium">
                {formatCurrency(buybackInfo.maxPrice)}
                {buybackInfo.source === 'stale' && buybackInfo.fetchedAt && (() => {
                  const d = new Date(buybackInfo.fetchedAt);
                  const isToday = d.toDateString() === new Date().toDateString();
                  const label = isToday
                    ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    : `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
                  return <span className="ml-1 text-[10px] text-[var(--color-warning)] opacity-80" title="缓存时刻">{label}</span>;
                })()}
              </div>
              <div className="text-xs text-[var(--color-primary)]">
                {buybackInfo.maxStore}
              </div>
            </div>
          );
        }
        if (buybackInfo?.source === 'pending') {
          return <span className="text-xs text-[var(--color-text-muted)] animate-pulse">获取中...</span>;
        }
        return <span className="text-[var(--color-text-muted)]">-</span>;
      },
      meta: { align: 'right', tdClassName: 'whitespace-nowrap' },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: COLUMN_LABELS.actions,
      cell: ({ row }) => {
        if (row.original.kind === 'group') return null;
        const tx = row.original.tx;
        return (
          <div className="flex flex-col gap-0.5 min-w-[90px]">
            <div className="flex gap-1">
              <Link href={`/transactions/${tx.id}`} className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center transition-colors whitespace-nowrap">详情</Link>
              <button
                onClick={(e) => { e.stopPropagation(); deps.onQuickEdit(tx.id); }}
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
              >
                编辑
              </button>
              {tx.status !== 'awaiting_payment' && (
                <button
                  onClick={(e) => { e.stopPropagation(); deps.onQuickSale(tx.id); }}
                  disabled={tx.quantity_in_stock <= 0}
                  className="flex-1 px-1 py-0.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  出售
                </button>
              )}
              {tx.status === 'awaiting_payment' && (
                <button
                  onClick={(e) => { e.stopPropagation(); deps.onConfirmPayment(tx.id); }}
                  className="flex-1 px-1 py-0.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
                >
                  入账
                </button>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); deps.onQuickCopy(tx.id); }}
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
              >
                复制
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deps.onQuickReturn(tx.id); }}
                disabled={tx.quantity_in_stock <= 0}
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-warning)] hover:bg-[var(--color-warning-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
              >
                退货
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deps.onDelete(tx.id);
                }}
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
              >
                删除
              </button>
            </div>
          </div>
        );
      },
      meta: { align: 'center', thClassName: '!px-2', tdClassName: '!px-2 !py-2' },
    },
  );

  return columns;
}
