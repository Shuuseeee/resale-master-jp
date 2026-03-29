// components/TransactionRow.tsx - 桌面端紧凑表格行
'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/financial/calculator';
import type { Transaction, PaymentMethod } from '@/types/database.types';
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
  source?: 'cache' | 'stale' | 'pending';
}

interface TransactionRowProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  buybackInfo?: BuybackInfo;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isGroupChild?: boolean;
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  dateSortMode,
  onDelete,
  onMarkArrived,
  buybackInfo,
  purchasePlatforms = [],
  compareMode = false,
  isSelected = false,
  onToggleSelect,
  isGroupChild = false,
}: TransactionRowProps) {
  const remainingQty = transaction.quantity - (transaction.quantity_sold || 0);
  const [showToast, setShowToast] = useState(false);
  const platformName = purchasePlatforms.find(p => p.id === transaction.purchase_platform_id)?.name || null;

  // 返点合计
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
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-300 rounded whitespace-nowrap">未到货</span>;
      case 'in_stock':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-300 rounded whitespace-nowrap">库存{remainingQty}</span>;
      case 'awaiting_payment':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-300 rounded whitespace-nowrap">待入账</span>;
      case 'sold':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 border border-green-300 rounded whitespace-nowrap">已完成</span>;
      case 'returned':
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded whitespace-nowrap">已退货</span>;
      default:
        return <span className="inline-block px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-300 rounded whitespace-nowrap">-</span>;
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

  return (
    <>
    <tr
      onClick={handleRowClick}
      className={`border-b border-gray-100 dark:border-gray-700/50 text-sm transition-colors ${
        isGroupChild ? 'border-l-4 border-l-teal-400 dark:border-l-teal-600 bg-gray-50/50 dark:bg-gray-800/30' : ''
      } ${
        compareMode
          ? isSelected
            ? 'bg-teal-50 dark:bg-teal-900/20 cursor-pointer'
            : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      {/* 1. 进货日期 */}
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {compareMode && (
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
              isSelected ? 'bg-teal-500 border-teal-500' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}>
              {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          )}
          <span>{displayDate}</span>
        </div>
      </td>

      {/* 2. 商品名 + JAN */}
      <td className="px-3 py-2">
        <Link
          href={`/transactions/${transaction.id}`}
          className="text-blue-600 dark:text-blue-400 hover:underline line-clamp-2 break-cjk leading-snug text-sm"
        >
          {transaction.product_name}
        </Link>
        {transaction.jan_code && (
          <button
            onClick={(e) => copyToClipboard(transaction.jan_code!, e)}
            className="block mt-0.5 font-mono text-xs text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
            title="点击复制JAN"
          >
            {transaction.jan_code}
          </button>
        )}
      </td>

      {/* 3. 进货单价 + 数量 + 返点 */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="text-gray-900 dark:text-white font-medium">
          {formatCurrency(transaction.unit_price || transaction.purchase_price_total)}
        </div>
        <div className="text-xs text-gray-400">
          {transaction.quantity > 1 && <span>×{transaction.quantity} </span>}
          {totalPoints > 0 && <span>返{formatCurrency(totalPoints)}</span>}
        </div>
      </td>

      {/* 4. 来源渠道 */}
      <td className="px-3 py-2 whitespace-nowrap">
        {platformName ? (
          <span className="text-blue-600 dark:text-blue-400">{platformName}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* 5. 订单号 */}
      <td className="px-3 py-2">
        {transaction.order_number ? (
          <button
            onClick={(e) => copyToClipboard(transaction.order_number!, e)}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm max-w-[100px] truncate block cursor-pointer"
            title={transaction.order_number}
          >
            {transaction.order_number}
          </button>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* 6. 账号 */}
      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap text-sm">
        {transaction.payment_method?.name || '-'}
      </td>

      {/* 7. 状态 */}
      <td className="px-3 py-2">
        {getStatusBadge()}
      </td>

      {/* 8. 着荷 */}
      <td className="px-2 py-2 text-center">
        {transaction.status === 'pending' && onMarkArrived && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkArrived(transaction.id);
            }}
            className="px-2 py-1 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors whitespace-nowrap"
          >
            着荷
          </button>
        )}
      </td>

      {/* 9. 確定利润 + 预估 */}
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <div>
          {(transaction as any).aggregated_profit != null ? (
            <span className={`font-medium ${(transaction as any).aggregated_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency((transaction as any).aggregated_profit)}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        {buybackInfo && buybackInfo.maxPrice > 0 && buybackInfo.expectedProfit !== 0 && (
          <div className={`text-xs ${buybackInfo.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ≈{formatCurrency(buybackInfo.expectedProfit)}
          </div>
        )}
      </td>

      {/* 10. 当前最高收购价 + 店名 */}
      <td className="px-3 py-2 whitespace-nowrap text-right">
        {buybackInfo?.loading ? (
          <div className="flex flex-col items-end gap-1">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        ) : buybackInfo && buybackInfo.maxPrice > 0 ? (
          <div>
            <div className="text-gray-900 dark:text-white font-medium">
              {formatCurrency(buybackInfo.maxPrice)}
              {buybackInfo.source === 'stale' && (
                <span className="ml-1 text-[10px] text-amber-400" title="キャッシュが古い可能性があります">旧</span>
              )}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              {buybackInfo.maxStore}
            </div>
          </div>
        ) : buybackInfo?.source === 'pending' ? (
          <span className="text-xs text-gray-400 animate-pulse">取得中...</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* 11. 操作按钮 2×3 矩阵 */}
      <td className="px-2 py-2">
        <div className="flex flex-col gap-0.5 min-w-[90px]">
          <div className="flex gap-1">
            <Link href={`/transactions/${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-center transition-colors whitespace-nowrap">详情</Link>
            <Link href={`/transactions/${transaction.id}/edit`} className="flex-1 px-1 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-center transition-colors whitespace-nowrap">编辑</Link>
            <Link href={`/transactions/${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-center transition-colors whitespace-nowrap">出售</Link>
          </div>
          <div className="flex gap-1">
            <Link href={`/transactions/add?copy=${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-center transition-colors whitespace-nowrap">复制</Link>
            <Link href={`/transactions/${transaction.id}`} className="flex-1 px-1 py-0.5 text-xs text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded text-center transition-colors whitespace-nowrap">退货</Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transaction.id);
              }}
              className="flex-1 px-1 py-0.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-center cursor-pointer transition-colors whitespace-nowrap"
            >
              删除
            </button>
          </div>
        </div>
      </td>
    </tr>
    {showToast && <Toast message="已复制到剪贴板" onClose={() => setShowToast(false)} />}
    </>
  );
});

export default TransactionRow;
