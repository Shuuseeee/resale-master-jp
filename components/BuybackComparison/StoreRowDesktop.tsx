'use client';

import type { StoreRow } from '@/hooks/useBuybackComparison';
import { formatCurrency } from '@/lib/financial/calculator';
import RankBadge from './RankBadge';

export default function StoreRowDesktop({ row }: { row: StoreRow }) {
  return (
    <tr
      className={row.rank === 1 ? 'bg-[var(--color-primary-light)]' : ''}
    >
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <RankBadge rank={row.rank} />
          <span className="whitespace-nowrap font-medium text-[var(--color-text)]">
            {row.storeName}
          </span>
          {row.missingCount > 0 && (
            <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-1.5 py-0.5 text-[10px] text-[var(--color-warning)]" title={`${row.missingCount}种 / ${row.missingQty}个商品无价格数据`}>
              {row.missingQty}个无报价
            </span>
          )}
        </div>
      </td>

      {row.items.map(item => (
        <td key={item.transactionId} className="py-3 px-3 text-right">
          {item.hasData ? (
            <>
              <div className="font-mono text-[var(--color-text)]">
                {formatCurrency(item.storePrice)}
              </div>
              <div className={`text-[11px] font-mono ${item.profit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
              </div>
            </>
          ) : (
            <span className="text-xs text-[var(--color-warning)]">无报价</span>
          )}
        </td>
      ))}

      <td className="border-l border-[var(--color-border)] py-3 pl-3 text-right">
        <span className="font-mono font-bold text-[var(--color-text)]">
          {formatCurrency(row.totalRevenue)}
        </span>
      </td>

      <td className="py-3 pl-3 text-right">
        <span className={`font-mono font-bold ${row.totalProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
        </span>
      </td>
      <td className="py-3 pl-3 text-right">
        {row.extraIfBest > 0 ? (
          <>
            <div className="font-mono font-bold text-[var(--color-warning)]">
              +{formatCurrency(row.extraIfBest)}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {formatCurrency(row.bestPossibleRevenue)}
            </div>
          </>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        )}
      </td>
    </tr>
  );
}
