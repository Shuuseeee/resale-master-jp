// components/TransactionRow.tsx - 桌面端表格行
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { badge } from '@/lib/theme';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import { ProductImage } from '@/components/OptimizedImage';
import Toast from '@/components/Toast';

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
}

interface TransactionRowProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  buybackInfo?: BuybackInfo;
}

export default function TransactionRow({
  transaction,
  dateSortMode,
  onDelete,
  onMarkArrived,
  buybackInfo,
}: TransactionRowProps) {
  const router = useRouter();
  const remainingQty = transaction.quantity - (transaction.quantity_sold || 0);
  const hasSoldOut = remainingQty <= 0;
  const [showToast, setShowToast] = useState(false);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true);
    });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('a, button');
    if (!isInteractiveElement) {
      router.push(`/transactions/${transaction.id}`);
    }
  };

  const getStatusBadge = () => {
    if (transaction.status === 'pending') {
      return <span className={badge.info + ' border border-teal-500/30'}>未着</span>;
    } else if (transaction.status === 'sold') {
      return <span className={badge.success + ' border border-emerald-500/30'}>已售出</span>;
    } else if (transaction.status === 'returned') {
      return <span className={badge.error + ' border border-red-500/30'}>已退货</span>;
    } else if (transaction.status === 'awaiting_payment') {
      return <span className={badge.awaiting + ' border border-indigo-500/30'}>入金待ち</span>;
    } else {
      return <span className={badge.pending + ' border border-amber-500/30'}>库存中</span>;
    }
  };

  return (
    <>
    <tr
      className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      onClick={handleRowClick}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {transaction.image_url && (
            <ProductImage
              src={transaction.image_url}
              alt={transaction.product_name}
              size="sm"
              className="flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-gray-900 dark:text-white font-medium line-clamp-2 break-cjk leading-snug">{transaction.product_name}</div>
            {transaction.payment_method && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {transaction.payment_method.name}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {dateSortMode === 'sale' && transaction.latest_sale_date ? (
          <span>{new Date(transaction.latest_sale_date).toLocaleDateString('zh-CN')}</span>
        ) : dateSortMode === 'sale' ? (
          <span className="text-gray-500 dark:text-gray-500">未售出</span>
        ) : (
          new Date(transaction.date).toLocaleDateString('zh-CN')
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge()}
      </td>
      <td className="px-6 py-4 text-left">
        {transaction.jan_code ? (
          <button
            onClick={(e) => copyToClipboard(transaction.jan_code!, e)}
            className="text-gray-700 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 font-mono text-sm transition-colors cursor-pointer"
            title="点击复制"
          >
            {transaction.jan_code}
          </button>
        ) : (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-mono">
        {formatCurrency(transaction.purchase_price_total)}
      </td>
      <td className="px-6 py-4 text-right font-mono">
        {(transaction as any).aggregated_profit !== null && (transaction as any).aggregated_profit !== undefined ? (
          <div className="flex flex-col items-end">
            <span className={(transaction as any).aggregated_profit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
              {formatCurrency((transaction as any).aggregated_profit)}
            </span>
            {transaction.status === 'in_stock' && transaction.quantity_sold > 0 && (
              <span className="text-xs text-teal-600 dark:text-teal-400">部分销售</span>
            )}
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right font-mono">
        {(transaction as any).aggregated_roi !== null && (transaction as any).aggregated_roi !== undefined ? (
          <span className={(transaction as any).aggregated_roi >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
            {formatROI((transaction as any).aggregated_roi)}
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right font-mono">
        {hasSoldOut ? (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        ) : buybackInfo?.loading ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        ) : buybackInfo && buybackInfo.maxPrice > 0 ? (
          <div className="flex flex-col items-end">
            <span className="text-teal-600 dark:text-teal-300">
              {formatCurrency(buybackInfo.maxPrice)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{buybackInfo.maxStore}</span>
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right font-mono">
        {hasSoldOut ? (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        ) : buybackInfo?.loading ? (
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto"></div>
        ) : buybackInfo && buybackInfo.maxPrice > 0 ? (
          <span className={buybackInfo.expectedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
            {formatCurrency(buybackInfo.expectedProfit)}
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {transaction.status === 'pending' && onMarkArrived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkArrived(transaction.id);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all active:scale-95"
              title="着荷"
            >
              着荷
            </button>
          )}
          <Link
            href={`/transactions/${transaction.id}`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-all active:scale-95"
            title="查看详情"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>
          <Link
            href={`/transactions/${transaction.id}/edit`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all active:scale-95"
            title="编辑"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(transaction.id);
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
            title="删除"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
    {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
}
