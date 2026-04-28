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
  onQuickSale?: (id: string) => void;
  onQuickReturn?: (id: string) => void;
  onQuickEdit?: (id: string) => void;
  onQuickCopy?: (id: string) => void;
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
  onQuickSale,
  onQuickReturn,
  onQuickEdit,
  onQuickCopy,
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
        className="bg-apple-blue/5 dark:bg-apple-blue/10 hover:bg-apple-blue/10 dark:hover:bg-apple-blue/15 cursor-pointer transition-colors border-b border-apple-blue/20 dark:border-apple-blue/20"
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
                    ? 'bg-apple-blue border-apple-blue'
                    : someSelected
                      ? 'bg-apple-blue/10 border-apple-blue/20'
                      : 'bg-white dark:bg-gray-800 border-apple-separator dark:border-apple-sepDark'
                }`}>
                  {allSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {someSelected && (
                    <div className="w-1.5 h-0.5 bg-apple-blue rounded" />
                  )}
                </div>
              </button>
            ) : (
              <svg
                className={`w-3.5 h-3.5 text-apple-blue transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            <span className="text-xs text-apple-gray-1">{group.latestDate}</span>
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
                <span className="flex-shrink-0 text-xs bg-apple-blue text-white px-1.5 py-0.5 rounded-full font-medium">
                  ×{group.transactions.length}
                </span>
              </div>
              <div className="text-xs text-apple-gray-2 font-mono">{group.janCode}</div>
            </div>
          </div>
        </td>

        {/* 仕入合計 */}
        <td className="px-3 py-2 text-right">
          <div className="text-sm font-mono text-gray-900 dark:text-white">{formatCurrency(group.totalPurchasePrice)}</div>
          <div className="text-xs text-apple-gray-2">合计 ×{group.totalQuantity}</div>
        </td>

        {/* 来源渠道 — 空 */}
        <td className="px-3 py-2" />

        {/* 注文番号 — 空 */}
        <td className="px-3 py-2" />

        {/* 账号 — 空 */}
        <td className="px-3 py-2" />

        {/* 状態: 在庫/已售 */}
        <td className="px-3 py-2">
          <div className="text-xs text-apple-gray-1 space-y-0.5">
            <div>库存 <span className="font-medium text-gray-900 dark:text-white">{group.totalInStock}</span></div>
            <div>已售 <span className="font-medium text-gray-900 dark:text-white">{group.totalSold}</span></div>
          </div>
        </td>

        {/* 到着ボタン — 空 */}
        <td className="px-2 py-2" />

        {/* 利益合計 */}
        <td className="px-3 py-2 text-right">
          {group.totalProfit != null ? (
            <span className={`text-sm font-mono font-medium ${group.totalProfit >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>
              {group.totalProfit >= 0 ? '+' : ''}{formatCurrency(group.totalProfit)}
            </span>
          ) : (
            <span className="text-apple-gray-2">—</span>
          )}
        </td>

        {/* 买取価格 */}
        <td className="px-3 py-2 text-right">
          {hasBuyback ? (
            <div>
              <div className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {formatCurrency(group.bestBuybackPrice)}
              </div>
              <div className="text-xs text-apple-blue">{group.bestBuybackStore}</div>
            </div>
          ) : (
            <span className="text-apple-gray-2">—</span>
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
          onQuickSale={onQuickSale}
          onQuickReturn={onQuickReturn}
          onQuickEdit={onQuickEdit}
          onQuickCopy={onQuickCopy}
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