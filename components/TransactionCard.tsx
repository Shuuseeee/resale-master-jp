// components/TransactionCard.tsx - 移动端卡片
'use client';

import { useState, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptic';
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
  allPrices?: Array<{ store: string; price: number; url: string }>;
  source?: 'cache' | 'stale' | 'pending';
  fetchedAt?: number;
}

interface TransactionCardProps {
  transaction: TransactionWithPayment;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  buybackInfo?: BuybackInfo;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

const TransactionCard = memo(function TransactionCard({
  transaction,
  dateSortMode,
  onDelete,
  onMarkArrived,
  buybackInfo,
  purchasePlatforms = [],
  compareMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
}: TransactionCardProps) {
  const router = useRouter();
  const remainingQty = transaction.quantity - (transaction.quantity_sold || 0);

  // 长按检测
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (compareMode || !onLongPress) return;
    didLongPress.current = false;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      triggerHaptic('medium');
      onLongPress(transaction.id);
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartPos.current) return;
    const dx = Math.abs(e.clientX - pointerStartPos.current.x);
    const dy = Math.abs(e.clientY - pointerStartPos.current.y);
    // 手指移动超过 8px 视为滚动，取消长按
    if (dx > 8 || dy > 8) cancelLongPress();
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pointerStartPos.current = null;
  };
  const hasSoldOut = remainingQty <= 0;
  const [showToast, setShowToast] = useState(false);
  const platformName = purchasePlatforms.find(p => p.id === transaction.purchase_platform_id)?.name || null;

  const totalPoints = (transaction.expected_platform_points || 0)
    + (transaction.expected_card_points || 0)
    + (transaction.extra_platform_points || 0);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      triggerHaptic('light');
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (compareMode) {
      e.stopPropagation();
      onToggleSelect?.(transaction.id);
      return;
    }
    if (didLongPress.current) { didLongPress.current = false; return; }
    const target = e.target as HTMLElement;
    if (!target.closest('a, button')) router.push(`/transactions/${transaction.id}`);
  };

  return (
    <>
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border transition-colors relative select-none
        ${compareMode
          ? isSelected
            ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/20 cursor-pointer'
            : 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-teal-300 dark:hover:border-teal-600'
          : 'border-gray-200 dark:border-gray-700 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700'
        }`}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
    >
      {/* 选择模式复选框 */}
      {compareMode && (
        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10
          ${isSelected
            ? 'bg-teal-500 border-teal-500'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
          }`}
        >
          {isSelected && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
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
                  triggerHaptic('medium');
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
        {!hasSoldOut && buybackInfo && buybackInfo.source === 'pending' && buybackInfo.maxPrice === 0 && (
          <div>
            <span className="text-gray-400 text-xs">買取価格</span>
            <p className="text-xs text-gray-400 animate-pulse">取得中...</p>
          </div>
        )}
        {!hasSoldOut && buybackInfo && buybackInfo.maxPrice > 0 && (
          <>
            <div>
              <span className="text-gray-400 text-xs">買取価格</span>
              <p className="text-xs font-medium font-mono text-gray-900 dark:text-white">
                {formatCurrency(buybackInfo.maxPrice)}
                {buybackInfo.source === 'stale' && buybackInfo.fetchedAt && (() => {
                  const mins = Math.floor((Date.now() - buybackInfo.fetchedAt) / 60000);
                  const label = mins < 1 ? 'たった今' : mins < 60 ? `${mins}分前` : `${Math.floor(mins / 60)}時間前`;
                  return <span className="ml-1 text-[10px] text-amber-400">{label}</span>;
                })()}
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
          <Link href={`/transactions/${transaction.id}/edit`} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">编辑</Link>
          <Link href={`/transactions/${transaction.id}?action=sale`} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">出售</Link>
          {(transaction.status === 'in_stock' || transaction.status === 'pending') && (
            <Link href={`/transactions/${transaction.id}?action=return`} className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors">退货</Link>
          )}
          <Link href={`/transactions/add?copy=${transaction.id}`} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">复制</Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('medium');
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
});

export default TransactionCard;
