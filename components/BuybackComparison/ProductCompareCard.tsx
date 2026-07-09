'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { ProductSummary } from '@/hooks/useBuybackComparison';
import QuantityStepper from './QuantityStepper';

interface ProductCompareCardProps {
  product: ProductSummary;
  onQtyChange: (value: number) => void;
}

// 比较数量区的商品卡片：标题（名+JAN）→ 成本/步进器 → 最高买取价/预计利润
export default function ProductCompareCard({ product, onQtyChange }: ProductCompareCardProps) {
  const { productName, janCode, maxQty, qty, unitCost, bestPrice, bestStore, bestProfit, hasData } = product;

  return (
    <div className={`${card.primary} p-3`}>
      {/* 标题栏：商品名 + 比价中心链接 + 元数据 */}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 truncate text-sm font-medium text-[var(--color-text)]" title={productName}>
          {productName}
        </div>
        {janCode && (
          <Link
            href={`/kaitorix-prices?jan=${encodeURIComponent(janCode)}`}
            className="-m-2 flex-shrink-0 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            title="在比价中心查看"
            aria-label="在比价中心查看"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {janCode ? `JAN ${janCode} · ` : ''}库存 {maxQty}
      </div>

      {/* 主体第 1 行：成本 | 数量步进器 */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--color-text-muted)]">成本/件</div>
          <div className="font-mono text-sm text-[var(--color-text)]">{formatCurrency(unitCost)}</div>
        </div>
        <QuantityStepper value={qty} onChange={onQtyChange} label={productName} />
      </div>

      {/* 主体第 2 行：最高买取价 | 预计利润 */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2.5">
        {hasData ? (
          <>
            <div className="min-w-0">
              <div className="truncate text-xs text-[var(--color-text-muted)]" title={bestStore}>
                最高买取 · {bestStore}
              </div>
              <div className="mt-0.5 font-mono text-sm font-medium text-[var(--color-text)]">
                {formatCurrency(bestPrice)}/件
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--color-text-muted)]">预计利润</div>
              <div className={`mt-0.5 font-mono text-sm font-semibold ${bestProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                {bestProfit >= 0 ? '+' : ''}{formatCurrency(bestProfit)}
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-2 text-xs text-[var(--color-warning)]">暂无报价</div>
        )}
      </div>
    </div>
  );
}
