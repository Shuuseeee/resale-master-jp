'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { formatCurrency } from '@/lib/financial/calculator';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { Transaction } from '@/types/database.types';
import { card } from '@/lib/theme';

interface TransactionForCompare extends Pick<Transaction,
  'id' | 'product_name' | 'purchase_price_total' | 'quantity' |
  'quantity_sold' | 'quantity_returned' | 'quantity_in_stock' | 'jan_code' |
  'expected_platform_points' | 'expected_card_points' | 'extra_platform_points'
> {}

interface StoreItem {
  transactionId: string;
  productName: string;
  qty: number;
  unitCost: number;
  storePrice: number;    // per unit; 0 = no data
  totalRevenue: number;  // storePrice * qty
  profit: number;        // (storePrice - unitCost) * qty
  hasData: boolean;
  bestPrice: number;
  bestStore: string;
  bestRevenue: number;
  bestProfit: number;
  extraIfBest: number;
}

interface StoreRow {
  storeName: string;
  rank: number;
  items: StoreItem[];
  totalRevenue: number;
  totalProfit: number;
  bestPossibleRevenue: number;
  bestPossibleProfit: number;
  extraIfBest: number;
  missingCount: number;  // products with no price at this store
  missingQty: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: TransactionForCompare[];
  buybackMap: Map<string, BuybackInfo>;
}

type QuantityMap = Record<string, number>;

function getAvailableQty(t: TransactionForCompare): number {
  return t.quantity_in_stock ?? Math.max(0, t.quantity - (t.quantity_sold || 0) - (t.quantity_returned || 0));
}

function getUnitCost(t: TransactionForCompare): number {
  const totalPoints = (t.expected_platform_points || 0) +
    (t.expected_card_points || 0) +
    (t.extra_platform_points || 0);
  return (t.purchase_price_total - totalPoints) / (t.quantity || 1);
}

function buildInitialQuantities(transactions: TransactionForCompare[]): QuantityMap {
  return Object.fromEntries(transactions.map(t => [t.id, getAvailableQty(t)]));
}

function buildStoreRows(
  transactions: TransactionForCompare[],
  buybackMap: Map<string, BuybackInfo>,
  quantities: QuantityMap
): { rows: StoreRow[]; bestPossibleRevenue: number; bestPossibleProfit: number } {
  // Collect all store names across selected transactions
  const storeSet = new Set<string>();
  transactions.forEach(t => {
    buybackMap.get(t.id)?.allPrices?.forEach(p => storeSet.add(p.store));
  });

  const stores = Array.from(storeSet);
  if (stores.length === 0) return { rows: [], bestPossibleRevenue: 0, bestPossibleProfit: 0 };

  const rows: StoreRow[] = stores.map(storeName => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let bestPossibleRevenue = 0;
    let bestPossibleProfit = 0;
    let missingCount = 0;
    let missingQty = 0;

    const items: StoreItem[] = transactions.map(t => {
      const info = buybackMap.get(t.id);
      const maxQty = getAvailableQty(t);
      const qty = Math.max(0, Math.min(maxQty, quantities[t.id] ?? maxQty));
      const unitCost = getUnitCost(t);
      const priceEntry = info?.allPrices?.find(p => p.store === storeName);
      const hasData = !!priceEntry;
      const storePrice = priceEntry?.price ?? 0;
      const revenue = storePrice * qty;
      const profit = (storePrice - unitCost) * qty;
      const bestEntry = info?.allPrices?.length
        ? info.allPrices.reduce((best, current) => current.price > best.price ? current : best)
        : null;
      const bestPrice = bestEntry?.price ?? 0;
      const bestStore = bestEntry?.store ?? '';
      const bestRevenue = bestPrice * qty;
      const bestProfit = bestPrice > 0 ? (bestPrice - unitCost) * qty : 0;
      const extraIfBest = Math.max(0, bestRevenue - revenue);

      if (hasData) {
        totalRevenue += revenue;
        totalProfit += profit;
      } else if (qty > 0) {
        missingCount++;
        missingQty += qty;
      }
      bestPossibleRevenue += bestRevenue;
      bestPossibleProfit += bestProfit;

      return {
        transactionId: t.id,
        productName: t.product_name,
        qty,
        unitCost,
        storePrice,
        totalRevenue: revenue,
        profit,
        hasData,
        bestPrice,
        bestStore,
        bestRevenue,
        bestProfit,
        extraIfBest,
      };
    });

    return {
      storeName,
      rank: 0,
      items,
      totalRevenue,
      totalProfit,
      bestPossibleRevenue,
      bestPossibleProfit,
      extraIfBest: Math.max(0, bestPossibleRevenue - totalRevenue),
      missingCount,
      missingQty,
    };
  });

  // Rank by totalRevenue descending
  rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
  rows.forEach((r, i) => { r.rank = i + 1; });

  const bestPossibleRevenue = rows[0]?.bestPossibleRevenue ?? 0;
  const bestPossibleProfit = rows[0]?.bestPossibleProfit ?? 0;

  return { rows, bestPossibleRevenue, bestPossibleProfit };
}

export default function BuybackComparisonModal({ isOpen, onClose, selectedTransactions, buybackMap }: Props) {
  const [quantities, setQuantities] = useState<QuantityMap>(() => buildInitialQuantities(selectedTransactions));

  useEffect(() => {
    if (isOpen) setQuantities(buildInitialQuantities(selectedTransactions));
  }, [isOpen, selectedTransactions]);

  const { rows, bestPossibleRevenue, bestPossibleProfit } = useMemo(
    () => buildStoreRows(selectedTransactions, buybackMap, quantities),
    [selectedTransactions, buybackMap, quantities]
  );
  const bestRevenue = rows[0]?.totalRevenue ?? 0;
  const totalSelectedQty = selectedTransactions.reduce((sum, t) => sum + (quantities[t.id] ?? getAvailableQty(t)), 0);

  const updateQty = (transactionId: string, value: number) => {
    const tx = selectedTransactions.find(t => t.id === transactionId);
    if (!tx) return;
    const maxQty = getAvailableQty(tx);
    const qty = Math.max(0, Math.min(maxQty, Number.isFinite(value) ? value : 0));
    setQuantities(prev => ({ ...prev, [transactionId]: qty }));
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="买取价格比较" size="xl">
      <div className="space-y-4">
        {/* Header summary */}
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
                        <div className="truncate text-sm font-medium text-[var(--color-text)]" title={t.product_name}>
                          {t.product_name}
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
                          max={maxQty}
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

            {/* Mobile: card layout */}
            <div className="md:hidden space-y-3">
              {rows.map(row => (
                <StoreCard key={row.storeName} row={row} bestRevenue={bestRevenue} />
              ))}
            </div>

            {/* Desktop: table layout */}
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
                    <tr
                      key={row.storeName}
                      className={row.rank === 1 ? 'bg-[var(--color-primary-light)]' : ''}
                    >
                      {/* Store name */}
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

                      {/* Per-product columns */}
                      {row.items.map(item => (
                        <td key={item.transactionId} className="py-3 px-3 text-right">
                          {item.hasData ? (
                            <div>
                              <div className="font-mono text-[var(--color-text)]">
                                {formatCurrency(item.storePrice)}
                              </div>
                              <div className={`text-[11px] font-mono ${item.profit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                                {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--color-warning)]">无报价</span>
                          )}
                        </td>
                      ))}

                      {/* Total revenue */}
                      <td className="border-l border-[var(--color-border)] py-3 pl-3 text-right">
                        <span className="font-mono font-bold text-[var(--color-text)]">
                          {formatCurrency(row.totalRevenue)}
                        </span>
                      </td>

                      {/* Total profit */}
                      <td className="py-3 pl-3 text-right">
                        <span className={`font-mono font-bold ${row.totalProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {row.extraIfBest > 0 ? (
                          <div>
                            <div className="font-mono font-bold text-[var(--color-warning)]">
                              +{formatCurrency(row.extraIfBest)}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)]">
                              {formatCurrency(row.bestPossibleRevenue)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unit cost reference */}
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base leading-none">🥇</span>;
  if (rank === 2) return <span className="text-base leading-none">🥈</span>;
  if (rank === 3) return <span className="text-base leading-none">🥉</span>;
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-xs font-medium text-[var(--color-text-muted)]">{rank}</span>;
}

function StoreCard({ row, bestRevenue }: { row: StoreRow; bestRevenue: number }) {
  const isBest = row.rank === 1;
  return (
    <div className={`${card.primary} p-4 ${isBest
      ? 'border-[var(--color-primary)]/20 bg-[var(--color-primary-light)]'
      : ''
    }`}>
      {/* Store header */}
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

      {/* Per-product breakdown */}
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

      {/* Store total profit */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-sm text-[var(--color-text-muted)]">合计利润</span>
        <span className={`font-mono text-base font-bold ${row.totalProfit >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
        </span>
      </div>
    </div>
  );
}
