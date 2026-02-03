// components/TransactionCard.tsx - 移动端卡片
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { badge } from '@/lib/theme';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import { ProductImage } from '@/components/OptimizedImage';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
}

interface TransactionCardProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
}

export default function TransactionCard({
  transaction,
  dateSortMode,
  onDelete,
}: TransactionCardProps) {
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('a, button');
    if (!isInteractiveElement) {
      router.push(`/transactions/${transaction.id}`);
    }
  };

  const displayDate = dateSortMode === 'sale'
    ? transaction.latest_sale_date
      ? new Date(transaction.latest_sale_date).toLocaleDateString('zh-CN')
      : '未售出'
    : new Date(transaction.date).toLocaleDateString('zh-CN');

  const getStatusBadge = () => {
    if (transaction.status === 'sold') {
      return <span className={badge.success + ' border border-emerald-500/30'}>已售出</span>;
    } else if (transaction.status === 'returned') {
      return <span className={badge.error + ' border border-red-500/30'}>已退货</span>;
    } else {
      return <span className={badge.pending + ' border border-amber-500/30'}>库存中</span>;
    }
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
      onClick={handleCardClick}
    >
      <div className="flex gap-3 mb-3">
        {transaction.image_url && (
          <ProductImage
            src={transaction.image_url}
            alt={transaction.product_name}
            size="md"
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 break-cjk leading-snug mb-1">
            {transaction.product_name}
          </h3>
          {transaction.payment_method && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {transaction.payment_method.name}
            </p>
          )}
          <div className="mt-1">{getStatusBadge()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <span className="text-gray-600 dark:text-gray-400 text-xs">日期</span>
          <p className="text-gray-900 dark:text-white font-medium">{displayDate}</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400 text-xs">成本</span>
          <p className="text-gray-900 dark:text-white font-medium font-mono">
            {formatCurrency(transaction.purchase_price_total)}
          </p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400 text-xs">利润</span>
          <p className={`font-medium font-mono ${
            (transaction as any).aggregated_profit !== null && (transaction as any).aggregated_profit !== undefined
              ? (transaction as any).aggregated_profit >= 0 ? 'text-emerald-600' : 'text-red-600'
              : 'text-gray-500 dark:text-gray-500'
          }`}>
            {(transaction as any).aggregated_profit !== null && (transaction as any).aggregated_profit !== undefined
              ? formatCurrency((transaction as any).aggregated_profit)
              : '-'}
          </p>
          {transaction.status === 'in_stock' && transaction.quantity_sold > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400">部分销售</span>
          )}
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400 text-xs">ROI</span>
          <p className={`font-medium font-mono ${
            (transaction as any).aggregated_roi !== null && (transaction as any).aggregated_roi !== undefined
              ? (transaction as any).aggregated_roi >= 0 ? 'text-emerald-600' : 'text-red-600'
              : 'text-gray-500 dark:text-gray-500'
          }`}>
            {(transaction as any).aggregated_roi !== null && (transaction as any).aggregated_roi !== undefined
              ? formatROI((transaction as any).aggregated_roi)
              : '-'}
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/transactions/${transaction.id}`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all active:scale-95"
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
      </div>
    </div>
  );
}
