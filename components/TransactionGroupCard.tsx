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
  onSelectGroup?: (ids: string[]) => void;
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
  onSelectGroup,
}: TransactionGroupCardProps) {
  const hasBuyback = group.bestBuybackPrice > 0;
  const groupIds = group.transactions.map(t => t.id);
  const selectedCount = groupIds.filter(id => selectedIds.has(id)).length;
  const allSelected = selectedCount === groupIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="rounded-xl border border-teal-300 dark:border-teal-700 overflow-hidden">
      {/* 折叠行 */}
      <div className="flex items-center bg-teal-50 dark:bg-teal-900/20">
        {/* 多选模式：全选该组 checkbox */}
        {compareMode && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelectGroup?.(groupIds); }}
            className="pl-3 pr-1 py-3 flex-shrink-0 flex items-center"
            aria-label="全选该组"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              allSelected
                ? 'bg-teal-500 border-teal-500'
                : someSelected
                  ? 'bg-teal-100 dark:bg-teal-900/50 border-teal-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}>
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {someSelected && (
                <div className="w-2 h-0.5 bg-teal-500 rounded" />
              )}
            </div>
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors p-3"
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
              {group.totalPending > 0 && (
                <span>未着 <span className="font-medium text-orange-500">{group.totalPending}</span></span>
              )}
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
      </div>

      {/* 展開時：子カード一覧（max-height アニメーション） */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? `${group.transactions.length * 520}px` : '0px' }}
      >
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
      </div>
    </div>
  );
});

export default TransactionGroupCard;
