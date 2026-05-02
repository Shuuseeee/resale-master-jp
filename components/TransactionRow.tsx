// components/TransactionRow.tsx - 桌面端紧凑表格行
'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/financial/calculator';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import Toast from '@/components/Toast';
import type { TransactionColumnKey } from '@/lib/transactions/columns';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
}

interface BuybackInfo {
  maxPrice: number;
  maxStore: string;
  expectedProfit: number;
  loading: boolean;
  source?: 'cache' | 'stale' | 'pending';
  fetchedAt?: number;
}

interface TransactionRowProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  onQuickSale?: (id: string) => void;
  onQuickReturn?: (id: string) => void;
  onQuickEdit?: (id: string) => void;
  onQuickCopy?: (id: string) => void;
  buybackInfo?: BuybackInfo;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isGroupChild?: boolean;
  visibleColumns: TransactionColumnKey[];
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  dateSortMode,
  onDelete,
  onMarkArrived,
  onQuickSale,
  onQuickReturn,
  onQuickEdit,
  onQuickCopy,
  buybackInfo,
  purchasePlatforms = [],
  compareMode = false,
  isSelected = false,
  onToggleSelect,
  isGroupChild = false,
  visibleColumns,
}: TransactionRowProps) {
  const remainingQty = transaction.quantity - (transaction.quantity_sold || 0);
  const [showToast, setShowToast] = useState(false);
  const platformName = purchasePlatforms.find(p => p.id === transaction.purchase_platform_id)?.name || null;

  const totalPoints = (transaction.expected_platform_points || 0)
    + (transaction.expected_card_points || 0)
    + (transaction.extra_platform_points || 0);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true);
    });
  };

  const getStatusBadge = () => {
    switch (transaction.status) {
      case 'pending':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] bg-[rgba(245,158,11,0.12)] rounded whitespace-nowrap">未到货</span>;
      case 'in_stock':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-subtle)] rounded whitespace-nowrap">库存{remainingQty}</span>;
      case 'awaiting_payment':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] bg-[rgba(245,158,11,0.12)] rounded whitespace-nowrap">待入账</span>;
      case 'sold':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-success)] bg-[rgba(16,185,129,0.12)] rounded whitespace-nowrap">已完成</span>;
      case 'returned':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-danger)] bg-[rgba(239,68,68,0.12)] rounded whitespace-nowrap">已退货</span>;
      default:
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] rounded whitespace-nowrap">-</span>;
    }
  };

  const displayDate = dateSortMode === 'sale' && transaction.latest_sale_date
    ? new Date(transaction.latest_sale_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : new Date(transaction.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const handleRowClick = compareMode
    ? (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('a, button')) return;
        onToggleSelect?.(transaction.id);
      }
    : undefined;

  const selectCheckbox = compareMode ? (
    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
      isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
    }`}>
      {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
    </div>
  ) : null;

  // 每列的完整 <td> 渲染
  const cellMap: Record<TransactionColumnKey, () => React.ReactNode> = {
    date: () => (
      <td key="date" className="px-4 py-3 text-[var(--color-text)] whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span>{displayDate}</span>
        </div>
      </td>
    ),

    product: () => (
      <td key="product" className="px-3 py-2">
        <div className="flex items-center gap-2">
          {selectCheckbox}
          <div className="min-w-0">
            <Link
              href={`/transactions/${transaction.id}`}
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] line-clamp-2 break-cjk leading-snug text-sm font-medium"
            >
              {transaction.product_name}
            </Link>
            {transaction.jan_code && (
              <button
                onClick={(e) => copyToClipboard(transaction.jan_code!, e)}
                className="block mt-0.5 font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                title="点击复制JAN"
              >
                {transaction.jan_code}
              </button>
            )}
          </div>
        </div>
      </td>
    ),

    price: () => (
      <td key="price" className="px-4 py-3 whitespace-nowrap">
        <div className="text-[var(--color-text)] font-medium">
          {formatCurrency(transaction.unit_price || transaction.purchase_price_total)}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {transaction.quantity > 1 && <span>×{transaction.quantity} </span>}
          {totalPoints > 0 && <span>返{formatCurrency(totalPoints)}</span>}
        </div>
      </td>
    ),

    channel: () => (
      <td key="channel" className="px-4 py-3 whitespace-nowrap">
        {platformName ? (
          <span className="text-[var(--color-primary)]">{platformName}</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        )}
      </td>
    ),

    order: () => (
      <td key="order" className="px-4 py-3">
        {transaction.order_number ? (
          <button
            onClick={(e) => copyToClipboard(transaction.order_number!, e)}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] text-sm max-w-[100px] truncate block cursor-pointer"
            title={transaction.order_number}
          >
            {transaction.order_number}
          </button>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        )}
      </td>
    ),

    account: () => (
      <td key="account" className="px-4 py-3 text-[var(--color-text)] whitespace-nowrap text-sm">
        {transaction.payment_method?.name || '-'}
      </td>
    ),

    status: () => (
      <td key="status" className="px-4 py-3">
        {getStatusBadge()}
      </td>
    ),

    arrived: () => (
      <td key="arrived" className="px-2 py-2 text-center">
        {transaction.status === 'pending' && onMarkArrived && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkArrived(transaction.id);
            }}
            className="px-2 py-1 text-xs font-semibold bg-[var(--color-warning)] hover:bg-[#d97706] text-white rounded transition-colors whitespace-nowrap"
          >
            着荷
          </button>
        )}
      </td>
    ),

    profit: () => (
      <td key="profit" className="px-4 py-3 whitespace-nowrap text-right">
        <div>
          {(transaction as any).aggregated_profit != null ? (
            <span className={`font-medium ${(transaction as any).aggregated_profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatCurrency((transaction as any).aggregated_profit)}
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
      </td>
    ),

    buyback: () => (
      <td key="buyback" className="px-4 py-3 whitespace-nowrap text-right">
        {buybackInfo?.loading ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-4 w-16 bg-[var(--color-bg-subtle)] rounded animate-pulse"></div>
            <div className="h-3 w-12 bg-[var(--color-bg-subtle)] rounded animate-pulse"></div>
          </div>
        ) : buybackInfo && buybackInfo.maxPrice > 0 ? (
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
        ) : buybackInfo?.source === 'pending' ? (
          <span className="text-xs text-[var(--color-text-muted)] animate-pulse">获取中...</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        )}
      </td>
    ),

    actions: () => (
      <td key="actions" className="px-2 py-2">
        <div className="flex flex-col gap-0.5 min-w-[90px]">
          <div className="flex gap-1">
            <Link href={`/transactions/${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center transition-colors whitespace-nowrap">详情</Link>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickEdit?.(transaction.id); }}
              className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              编辑
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickSale?.(transaction.id); }}
              disabled={transaction.quantity_in_stock <= 0}
              className="flex-1 px-1 py-0.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
            >
              出售
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onQuickCopy?.(transaction.id); }}
              className="flex-1 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              复制
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickReturn?.(transaction.id); }}
              disabled={transaction.quantity_in_stock <= 0}
              className="flex-1 px-1 py-0.5 text-xs text-[var(--color-warning)] hover:bg-[rgba(245,158,11,0.12)] rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
            >
              退货
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transaction.id);
              }}
              className="flex-1 px-1 py-0.5 text-xs text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.12)] rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              删除
            </button>
          </div>
        </div>
      </td>
    ),
  };

  return (
    <>
    <tr
      onClick={handleRowClick}
      className={`border-b border-[var(--color-border)] text-sm transition-colors hover:bg-[var(--color-bg-subtle)] ${
        isGroupChild ? 'border-l-4 border-l-[var(--color-primary)] bg-[var(--color-bg-subtle)]/70' : ''
      } ${
        compareMode
          ? isSelected
            ? 'bg-[var(--color-primary-light)] cursor-pointer'
            : 'cursor-pointer'
          : ''
      }`}
    >
      {visibleColumns.map(key => cellMap[key]())}
    </tr>
    {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
});

export default TransactionRow;
