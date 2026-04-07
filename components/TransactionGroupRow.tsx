// components/TransactionGroupRow.tsx — 桌面端 JAN 分组汇总行
'use client';

import { memo } from 'react';
import { formatCurrency } from '@/lib/financial/calculator';
import type { TransactionGroup } from '@/app/transactions/page';
import TransactionRow from '@/components/TransactionRow';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { Transaction, PaymentMethod } from '@/types/database.types';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
}

interface TransactionGroupRowProps {
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

const TransactionGroupRow = memo(function TransactionGroupRow({
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
}: TransactionGroupRowProps) {
  const hasBuyback = group.bestBuybackPrice > 0;
  const groupIds = group.transactions.map(t => t.id);
  const selectedCount = groupIds.filter(id => selectedIds.has(id)).length;
  const allSelected = selectedCount === groupIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <>
      {/* 汇总行 */}
      <tr
        onClick={onToggle}
        className="bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 cursor-pointer transition-colors border-b border-teal-200 dark:border-teal-800"
      >
        {/* 日期列 */}
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {compareMode ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectGroup?.(groupIds); }}
                aria-label="全选该组"
                className="flex-shrink-0"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-teal-500 border-teal-500'
                    : someSelected
                      ? 'bg-teal-100 dark:bg-teal-900/50 border-teal-400'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}>
                  {allSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {someSelected && (
                    <div className="w-1.5 h-0.5 bg-teal-500 rounded" />
                  )}
                </div>
              </button>
            ) : (
              <svg
                className={`w-3.5 h-3.5 text-teal-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">{group.latestDate}</span>
          </div>
        </td>

        {/* 商品名 + JAN */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                  {group.productName}
                </span>
                <span className="flex-shrink-0 text-xs bg-teal-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                  ×{group.transactions.length}
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono">{group.janCode}</div>
            </div>
          </div>
        </td>

        {/* 仕入合計 */}
        <td className="px-3 py-2 text-right">
          <div className="text-sm font-mono text-gray-900 dark:text-white">{formatCurrency(group.totalPurchasePrice)}</div>
          <div className="text-xs text-gray-400">合計 ×{group.totalQuantity}</div>
        </td>

        {/* 来源渠道 — 空 */}
        <td className="px-3 py-2" />

        {/* 注文番号 — 空 */}
        <td className="px-3 py-2" />

        {/* 账号 — 空 */}
        <td className="px-3 py-2" />

        {/* 状態: 在庫/売済 */}
        <td className="px-3 py-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>在庫 <span className="font-medium text-gray-900 dark:text-white">{group.totalInStock}</span></div>
            <div>売済 <span className="font-medium text-gray-700 dark:text-gray-300">{group.totalSold}</span></div>
          </div>
        </td>

        {/* 到着ボタン — 空 */}
        <td className="px-2 py-2" />

        {/* 利益合計 */}
        <td className="px-3 py-2 text-right">
          {group.totalProfit != null ? (
            <span className={`text-sm font-mono font-medium ${group.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {group.totalProfit >= 0 ? '+' : ''}{formatCurrency(group.totalProfit)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        {/* 买取価格 */}
        <td className="px-3 py-2 text-right">
          {hasBuyback ? (
            <div>
              <div className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {formatCurrency(group.bestBuybackPrice)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{group.bestBuybackStore}</div>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        {/* 操作 — 空 */}
        <td className="px-2 py-2" />
      </tr>

      {/* 展開時：子行（TransactionRow は自身で <tr> を返す） */}
      {isExpanded && group.transactions.map(tx => (
        <TransactionRow
          key={tx.id}
          transaction={tx as TransactionWithPayment}
          dateSortMode={dateSortMode}
          onDelete={onDelete}
          onMarkArrived={onMarkArrived}
          buybackInfo={buybackPrices.get(tx.id)}
          purchasePlatforms={purchasePlatforms}
          compareMode={compareMode}
          isSelected={selectedIds.has(tx.id)}
          onToggleSelect={onToggleSelect}
          isGroupChild
        />
      ))}
    </>
  );
});

export default TransactionGroupRow;