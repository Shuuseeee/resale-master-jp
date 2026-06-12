'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import Modal from '@/components/Modal';
import { formatCurrency, getAvailableQty, getUnitCost } from '@/lib/financial/calculator';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { TransactionForCompare } from '@/hooks/useBuybackComparison';
import { useBuybackComparison } from '@/hooks/useBuybackComparison';
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
    rows, bestPossibleRevenue, bestPossibleProfit,
    totalSelectedQty, quantities, updateQty
  } = useBuybackComparison({ selectedTransactions, buybackMap, isOpen });

  if (!isOpen) return null;

  const bestRevenue = rows[0]?.totalRevenue ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="买取价格比较" size="xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 text-sm text-[var(--color-text-muted)]">
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
                {selectedTransactions.map(t => {
                  const maxQty = getAvailableQty(t);
                  const qty = quantities[t.id] ?? maxQty;
                  return (
                    <div key={t.id} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate text-sm font-medium text-[var(--color-text)]" title={t.product_name}>
                            {t.product_name}
                          </div>
                          {t.jan_code && (
                            <Link
                              href={`/kaitorix-prices?jan=${encodeURIComponent(t.jan_code)}`}
                              className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                              title="在比价中心查看"
                              aria-label="在比价中心查看"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          库存 {maxQty} · 成本 {formatCurrency(getUnitCost(t))}/件
                        </div>
                      </div>
                      <div className="flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                        <button
                          type="button"
                          onClick={() => updateQty(t.id, qty - 1)}
                          className="h-8 w-8 text-sm font-bold text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]"
                          aria-label="减少数量"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) => updateQty(t.id, parseInt(e.target.value, 10))}
                          className="h-8 w-12 border-x border-[var(--color-border)] bg-transparent text-center text-sm font-semibold text-[var(--color-text)] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(t.id, qty + 1)}
                          className="h-8 w-8 text-sm font-bold text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]"
                          aria-label="增加数量"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
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

            <div className="border-t border-[var(--color-border)] pt-3">
              <div className="mb-2 text-xs text-[var(--color-text-muted)]">单件成本参考</div>
              <div className="flex flex-wrap gap-3">
                {selectedTransactions.map(t => {
                  const unitCost = getUnitCost(t);
                  const qty = quantities[t.id] ?? getAvailableQty(t);
                  return (
                    <div key={t.id} className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs">
                      <span className="inline-block max-w-[80px] truncate align-bottom text-[var(--color-text-muted)]">
                        {t.product_name.length > 10 ? t.product_name.slice(0, 10) + '…' : t.product_name}
                      </span>
                      <span className="ml-2 font-mono font-medium text-[var(--color-text)]">{formatCurrency(unitCost)}</span>
                      <span className="ml-1 text-[var(--color-text-muted)]">×{qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
