// components/TransactionCard.tsx - 移动端卡片
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/financial/calculator';
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

interface TransactionCardProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  buybackInfo?: BuybackInfo;
  purchasePlatforms?: Array<{ id: string; name: string }>;
}

export default function TransactionCard({
  transaction,
  dateSortMode,
  onDelete,
  onMarkArrived,
  buybackInfo,
  purchasePlatforms = [],
}: TransactionCardProps) {
  const router = useRouter();
  const remainingQty = transaction.quantity - (transaction.quantity_sold || 0);
  const hasSoldOut = remainingQty <= 0;
  const [showToast, setShowToast] = useState(false);
  const platformName = purchasePlatforms.find(p => p.id === transaction.purchase_platform_id)?.name || null;

  const totalPoints = (transaction.expected_platform_points || 0)
    + (transaction.expected_card_points || 0)
    + (transaction.extra_platform_points || 0);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('a, button');
    if (!isInteractiveElement) {
      router.push(`/transactions/${transaction.id}`);
    }
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true);
    });
  };

  const displayDate = dateSortMode === 'sale'
    ? transaction.latest_sale_date
      ? new Date(transaction.latest_sale_date).toLocaleDateString('ja-JP')
      : '未售出'
    : new Date(transaction.date).toLocaleDateString('ja-JP');

  const getStatusBadge = () => {
    switch (transaction.status) {
      case 'pending':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-300 rounded">未到货</span>;
      case 'in_stock':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded">库存{remainingQty}</span>;
      case 'awaiting_payment':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-300 rounded">待入账</span>;
      case 'sold':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 border border-green-300 rounded">已完成</span>;
      case 'returned':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded">已退货</span>;
      default:
        return null;
    }
  };

  return (
    <>
    <div
      className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
      onClick={handleCardClick}
    >
      {/* 顶部：图片 + 商品名 + 状态 */}
      <div className="flex gap-3 mb-2">
        {transaction.image_url && (
          <ProductImage
            src={transaction.image_url}
            alt={transaction.product_name}
            size="sm"
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 break-cjk leading-snug">
            {transaction.product_name}
          </h3>
          {transaction.jan_code && (
            <button
              onClick={(e) => copyToClipboard(transaction.jan_code!, e)}
              className="text-xs font-mono text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 mt-0.5"
              title="点击复制JAN"
            >
              {transaction.jan_code}
            </button>
          )}
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge()}
            {transaction.status === 'pending' && onMarkArrived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkArrived(transaction.id);
                }}
                className="px-2 py-0.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
              >
                着荷
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 数据网格 */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm mb-2">
        <div>
          <span className="text-gray-400 text-xs">日期</span>
          <p className="text-gray-900 dark:text-white text-xs font-medium">{displayDate}</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">单价</span>
          <p className="text-gray-900 dark:text-white text-xs font-medium font-mono">
            {formatCurrency(transaction.unit_price || transaction.purchase_price_total)}
          </p>
          {totalPoints > 0 && (
            <p className="text-[10px] text-gray-400">返{formatCurrency(totalPoints)}</p>
          )}
        </div>
        <div>
          <span className="text-gray-400 text-xs">数量</span>
          <p className="text-gray-900 dark:text-white text-xs font-medium">{transaction.quantity}</p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">渠道</span>
          <p className="text-xs">
            {platformName ? (
              <span className="text-blue-600 dark:text-blue-400">{platformName}</span>
            ) : '-'}
          </p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">账号</span>
          <p className="text-gray-700 dark:text-gray-300 text-xs truncate">
            {transaction.payment_method?.name || '-'}
          </p>
        </div>
        <div>
          <span className="text-gray-400 text-xs">利润</span>
          <p className={`text-xs font-medium font-mono ${
            (transaction as any).aggregated_profit != null
              ? (transaction as any).aggregated_profit >= 0 ? 'text-green-600' : 'text-red-600'
              : 'text-gray-400'
          }`}>
            {(transaction as any).aggregated_profit != null
              ? formatCurrency((transaction as any).aggregated_profit)
              : '-'}
          </p>
        </div>
        {!hasSoldOut && buybackInfo && buybackInfo.maxPrice > 0 && (
          <>
            <div>
              <span className="text-gray-400 text-xs">買取価格</span>
              <p className="text-xs font-medium font-mono text-gray-900 dark:text-white">
                {formatCurrency(buybackInfo.maxPrice)}
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400">{buybackInfo.maxStore}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">見込利益</span>
              <p className={`text-xs font-medium font-mono ${buybackInfo.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ≈{formatCurrency(buybackInfo.expectedProfit)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 订单号（如有） */}
      {transaction.order_number && (
        <div className="mb-2">
          <button
            onClick={(e) => copyToClipboard(transaction.order_number!, e)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-full block"
            title={transaction.order_number}
          >
            订单: {transaction.order_number}
          </button>
        </div>
      )}

      {/* 操作栏 */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/transactions/${transaction.id}`} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">详情</Link>
          <Link href={`/transactions/${transaction.id}/edit`} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">编辑</Link>
          <Link href={`/transactions/${transaction.id}`} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">出售</Link>
          <Link href={`/transactions/add?copy=${transaction.id}`} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">复制</Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(transaction.id);
            }}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors cursor-pointer"
          >
            删除
          </button>
        </div>
      </div>
    </div>
    {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
}
