'use client';

import Modal from '@/components/Modal';
import { formatCurrency, getAvailableQty } from '@/lib/financial/calculator';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { TransactionForCompare } from '@/hooks/useBuybackComparison';
import { useBuybackComparison } from '@/hooks/useBuybackComparison';
import ProductCompareCard from '@/components/BuybackComparison/ProductCompareCard';
import StoreRowDesktop from '@/components/BuybackComparison/StoreRowDesktop';
import StoreRowMobile from '@/components/BuybackComparison/StoreRowMobile';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: TransactionForCompare[];
  buybackMap: Map<string, BuybackInfo>;
}

export default function BuybackComparisonModal({ isOpen, onClose, selectedTransactions, buybackMap }: Props) {
  const {
    rows, products, bestPossibleRevenue, bestPossibleProfit,
    totalSelectedQty, quantities, updateQty
  } = useBuybackComparison({ selectedTransactions, buybackMap, isOpen });

  if (!isOpen) return null;

  const bestRevenue = rows[0]?.totalRevenue ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="买取价格比较" size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-border)] pb-2 text-sm text-[var(--color-text-muted)]">
          <span>已选 <span className="font-semibold text-[var(--color-text)]">{selectedTransactions.length}</span> 件商品</span>
          <span>·</span>
          <span>比较数量 <span className="font-semibold text-[var(--color-text)]">{totalSelectedQty}</span> 个</span>
          <span>·</span>
          <span><span className="font-semibold text-[var(--color-text)]">{rows.length}</span> 家店铺</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            未找到各店铺的买取价格数据
          </div>
        ) : (
          <>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-[var(--color-text)]">比较数量</div>
                <div className="text-xs text-[var(--color-text-muted)]">可临时调整，不会修改库存</div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {products.map(p => (
                  <ProductCompareCard
                    key={p.transactionId}
                    product={p}
                    onQtyChange={(v) => updateQty(p.transactionId, v)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">整批最高店</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                  {rows[0]?.storeName} · {formatCurrency(bestRevenue)}
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">单品最高分开卖</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                  {formatCurrency(bestPossibleRevenue)}
                  {bestPossibleRevenue > bestRevenue && (
                    <span className="ml-2 text-[var(--color-warning)]">+{formatCurrency(bestPossibleRevenue - bestRevenue)}</span>
                  )}
                </div>
                <div className={`mt-1 text-xs font-mono ${bestPossibleProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                  利润 {bestPossibleProfit >= 0 ? '+' : ''}{formatCurrency(bestPossibleProfit)}
                </div>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {rows.map(row => (
                <StoreRowMobile key={row.storeName} row={row} bestRevenue={bestRevenue} />
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-2 pr-4 text-left font-medium">店铺</th>
                    {selectedTransactions.map(t => (
                      <th key={t.id} className="py-2 px-3 text-right font-medium min-w-[100px]">
                        <div className="truncate max-w-[120px]" title={t.product_name}>
                          {t.product_name.length > 12 ? t.product_name.slice(0, 12) + '…' : t.product_name}
                        </div>
                        <div className="text-[10px] font-normal normal-case text-[var(--color-text-muted)]">
                          ×{quantities[t.id] ?? getAvailableQty(t)}
                        </div>
                      </th>
                    ))}
                    <th className="border-l border-[var(--color-border)] py-2 pl-3 text-right font-medium">合计买取</th>
                    <th className="py-2 pl-3 text-right font-medium">合计利润</th>
                    <th className="py-2 pl-3 text-right font-medium">分开卖差额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map(row => (
                    <StoreRowDesktop key={row.storeName} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

          </>
        )}
      </div>
    </Modal>
  );
}
