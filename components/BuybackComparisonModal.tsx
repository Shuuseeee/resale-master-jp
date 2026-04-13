'use client';

import Modal from '@/components/Modal';
import { formatCurrency } from '@/lib/financial/calculator';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { Transaction } from '@/types/database.types';

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
}

interface StoreRow {
  storeName: string;
  rank: number;
  items: StoreItem[];
  totalRevenue: number;
  totalProfit: number;
  missingCount: number;  // products with no price at this store
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: TransactionForCompare[];
  buybackMap: Map<string, BuybackInfo>;
}

function buildStoreRows(
  transactions: TransactionForCompare[],
  buybackMap: Map<string, BuybackInfo>
): StoreRow[] {
  // Collect all store names across selected transactions
  const storeSet = new Set<string>();
  transactions.forEach(t => {
    buybackMap.get(t.id)?.allPrices?.forEach(p => storeSet.add(p.store));
  });

  const stores = Array.from(storeSet);
  if (stores.length === 0) return [];

  const rows: StoreRow[] = stores.map(storeName => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let missingCount = 0;

    const items: StoreItem[] = transactions.map(t => {
      const info = buybackMap.get(t.id);
      const qty = t.quantity_in_stock ?? Math.max(0, t.quantity - (t.quantity_sold || 0) - (t.quantity_returned || 0));
      
      const totalPoints = (t.expected_platform_points || 0) + 
                          (t.expected_card_points || 0) + 
                          (t.extra_platform_points || 0);
      const unitCost = (t.purchase_price_total - totalPoints) / (t.quantity || 1);
      const priceEntry = info?.allPrices?.find(p => p.store === storeName);
      const hasData = !!priceEntry;
      const storePrice = priceEntry?.price ?? 0;
      const revenue = storePrice * qty;
      const profit = (storePrice - unitCost) * qty;

      if (hasData) {
        totalRevenue += revenue;
        totalProfit += profit;
      } else {
        missingCount++;
      }

      return {
        transactionId: t.id,
        productName: t.product_name,
        qty,
        unitCost,
        storePrice,
        totalRevenue: revenue,
        profit,
        hasData,
      };
    });

    return { storeName, rank: 0, items, totalRevenue, totalProfit, missingCount };
  });

  // Rank by totalRevenue descending
  rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
  rows.forEach((r, i) => { r.rank = i + 1; });

  return rows;
}

export default function BuybackComparisonModal({ isOpen, onClose, selectedTransactions, buybackMap }: Props) {
  const rows = buildStoreRows(selectedTransactions, buybackMap);
  const bestRevenue = rows[0]?.totalRevenue ?? 0;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="买取价格比较" size="xl">
      <div className="space-y-4">
        {/* Header summary */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
          <span>已选 <span className="font-semibold text-gray-900 dark:text-white">{selectedTransactions.length}</span> 件商品</span>
          <span>·</span>
          <span><span className="font-semibold text-gray-900 dark:text-white">{rows.length}</span> 家店铺</span>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            未找到各店铺的买取价格数据
          </div>
        ) : (
          <>
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
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="py-2 pr-4 text-left font-medium">店铺</th>
                    {selectedTransactions.map(t => (
                      <th key={t.id} className="py-2 px-3 text-right font-medium min-w-[100px]">
                        <div className="truncate max-w-[120px]" title={t.product_name}>
                          {t.product_name.length > 12 ? t.product_name.slice(0, 12) + '…' : t.product_name}
                        </div>
                        <div className="text-[10px] text-gray-400 normal-case font-normal">
                          ×{t.quantity_in_stock ?? Math.max(0, t.quantity - (t.quantity_sold || 0) - (t.quantity_returned || 0))}
                        </div>
                      </th>
                    ))}
                    <th className="py-2 pl-3 text-right font-medium border-l border-gray-200 dark:border-gray-700">合計買取</th>
                    <th className="py-2 pl-3 text-right font-medium">合計利润</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map(row => (
                    <tr
                      key={row.storeName}
                      className={row.rank === 1 ? 'bg-apple-blue/5' : ''}
                    >
                      {/* Store name */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <RankBadge rank={row.rank} />
                          <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {row.storeName}
                          </span>
                          {row.missingCount > 0 && (
                            <span className="text-[10px] text-amber-500" title={`${row.missingCount}件商品无价格数据`}>⚠</span>
                          )}
                        </div>
                      </td>

                      {/* Per-product columns */}
                      {row.items.map(item => (
                        <td key={item.transactionId} className="py-3 px-3 text-right">
                          {item.hasData ? (
                            <div>
                              <div className="font-mono text-gray-900 dark:text-white">
                                {formatCurrency(item.storePrice)}
                              </div>
                              <div className={`text-[11px] font-mono ${item.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      ))}

                      {/* Total revenue */}
                      <td className="py-3 pl-3 text-right border-l border-gray-200 dark:border-gray-700">
                        <span className="font-bold font-mono text-gray-900 dark:text-white">
                          {formatCurrency(row.totalRevenue)}
                        </span>
                      </td>

                      {/* Total profit */}
                      <td className="py-3 pl-3 text-right">
                        <span className={`font-bold font-mono ${row.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unit cost reference */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">单件成本参考</div>
              <div className="flex flex-wrap gap-3">
                {selectedTransactions.map(t => {
                  const totalPoints = (t.expected_platform_points || 0) + 
                                      (t.expected_card_points || 0) + 
                                      (t.extra_platform_points || 0);
                  const unitCost = (t.purchase_price_total - totalPoints) / (t.quantity || 1);
                  const qty = t.quantity_in_stock ?? Math.max(0, t.quantity - (t.quantity_sold || 0) - (t.quantity_returned || 0));
                  return (
                    <div key={t.id} className="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                      <span className="text-gray-600 dark:text-gray-400 truncate max-w-[80px] inline-block align-bottom">
                        {t.product_name.length > 10 ? t.product_name.slice(0, 10) + '…' : t.product_name}
                      </span>
                      <span className="ml-2 font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(unitCost)}</span>
                      <span className="ml-1 text-gray-400">×{qty}</span>
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
  return <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs flex items-center justify-center text-gray-500 font-medium">{rank}</span>;
}

function StoreCard({ row, bestRevenue }: { row: StoreRow; bestRevenue: number }) {
  const isBest = row.rank === 1;
  return (
    <div className={`rounded-xl border p-4 ${isBest
      ? 'border-apple-blue/20 bg-apple-blue/5'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {/* Store header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RankBadge rank={row.rank} />
          <span className="font-semibold text-gray-900 dark:text-white">{row.storeName}</span>
          {row.missingCount > 0 && (
            <span className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
              {row.missingCount}件无数据
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold font-mono text-lg text-gray-900 dark:text-white">
            {formatCurrency(row.totalRevenue)}
          </div>
          {bestRevenue > 0 && row.rank > 1 && (
            <div className="text-xs text-gray-400">
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
              <span className="text-gray-700 dark:text-gray-300 truncate block" title={item.productName}>
                {item.productName}
              </span>
              <span className="text-xs text-gray-400">×{item.qty} · 成本 {formatCurrency(item.unitCost)}/件</span>
            </div>
            {item.hasData ? (
              <div className="text-right shrink-0">
                <div className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(item.storePrice)}/件
                </div>
                <div className={`text-xs font-mono ${item.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                </div>
              </div>
            ) : (
              <span className="text-gray-300 dark:text-gray-600 text-sm shrink-0">无数据</span>
            )}
          </div>
        ))}
      </div>

      {/* Store total profit */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">合計利润</span>
        <span className={`font-bold font-mono text-base ${row.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {row.totalProfit >= 0 ? '+' : ''}{formatCurrency(row.totalProfit)}
        </span>
      </div>
    </div>
  );
}
