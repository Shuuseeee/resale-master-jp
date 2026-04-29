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
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-orange bg-apple-orange/10 border-apple-orange/30 rounded whitespace-nowrap">未到货</span>;
      case 'in_stock':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-blue bg-apple-blue/10 border-apple-blue/30 rounded whitespace-nowrap">库存{remainingQty}</span>;
      case 'awaiting_payment':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-orange bg-apple-orange/10 border-apple-orange/30 rounded whitespace-nowrap">待入账</span>;
      case 'sold':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-green bg-apple-green/10 border-apple-green/30 rounded whitespace-nowrap">已完成</span>;
      case 'returned':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-red bg-apple-red/10 border border-apple-red/30 rounded whitespace-nowrap">已退货</span>;
      default:
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-apple-gray-1 bg-apple-gray-6 border-apple-separator rounded whitespace-nowrap">-</span>;
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
      isSelected ? 'bg-apple-blue border-apple-blue' : 'bg-white dark:bg-gray-800 border-apple-separator dark:border-apple-sepDark'
    }`}>
      {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
    </div>
  ) : null;

  // 每列的完整 <td> 渲染
  const cellMap: Record<TransactionColumnKey, () => React.ReactNode> = {
    date: () => (
      <td key="date" className="px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">
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
              className="text-apple-blue hover:underline line-clamp-2 break-cjk leading-snug text-sm"
            >
              {transaction.product_name}
            </Link>
            {transaction.jan_code && (
              <button
                onClick={(e) => copyToClipboard(transaction.jan_code!, e)}
                className="block mt-0.5 font-mono text-xs text-apple-gray-2 hover:text-apple-blue transition-colors cursor-pointer"
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
      <td key="price" className="px-3 py-2 whitespace-nowrap">
        <div className="text-gray-900 dark:text-white font-medium">
          {formatCurrency(transaction.unit_price || transaction.purchase_price_total)}
        </div>
        <div className="text-xs text-apple-gray-2">
          {transaction.quantity > 1 && <span>×{transaction.quantity} </span>}
          {totalPoints > 0 && <span>返{formatCurrency(totalPoints)}</span>}
        </div>
      </td>
    ),

    channel: () => (
      <td key="channel" className="px-3 py-2 whitespace-nowrap">
        {platformName ? (
          <span className="text-apple-blue">{platformName}</span>
        ) : (
          <span className="text-apple-gray-2">-</span>
        )}
      </td>
    ),

    order: () => (
      <td key="order" className="px-3 py-2">
        {transaction.order_number ? (
          <button
            onClick={(e) => copyToClipboard(transaction.order_number!, e)}
            className="text-apple-blue hover:underline text-sm max-w-[100px] truncate block cursor-pointer"
            title={transaction.order_number}
          >
            {transaction.order_number}
          </button>
        ) : (
          <span className="text-apple-gray-2">-</span>
        )}
      </td>
    ),

    account: () => (
      <td key="account" className="px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap text-sm">
        {transaction.payment_method?.name || '-'}
      </td>
    ),

    status: () => (
      <td key="status" className="px-3 py-2">
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
            className="px-2 py-1 text-xs font-medium bg-apple-orange active:opacity-80 text-white rounded transition-colors whitespace-nowrap"
          >
            着荷
          </button>
        )}
      </td>
    ),

    profit: () => (
      <td key="profit" className="px-3 py-2 whitespace-nowrap text-right">
        <div>
          {(transaction as any).aggregated_profit != null ? (
            <span className={`font-medium ${(transaction as any).aggregated_profit >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>
              {formatCurrency((transaction as any).aggregated_profit)}
            </span>
          ) : (
            <span className="text-apple-gray-2">-</span>
          )}
        </div>
        {buybackInfo && buybackInfo.maxPrice > 0 && buybackInfo.expectedProfit !== 0 && (
          <div className={`text-xs ${buybackInfo.expectedProfit >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>
            ≈{formatCurrency(buybackInfo.expectedProfit)}
          </div>
        )}
      </td>
    ),

    buyback: () => (
      <td key="buyback" className="px-3 py-2 whitespace-nowrap text-right">
        {buybackInfo?.loading ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-4 w-16 bg-apple-gray-5 dark:bg-white/10 rounded animate-pulse"></div>
            <div className="h-3 w-12 bg-apple-gray-5 dark:bg-white/10 rounded animate-pulse"></div>
          </div>
        ) : buybackInfo && buybackInfo.maxPrice > 0 ? (
          <div>
            <div className="text-gray-900 dark:text-white font-medium">
              {formatCurrency(buybackInfo.maxPrice)}
              {buybackInfo.source === 'stale' && buybackInfo.fetchedAt && (() => {
                const d = new Date(buybackInfo.fetchedAt);
                const isToday = d.toDateString() === new Date().toDateString();
                const label = isToday
                  ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                  : `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
                return <span className="ml-1 text-[10px] text-apple-orange/70" title="キャッシュ時刻">{label}</span>;
              })()}
            </div>
            <div className="text-xs text-apple-blue">
              {buybackInfo.maxStore}
            </div>
          </div>
        ) : buybackInfo?.source === 'pending' ? (
          <span className="text-xs text-apple-gray-2 animate-pulse">获取中...</span>
        ) : (
          <span className="text-apple-gray-2">-</span>
        )}
      </td>
    ),

    actions: () => (
      <td key="actions" className="px-2 py-2">
        <div className="flex flex-col gap-0.5 min-w-[90px]">
          <div className="flex gap-1">
            <Link href={`/transactions/${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-apple-gray-1 hover:text-gray-900 dark:hover:text-white active:bg-apple-gray-5 dark:active:bg-white/10 rounded text-center transition-colors whitespace-nowrap">详情</Link>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickEdit?.(transaction.id); }}
              className="flex-1 px-1 py-0.5 text-xs text-apple-gray-1 hover:text-gray-900 dark:hover:text-white active:bg-apple-gray-5 dark:active:bg-white/10 rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              编辑
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickSale?.(transaction.id); }}
              disabled={transaction.quantity_in_stock <= 0}
              className="flex-1 px-1 py-0.5 text-xs text-apple-blue hover:bg-apple-blue/5 rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
            >
              出售
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onQuickCopy?.(transaction.id); }}
              className="flex-1 px-1 py-0.5 text-xs text-apple-gray-1 hover:text-gray-900 dark:hover:text-white active:bg-apple-gray-5 dark:active:bg-white/10 rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              复制
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onQuickReturn?.(transaction.id); }}
              disabled={transaction.quantity_in_stock <= 0}
              className="flex-1 px-1 py-0.5 text-xs text-apple-orange hover:bg-apple-orange/5 rounded text-center cursor-pointer transition-colors whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
            >
              退货
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transaction.id);
              }}
              className="flex-1 px-1 py-0.5 text-xs text-apple-red hover:bg-apple-red/5 rounded text-center cursor-pointer transition-colors whitespace-nowrap"
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
      className={`border-b border-apple-separator dark:border-apple-sepDark/50 text-sm transition-colors ${
        isGroupChild ? 'border-l-4 border-l-apple-blue bg-apple-gray-6/50 dark:bg-white/5' : ''
      } ${
        compareMode
          ? isSelected
            ? 'bg-apple-blue/5 cursor-pointer'
            : 'cursor-pointer active:bg-apple-gray-6 dark:active:bg-white/5'
          : 'active:bg-apple-gray-6 dark:active:bg-white/5'
      }`}
    >
      {visibleColumns.map(key => cellMap[key]())}
    </tr>
    {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
});

export default TransactionRow;
