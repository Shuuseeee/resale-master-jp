// components/BuybackComparisonModal.tsx — 买取价格比较弹层（交易页 / 仪表盘「まとめ比較」）
// 传入 onForceRefresh 时，每个商品卡片有「官方强刷」（消耗 1 次 Kaitorix 官方 API 额度），顶部显示今天剩余配额。
// 2026-10-11 买取价格页删除后，网页上的手动强刷只在这里。
// 「最优出货方案」（ShipmentPlanPanel）按当前比较数量调求解器，算运费与包邮条件；下面的店铺表是不含运费的单纯报价比较。
'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import MessageBar from '@/components/fluent/MessageBar';
import { formatCurrency, getAvailableQty } from '@/lib/financial/calculator';
import type { BuybackInfo } from '@/hooks/useKaitorixPrices';
import type { TransactionForCompare } from '@/hooks/useBuybackComparison';
import { useBuybackComparison } from '@/hooks/useBuybackComparison';
import ProductCompareCard from '@/components/BuybackComparison/ProductCompareCard';
import StoreRowDesktop from '@/components/BuybackComparison/StoreRowDesktop';
import StoreRowMobile from '@/components/BuybackComparison/StoreRowMobile';
import ShipmentPlanPanel from '@/components/BuybackComparison/ShipmentPlanPanel';

/** 默认显示的商品卡片（桌面两列 × 2 行，手机单列 2 张）/ 店铺行数，多出的折叠 */
const PRODUCT_LIMIT_DESKTOP = 4;
const PRODUCT_LIMIT_MOBILE = 2;
const STORE_LIMIT = 5;

function ExpandToggle({ total, limit, expanded, onToggle, unit }: { total: number; limit: number; expanded: boolean; onToggle: () => void; unit: string }) {
  if (total <= limit) return null;
  return (
    <button type="button" onClick={onToggle} className="fluent-btn fluent-btn--subtle mt-2 w-full">
      {expanded ? '收起' : `展开全部 ${total} ${unit}（还有 ${total - limit}）`}
    </button>
  );
}

export type ForceRefreshHandler = (jan: string) => Promise<{ ok: boolean; error?: string }>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: TransactionForCompare[];
  buybackMap: Map<string, BuybackInfo>;
  /** 官方强刷一个 JAN，成功后由调用方更新 buybackMap */
  onForceRefresh?: ForceRefreshHandler;
}

interface Usage {
  remaining: number;
  limit: number;
}

async function fetchUsage(): Promise<Usage | null> {
  try {
    const res = await fetch('/api/kaitorix/open-usage');
    if (!res.ok) return null;
    const body = await res.json();
    return { remaining: Number(body.remaining), limit: Number(body.limit) };
  } catch {
    return null;
  }
}

export default function BuybackComparisonModal({ isOpen, onClose, selectedTransactions, buybackMap, onForceRefresh }: Props) {
  const {
    rows, products, bestPossibleRevenue, bestPossibleProfit,
    totalSelectedQty, quantities, updateQty
  } = useBuybackComparison({ selectedTransactions, buybackMap, isOpen });
  const [usage, setUsage] = useState<Usage | null>(null);
  const [refreshingJan, setRefreshingJan] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState('');
  // 商品 / 店铺多时折叠（每次打开弹层恢复折叠）
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAllStores, setShowAllStores] = useState(false);
  const [productLimit, setProductLimit] = useState(PRODUCT_LIMIT_DESKTOP);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setProductLimit(mq.matches ? PRODUCT_LIMIT_DESKTOP : PRODUCT_LIMIT_MOBILE);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setShowAllProducts(false);
    setShowAllStores(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !onForceRefresh) return;
    setRefreshError('');
    fetchUsage().then(setUsage);
  }, [isOpen, onForceRefresh]);

  const forceRefresh = useCallback(async (jan: string, name: string) => {
    if (!onForceRefresh || refreshingJan) return;
    const left = usage ? `今天剩余 ${usage.remaining}/${usage.limit} 次` : '剩余次数暂未知';
    if (!confirm(`用 1 次官方额度刷新「${name}」的买取价？\n${left}`)) return;
    setRefreshingJan(jan);
    setRefreshError('');
    const result = await onForceRefresh(jan);
    if (!result.ok) setRefreshError(result.error || '官方强刷失败');
    setUsage(await fetchUsage());
    setRefreshingJan(null);
  }, [onForceRefresh, refreshingJan, usage]);

  if (!isOpen) return null;

  const bestRevenue = rows[0]?.totalRevenue ?? 0;
  const shownProducts = showAllProducts ? products : products.slice(0, productLimit);
  const shownRows = showAllStores ? rows : rows.slice(0, STORE_LIMIT);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="买取价格比较" size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-border)] pb-2 text-sm text-[var(--color-text-muted)]">
          <span>已选 <span className="font-semibold text-[var(--color-text)]">{selectedTransactions.length}</span> 件商品</span>
          <span>·</span>
          <span>比较数量 <span className="font-semibold text-[var(--color-text)]">{totalSelectedQty}</span> 个</span>
          <span>·</span>
          <span><span className="font-semibold text-[var(--color-text)]">{rows.length}</span> 家店铺</span>
          {onForceRefresh && usage && (
            <span className="ml-auto">官方配额 <span className="font-semibold text-[var(--color-text)]">{usage.remaining}/{usage.limit}</span></span>
          )}
        </div>
        {refreshError && <MessageBar intent="error">{refreshError}</MessageBar>}

        {/* 商品卡片：没有报价时也显示（可官方强刷） */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-[var(--color-text)]">比较数量</div>
            <div className="text-xs text-[var(--color-text-muted)]">可临时调整，不会修改库存</div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {shownProducts.map(p => (
              <ProductCompareCard
                key={p.transactionId}
                product={p}
                onQtyChange={(v) => updateQty(p.transactionId, v)}
                onForceRefresh={onForceRefresh && p.janCode ? () => forceRefresh(p.janCode!, p.productName) : undefined}
                refreshing={!!p.janCode && refreshingJan === p.janCode}
                refreshDisabled={!!refreshingJan}
              />
            ))}
          </div>
          <ExpandToggle total={products.length} limit={productLimit} expanded={showAllProducts} onToggle={() => setShowAllProducts(v => !v)} unit="件商品" />
        </div>

        {/* 最优出货方案（含运费）：与 MCP 同一个求解器 */}
        <ShipmentPlanPanel items={products.map(p => ({ transactionId: p.transactionId, qty: p.qty }))} />

        {rows.length === 0 ? (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            未找到各店铺的买取价格数据
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <div className={`mt-1 text-xs font-mono ${bestPossibleProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  利润 {bestPossibleProfit >= 0 ? '+' : ''}{formatCurrency(bestPossibleProfit)}
                </div>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {shownRows.map(row => (
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
                  {shownRows.map(row => (
                    <StoreRowDesktop key={row.storeName} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
            <ExpandToggle total={rows.length} limit={STORE_LIMIT} expanded={showAllStores} onToggle={() => setShowAllStores(v => !v)} unit="家店铺" />
          </>
        )}
      </div>
    </Modal>
  );
}
