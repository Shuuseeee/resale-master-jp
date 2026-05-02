// components/TransactionGroupCard.tsx — 移动端 JAN 分组汇总卡片
'use client';

import { memo, useRef } from 'react';
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
  onLongPress?: (id: string) => void;
}

const TransactionGroupCard = memo(function TransactionGroupCard({
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
  onLongPress,
}: TransactionGroupCardProps) {
  const hasBuyback = group.bestBuybackPrice > 0;
  const groupIds = group.transactions.map(t => t.id);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCount = groupIds.filter(id => selectedIds.has(id)).length;
  const allSelected = selectedCount === groupIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
      {/* 折叠行 */}
      <div className="flex items-center bg-[var(--color-bg-subtle)]">
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
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                : someSelected
                  ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)]'
            }`}>
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {someSelected && (
                <div className="w-2 h-0.5 bg-[var(--color-primary)] rounded" />
              )}
            </div>
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          onTouchStart={() => {
            if (compareMode || !onLongPress) return;
            longPressTimer.current = setTimeout(() => {
              // 展开分组并全选该组
              if (!isExpanded) onToggle();
              onSelectGroup?.(groupIds);
              onLongPress(groupIds[0]);
            }, 500);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
          onTouchMove={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
          className="flex-1 min-w-0 text-left active:bg-[var(--color-bg-elevated)] transition-colors p-3"
        >
        <div className="flex items-center gap-3">
          {/* 商品图片 */}
          {group.imageUrl ? (
            <div className="w-12 h-12 flex-shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <ProductImage src={group.imageUrl} alt={group.productName} size="sm" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 flex-shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}

          {/* 商品情报 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate min-w-0">{group.productName}</p>
              <span className="flex-shrink-0 text-xs bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded-full font-semibold">
                ×{group.transactions.length}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-mono">{group.janCode}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
              <span>库存 <span className="font-semibold text-[var(--color-text)]">{group.totalInStock}</span></span>
              {group.totalPending > 0 && (
                <span>未到货 <span className="font-semibold text-[var(--color-warning)]">{group.totalPending}</span></span>
              )}
              <span>已售 <span className="font-semibold text-[var(--color-text)]">{group.totalSold}</span></span>
              <span>进货 <span className="font-semibold text-[var(--color-text)]">{formatCurrency(group.totalPurchasePrice)}</span></span>
            </div>
          </div>

          {/* 右側: 利益 + 展開矢印 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              {group.totalProfit != null && (
                <p className={`text-sm font-semibold font-mono ${group.totalProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {group.totalProfit >= 0 ? '+' : ''}{formatCurrency(group.totalProfit)}
                </p>
              )}
              {hasBuyback && (
                <p className="text-xs text-[var(--color-primary)]">
                  买取 {formatCurrency(group.bestBuybackPrice)}
                </p>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {group.transactions.map(tx => (
            <div key={tx.id} className="pl-3 border-l-4 border-[var(--color-primary)]/30 bg-[var(--color-bg)]">
              <TransactionCard
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
                onLongPress={onLongPress}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default TransactionGroupCard;
