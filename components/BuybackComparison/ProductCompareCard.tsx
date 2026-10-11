'use client';

import { ArrowSync16Regular } from '@fluentui/react-icons/headless/svg/arrow-sync';
import Spinner from '@/components/fluent/Spinner';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { ProductSummary } from '@/hooks/useBuybackComparison';
import QuantityStepper from './QuantityStepper';

interface ProductCompareCardProps {
  product: ProductSummary;
  onQtyChange: (value: number) => void;
  /** 官方强刷这个商品的买取价（有 JAN 且调用方支持时才传） */
  onForceRefresh?: () => void;
  refreshing?: boolean;
  refreshDisabled?: boolean;
}

// 比较数量区的商品卡片：标题（名+JAN）→ 成本/步进器 → 最高买取价/预计利润
export default function ProductCompareCard({ product, onQtyChange, onForceRefresh, refreshing = false, refreshDisabled = false }: ProductCompareCardProps) {
  const { productName, janCode, maxQty, qty, unitCost, bestPrice, bestStore, bestProfit, hasData } = product;

  return (
    <div className={`${card.primary} p-3`}>
      {/* 标题栏：商品名 + 官方强刷 + 元数据 */}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]" title={productName}>
          {productName}
        </div>
        {onForceRefresh && (
          <button
            type="button"
            onClick={onForceRefresh}
            disabled={refreshDisabled}
            className="fluent-btn fluent-btn--subtle fluent-btn--sm shrink-0 gap-1"
            title="消耗 1 次官方 API 额度，取最新买取价"
          >
            {refreshing ? <Spinner /> : <ArrowSync16Regular />}
            {refreshing ? '强刷中' : '官方强刷'}
          </button>
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
              <div className={`mt-0.5 font-mono text-sm font-semibold ${bestProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
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
