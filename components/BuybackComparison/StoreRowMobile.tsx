'use client';

import type { StoreRow } from '@/hooks/useBuybackComparison';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import RankBadge from './RankBadge';

export default function StoreRowMobile({ row, bestRevenue }: { row: StoreRow; bestRevenue: number }) {
  const isBest = row.rank === 1;
  return (
    <div className={`${card.primary} p-4 ${isBest
      ? 'border-[var(--color-primary)]/20 bg-[var(--color-primary-light)]'
      : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RankBadge rank={row.rank} />
          <span className="font-semibold text-[var(--color-text)]">{row.storeName}</span>
          {row.missingCount > 0 && (
            <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-1.5 py-0.5 text-xs text-[var(--color-warning)]">
              {row.missingQty}个无报价
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-[var(--color-text)]">
            {formatCurrency(row.totalRevenue)}
          </div>
          {bestRevenue > 0 && row.rank > 1 && (
            <div className="text-xs text-[var(--color-text-muted)]">
              差 {formatCurrency(bestRevenue - row.totalRevenue)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {row.items.map(item => (
          <div key={item.transactionId} className="flex items-start justify-between text-sm">
            <div className="flex-1 min-w-0 mr-3">
              <span className="block truncate text-[var(--color-text)]" title={item.productName}>
                {item.productName}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">×{item.qty} · 成本 {formatCurrency(item.unitCost)}/件</span>
            </div>
            {item.hasData ? (
              <div className="text-right shrink-0">
                <div className="font-mono text-[var(--color-text)]">
                  {formatCurrency(item.storePrice)}/件
                </div>
                <div className={`text-xs font-mono ${item.profit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                  {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                </div>
              </div>
            ) : (
              <span className="shrink-0 text-sm text-[var(--color-warning)]">无报价</span>
            )}
          </div>
        ))}
      </div>

      {row.extraIfBest > 0 && (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(245,158,11,0.1)] px-3 py-2 text-xs text-[var(--color-warning)]">
          单品最高分开卖可多得 +{formatCurrency(row.extraIfBest)}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-sm text-[var(--color-text-muted)]">合计利润</span>
        <span className={`font-mono text-base font-bold ${row.totalProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
        </span>
      </div>
    </div>
  );
}
