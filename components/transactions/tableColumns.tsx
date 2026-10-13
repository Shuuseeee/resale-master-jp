// components/transactions/tableColumns.tsx
// 交易列表桌面表格的 ColumnDef 工厂（TanStack Table）
// 一行一笔进货（平铺表格、JAN 分组展开后的小表共用）；JAN 分组表的列在 groupColumns.tsx
// 排序/多选状态不进 TanStack：表头按钮直接调 page 的 toggleSort 等 handler（机械移植，零桥接）

'use client';

import { useState } from 'react';
import { ArrowDown12Regular } from '@fluentui/react-icons/headless/svg/arrow-down';
import { ArrowUp12Regular } from '@fluentui/react-icons/headless/svg/arrow-up';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/financial/calculator';
import type { TransactionWithProfit } from '@/lib/api/transactions-cache';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import { COLUMN_LABELS } from '@/lib/transactions/columns';
import { SELECT_COLUMN_ID } from '@/components/DataTable';
import CopyableJan from '@/components/CopyableJan';
import Toast from '@/components/Toast';
import { ProductImage } from '@/components/OptimizedImage';
import { sellableQty } from '@/lib/utils/arrivals';
import { TransactionStatusBadge } from '@/components/transactions/StatusBadge';

/** 平铺表格与分组展开小表的一行（一笔进货）；JAN 分组表是另一张表（groupColumns.tsx） */
export type TxRowItem = { kind: 'tx'; tx: TransactionWithProfit };

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi' | 'buyback_price' | 'expected_profit';

export interface TransactionTableDeps {
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
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkArrived: (id: string) => void;
  onConfirmPayment: (id: string) => void;
  onQuickSale: (id: string) => void;
  onQuickReturn: (id: string) => void;
  onQuickEdit: (id: string) => void;
  onQuickCopy: (id: string) => void;
}

/** 表头排序方向：Fluent 可排序表头的 12px 箭头（10-table.css） */
function SortChevron({ asc }: { asc: boolean }) {
  return asc ? <ArrowUp12Regular className="shrink-0" /> : <ArrowDown12Regular className="shrink-0" />;
}

/** 方形复选框的外观（Fluent Checkbox，globals.css .fluent-checkbox）；点击由外层按钮 / 行处理 */
function CheckMark({ state }: { state: boolean | 'mixed' }) {
  return <span className="fluent-checkbox" data-checked={state === 'mixed' ? 'mixed' : state ? 'true' : 'false'} aria-hidden="true" />;
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

export function buildTransactionColumns(deps: TransactionTableDeps): ColumnDef<TxRowItem>[] {
  const columns: ColumnDef<TxRowItem>[] = [];

  // 勾选列常驻（桌面表格，照买取X；手机卡片另有选择模式）；与列定制解耦，page 侧在 columnOrder 前插 '_select'
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
        <CheckMark state={deps.allVisibleSelected ? true : deps.someVisibleSelected ? 'mixed' : false} />
      </button>
    ),
    cell: ({ row }) => {
      const id = row.original.tx.id;
      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            deps.onToggleSelect(id);
          }}
          aria-label="选择这笔"
          className="flex items-center"
        >
          <CheckMark state={deps.selectedIds.has(id)} />
        </button>
      );
    },
    meta: { thClassName: 'w-10 !pl-4 !pr-1', tdClassName: 'w-10 !pl-4 !pr-1' },
  });
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
        const tx = row.original.tx;
        const thumbSrc = tx.image_url || deps.getJanThumbnail(tx.jan_code);
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
        return row.original.tx.payment_method?.name || '-';
      },
      meta: { tdClassName: 'whitespace-nowrap text-sm' },
    },
    {
      id: 'status',
      enableSorting: false,
      header: COLUMN_LABELS.status,
      cell: ({ row }) => {
        return <TransactionStatusBadge tx={row.original.tx} showStock />;
      },
    },
    {
      id: 'arrived',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const tx = row.original.tx;
        if (tx.status !== 'pending') return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deps.onMarkArrived(tx.id);
            }}
            className="px-2 py-1 text-xs font-semibold bg-[var(--color-warning-bg)] hover:brightness-[1.08] active:brightness-[0.92] text-white rounded transition-colors whitespace-nowrap"
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
        const tx = row.original.tx;
        return (
          <div className="flex flex-col gap-0.5 min-w-[90px]">
            <div className="flex gap-1">
              <Link href={`/transactions/${tx.id}`} className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded text-center transition-colors whitespace-nowrap">详情</Link>
              <button
                onClick={(e) => { e.stopPropagation(); deps.onQuickEdit(tx.id); }}
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
              >
                编辑
              </button>
              {tx.status !== 'awaiting_payment' && (
                <button
                  onClick={(e) => { e.stopPropagation(); deps.onQuickSale(tx.id); }}
                  disabled={sellableQty(tx) <= 0}
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
                className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
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
