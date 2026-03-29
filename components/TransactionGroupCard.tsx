// components/TransactionGroupCard.tsx — 移动端 JAN 分组汇总卡片
'use client';

import { memo } from 'react';
import { formatCurrency } from '@/lib/financial/calculator';
import type { TransactionGroup } from '@/app/transactions/page';
import { ProductImage } from '@/components/OptimizedImage';
import TransactionCard from '@/components/TransactionCard';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { Transaction, PaymentMethod } from '@/types/database.types';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
}

interface TransactionGroupCardProps {
  group: TransactionGroup;
  isExpanded: boolean;
  onToggle: () => void;
  dateSortMode: 'purchase' | 'sale';
  onDelete: (id: string) => void;
  onMarkArrived?: (id: string) => void;
  buybackPrices: Map<string, BuybackInfo>;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  compareMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const TransactionGroupCard = memo(function TransactionGroupCard({
  group,
  isExpanded,
  onToggle,
  dateSortMode,
  onDelete,
  onMarkArrived,
  buybackPrices,
  purchasePlatforms = [],
  compareMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: TransactionGroupCardProps) {
  const hasBuyback = group.bestBuybackPrice > 0;

  return (
    <div className="rounded-xl border border-teal-300 dark:border-teal-700 overflow-hidden">
      {/* 折叠行 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors p-3"
      >
        <div className="flex items-center gap-3">
          {/* 商品图片 */}
          {group.imageUrl ? (
            <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <ProductImage src={group.imageUrl} alt={group.productName} size="sm" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}

          {/* 商品情报 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{group.productName}</p>
              <span className="flex-shrink-0 text-xs bg-teal-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                ×{group.transactions.length}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">{group.janCode}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>在庫 <span className="font-medium text-gray-900 dark:text-white">{group.totalInStock}</span></span>
              <span>売済 <span className="font-medium text-gray-700 dark:text-gray-300">{group.totalSold}</span></span>
              <span>仕入 <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(group.totalPurchasePrice)}</span></span>
            </div>
          </div>

          {/* 右側: 利益 + 展開矢印 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              {group.totalProfit != null && (
                <p className={`text-sm font-medium font-mono ${group.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {group.totalProfit >= 0 ? '+' : ''}{formatCurrency(group.totalProfit)}
                </p>
              )}
              {hasBuyback && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  買取 {formatCurrency(group.bestBuybackPrice)}
                </p>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* 展開時：子カード一覧 */}
      {isExpanded && (
        <div className="border-t border-teal-200 dark:border-teal-800 divide-y divide-gray-100 dark:divide-gray-800">
          {group.transactions.map(tx => (
            <div key={tx.id} className="pl-3 border-l-4 border-teal-400 dark:border-teal-600 bg-white dark:bg-gray-900">
              <TransactionCard
                transaction={tx as TransactionWithPayment}
                dateSortMode={dateSortMode}
                onDelete={onDelete}
                onMarkArrived={onMarkArrived}
                buybackInfo={buybackPrices.get(tx.id)}
                purchasePlatforms={purchasePlatforms}
                compareMode={compareMode}
                isSelected={selectedIds.has(tx.id)}
                onToggleSelect={onToggleSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default TransactionGroupCard;
