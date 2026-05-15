'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { Transaction } from '@/types/database.types';
import { getAvailableQty, getUnitCost } from '@/lib/financial/calculator';

export interface TransactionForCompare extends Pick<Transaction,
  'id' | 'product_name' | 'purchase_price_total' | 'quantity' |
  'quantity_sold' | 'quantity_returned' | 'quantity_in_stock' | 'jan_code' |
  'expected_platform_points' | 'expected_card_points' | 'extra_platform_points'
> {}

export interface StoreItem {
  transactionId: string;
  productName: string;
  qty: number;
  unitCost: number;
  storePrice: number;
  totalRevenue: number;
  profit: number;
  hasData: boolean;
  bestPrice: number;
  bestStore: string;
  bestRevenue: number;
  bestProfit: number;
  extraIfBest: number;
}

export interface StoreRow {
  storeName: string;
  rank: number;
  items: StoreItem[];
  totalRevenue: number;
  totalProfit: number;
  bestPossibleRevenue: number;
  bestPossibleProfit: number;
  extraIfBest: number;
  missingCount: number;
  missingQty: number;
}

export type QuantityMap = Record<string, number>;

function buildInitialQuantities(transactions: TransactionForCompare[]): QuantityMap {
  return Object.fromEntries(transactions.map(t => [t.id, getAvailableQty(t)]));
}

export function buildStoreRows(
  transactions: TransactionForCompare[],
  buybackMap: Map<string, BuybackInfo>,
  quantities: QuantityMap
): { rows: StoreRow[]; bestPossibleRevenue: number; bestPossibleProfit: number; totalSelectedQty: number } {
  const storeSet = new Set<string>();
  transactions.forEach(t => {
    buybackMap.get(t.id)?.allPrices?.forEach(p => storeSet.add(p.store));
  });

  const stores = Array.from(storeSet);
  if (stores.length === 0) return { rows: [], bestPossibleRevenue: 0, bestPossibleProfit: 0, totalSelectedQty: 0 };

  // Pre-compute per-transaction values once (not S×T times)
  const maxQtys = new Map(transactions.map(t => [t.id, getAvailableQty(t)]));
  const unitCosts = new Map(transactions.map(t => [t.id, getUnitCost(t)]));
  const bestEntries = new Map(transactions.map(t => {
    const prices = buybackMap.get(t.id)?.allPrices;
    if (!prices?.length) return [t.id, null] as const;
    return [t.id, prices.reduce((best, cur) => cur.price > best.price ? cur : best)] as const;
  }));

  let totalSelectedQty = 0;

  const rows: StoreRow[] = stores.map(storeName => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let bestPossibleRevenue = 0;
    let bestPossibleProfit = 0;
    let missingCount = 0;
    let missingQty = 0;

    const items: StoreItem[] = transactions.map(t => {
      const info = buybackMap.get(t.id);
      const maxQty = maxQtys.get(t.id)!;
      const qty = Math.max(0, Math.min(maxQty, quantities[t.id] ?? maxQty));
      const unitCost = unitCosts.get(t.id)!;
      const priceEntry = info?.allPrices?.find(p => p.store === storeName);
      const hasData = !!priceEntry;
      const storePrice = priceEntry?.price ?? 0;
      const revenue = storePrice * qty;
      const profit = (storePrice - unitCost) * qty;
      const bestEntry = bestEntries.get(t.id);
      const bestPrice = bestEntry?.price ?? 0;
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
        bestStore: bestEntry?.store ?? '',
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

  rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
  rows.forEach((r, i) => { r.rank = i + 1; });

  totalSelectedQty = transactions.reduce(
    (sum, t) => sum + (quantities[t.id] ?? maxQtys.get(t.id)!), 0
  );

  const bestPossibleRevenue = rows[0]?.bestPossibleRevenue ?? 0;
  const bestPossibleProfit = rows[0]?.bestPossibleProfit ?? 0;

  return { rows, bestPossibleRevenue, bestPossibleProfit, totalSelectedQty };
}

export function useBuybackComparison({
  selectedTransactions,
  buybackMap,
  isOpen,
}: {
  selectedTransactions: TransactionForCompare[];
  buybackMap: Map<string, BuybackInfo>;
  isOpen: boolean;
}) {
  const [quantities, setQuantities] = useState<QuantityMap>({});

  const txMap = useMemo(
    () => new Map(selectedTransactions.map(t => [t.id, t])),
    [selectedTransactions]
  );

  useEffect(() => {
    if (isOpen) setQuantities(buildInitialQuantities(selectedTransactions));
  }, [isOpen, selectedTransactions]);

  const { rows, bestPossibleRevenue, bestPossibleProfit, totalSelectedQty } = useMemo(
    () => buildStoreRows(selectedTransactions, buybackMap, quantities),
    [selectedTransactions, buybackMap, quantities]
  );

  const updateQty = (transactionId: string, value: number) => {
    const tx = txMap.get(transactionId);
    if (!tx) return;
    const maxQty = getAvailableQty(tx);
    const qty = Math.max(0, Math.min(maxQty, Number.isFinite(value) ? value : 0));
    setQuantities(prev => ({ ...prev, [transactionId]: qty }));
  };

  return {
    rows,
    bestPossibleRevenue,
    bestPossibleProfit,
    totalSelectedQty,
    quantities,
    updateQty,
  };
}
