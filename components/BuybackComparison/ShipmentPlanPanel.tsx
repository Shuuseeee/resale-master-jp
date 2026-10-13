// components/BuybackComparison/ShipmentPlanPanel.tsx — 比价弹层里的「最优出货方案（含运费）」
// 按当前比较数量调 /api/shipment-plan（与 MCP plan_shipment 同一个求解器：全局最优分配，算运费、包邮条件、箱型、手续费，
// 附自检）。缺尺寸的商品可就地补尺寸后重算；数量改了会提示重新计算。
// 每家店：店名链到店铺首页，商品名链到该店的 JAN 搜索页（地址见 lib/server/mcp-tools.ts 的 attachStoreLinks），可复制单个 / 整箱 JAN。
// 每家店的「售出」：把这箱的商品当作同一订单售出（与交易页「同一订单售出」同一个表单），预填店铺、数量、该店单价，
// 汇款手续费按金额分摊到各件。运费不带：用户的运费单独记在经费里，带进出售记录会重复扣；店铺奖励（incentive）也没有对应字段。
// 商品清单按 JAN 合并成一行（同一商品来自多笔进货时，单价相同、只有总数量有用），「来自 N 笔进货」可展开看每笔。
'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal, { ConfirmModal, UNSAVED_CHANGES_CONFIRM } from '@/components/Modal';
import MultiItemSaleForm from '@/components/MultiItemSaleForm';
import { useModalCloseGuard } from '@/hooks/useModalCloseGuard';
import { fetchSingleTransaction } from '@/lib/api/transactions-cache';
import type { Transaction } from '@/types/database.types';
import CopyButton from '@/components/CopyButton';
import MessageBar from '@/components/fluent/MessageBar';
import Spinner from '@/components/fluent/Spinner';
import ShippingMetaForm from '@/components/BuybackComparison/ShippingMetaForm';
import { button, card } from '@/lib/theme';
import { formatCurrency } from '@/lib/financial/calculator';

export interface PlanSelection {
  transactionId: string;
  qty: number;
}

interface PlanBox {
  store: string;
  amount: number;
  qty: number;
  size: number;
  free_shipping: boolean;
  shipping: number;
  rule: string;
  blockers: string[];
  warnings: string[];
  transfer_fee: number;
  incentive: number;
  net: number;
  /** 店铺首页（来自官方报价里的地址；没有则为 null） */
  store_url?: string | null;
  /** url：该店的 JAN 搜索页（店铺不支持搜索时为首页） */
  items: { tid: string; name: string; jan: string; qty: number; unit_price: number; unit_cost: number; url?: string | null }[];
}

interface PlanResult {
  ok: boolean;
  error?: string;
  total?: { rev: number; ship: number; fee: number; inc: number; qty: number; net: number; cost: number; profit: number };
  boxes?: PlanBox[];
  unpriced?: { name: string; jan: string; qty: number }[];
  missing_meta?: { jan: string; product_name: string }[];
  no_jan?: string[];
  need_confirm?: { name: string; store: string; price: number }[];
  closed_stores?: { store: string; reasons: string[] }[];
  category_warnings?: string[];
  checks?: { ok: boolean; lines: string[]; greedy_net: number };
}

/** 按权重分摊整数金额（向下取整，余数给最后一件），保证合计不变 */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!total || !sum) return weights.map(() => 0);
  let acc = 0;
  return weights.map((w, i) => {
    if (i === weights.length - 1) return total - acc;
    const v = Math.floor((total * w) / sum);
    acc += v;
    return v;
  });
}

/** 同一家店里同一 JAN、同一单价的几笔进货合并成一行（单价是这家店的报价，只有总数量有用） */
function mergeByJan(items: PlanBox['items']) {
  const map = new Map<string, { key: string; jan: string; name: string; url?: string | null; unitPrice: number; qty: number; parts: PlanBox['items'] }>();
  for (const it of items) {
    const key = `${it.jan || it.tid}\u0001${it.unit_price}`;
    const line = map.get(key);
    if (line) {
      line.qty += it.qty;
      line.parts.push(it);
    } else {
      map.set(key, { key, jan: it.jan, name: it.name, url: it.url, unitPrice: it.unit_price, qty: it.qty, parts: [it] });
    }
  }
  return [...map.values()];
}

/** 每家店的商品清单默认显示的条数（按合并后的商品种数），多出的折叠 */
const BOX_ITEM_LIMIT = 5;

const keyOf = (items: PlanSelection[]) => items.map(i => `${i.transactionId}:${i.qty}`).join('|');

export default function ShipmentPlanPanel({ items }: { items: PlanSelection[] }) {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [planKey, setPlanKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingJan, setEditingJan] = useState<string | null>(null);
  const [openBoxes, setOpenBoxes] = useState<Set<string>>(new Set());
  // 合并行「来自 N 笔进货」展开的明细
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const toggleLine = (key: string) =>
    setOpenLines(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleBox = (store: string) =>
    setOpenBoxes(prev => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });

  // ── 按店售出 ──
  const queryClient = useQueryClient();
  const [sale, setSale] = useState<{ box: PlanBox; transactions: Transaction[]; drafts: Record<string, { quantity_sold: number; selling_price_per_unit: number; shipping_fee: number; platform_fee: number }> } | null>(null);
  const [saleLoading, setSaleLoading] = useState<string | null>(null);
  const [saleError, setSaleError] = useState('');
  const [soldStores, setSoldStores] = useState<Set<string>>(new Set());
  const closeSale = () => setSale(null);
  const saleGuard = useModalCloseGuard(closeSale);

  const openSale = async (box: PlanBox) => {
    setSaleError('');
    setSaleLoading(box.store);
    try {
      const ids = [...new Set(box.items.map(i => i.tid))];
      const transactions = await Promise.all(ids.map(id => fetchSingleTransaction(id)));
      const amounts = box.items.map(i => i.unit_price * i.qty);
      const fee = allocate(box.transfer_fee || 0, amounts);
      const drafts: Record<string, { quantity_sold: number; selling_price_per_unit: number; shipping_fee: number; platform_fee: number }> = {};
      box.items.forEach((it, i) => {
        const prev = drafts[it.tid];
        drafts[it.tid] = prev
          ? { ...prev, quantity_sold: prev.quantity_sold + it.qty, platform_fee: prev.platform_fee + fee[i] }
          : { quantity_sold: it.qty, selling_price_per_unit: it.unit_price, shipping_fee: 0, platform_fee: fee[i] };
      });
      setSale({ box, transactions, drafts });
    } catch {
      setSaleError(`读取「${box.store}」这箱的交易失败，请重试`);
    } finally {
      setSaleLoading(null);
    }
  };

  const run = async () => {
    setLoading(true);
    setEditingJan(null);
    try {
      const res = await fetch('/api/shipment-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: items.filter(i => i.qty > 0).map(i => ({ transaction_id: i.transactionId, qty: i.qty })) }),
      });
      setResult(await res.json());
      setPlanKey(keyOf(items));
    } catch {
      setResult({ ok: false, error: '计算失败，请检查网络' });
    } finally {
      setLoading(false);
    }
  };

  // 售出后比较数量会随数据刷新而变（卖掉的件数没了），这不是用户改了数量，不提示重新计算
  const resyncAfterSale = useRef(false);
  const itemsKey = keyOf(items);
  useEffect(() => {
    if (!resyncAfterSale.current) return;
    resyncAfterSale.current = false;
    setPlanKey(itemsKey);
  }, [itemsKey]);
  const stale = !!result && planKey !== itemsKey;
  const total = result?.total;
  const gain = total && result?.checks ? total.net - result.checks.greedy_net : 0;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">最优出货方案（含运费）</div>
          <div className="text-xs text-[var(--color-text-secondary)]">按当前比较数量，综合各店报价、包邮条件、宅急便运费和箱型，算整体净回款最高的分法</div>
        </div>
        <button type="button" onClick={run} disabled={loading || items.every(i => i.qty <= 0)} className={button.primary + ' gap-2'}>
          {loading && <Spinner />}
          {result ? '重新计算' : '计算方案'}
        </button>
      </div>

      {stale && <div className="mt-2"><MessageBar intent="info">比较数量改过了，点「重新计算」更新方案。</MessageBar></div>}

      {result && !result.ok && result.error && <div className="mt-3"><MessageBar intent="error">{result.error}</MessageBar></div>}

      {result?.ok && total && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="净回款" value={formatCurrency(total.net)} strong />
            <Stat label="运费" value={formatCurrency(total.ship)} />
            <Stat label="利润" value={formatCurrency(total.profit)} tone={total.profit >= 0 ? 'success' : 'danger'} />
            <Stat label="件数" value={`${total.qty} 个`} />
          </div>
          {gain > 0 && (
            <p className="text-xs text-[var(--color-text-secondary)]">比逐件卖给最高价的店多 <span className="font-semibold text-[var(--color-success)]">{formatCurrency(gain)}</span>（省下的运费 / 凑到包邮）</p>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {result.boxes?.map(box => (
              <div key={box.store} className={card.primary + ' p-3'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {box.store_url ? (
                        <a href={box.store_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-primary)] hover:underline" title="打开店铺网站">
                          {box.store}
                        </a>
                      ) : (
                        <span className="font-semibold text-[var(--color-text)]">{box.store}</span>
                      )}
                      <CopyButton text={box.items.map(i => i.jan).join('\n')} label="复制本箱全部 JAN" />
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {box.size} 尺寸 · {box.qty} 个 · {box.free_shipping ? '包邮' : `运费 ${formatCurrency(box.shipping)}`}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="font-mono font-semibold text-[var(--color-text)]">{formatCurrency(box.net)}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">净回款</div>
                    </div>
                    {soldStores.has(box.store) ? (
                      <span className="whitespace-nowrap rounded px-2 py-1 text-xs text-[var(--color-success)]">已售出</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSale(box)}
                        disabled={!!saleLoading || stale}
                        title={stale ? '比较数量改过了，先重新计算' : '这箱当作同一订单售出'}
                        className={button.primary + ' gap-1.5 whitespace-nowrap'}
                      >
                        {saleLoading === box.store && <Spinner />}
                        售出
                      </button>
                    )}
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {(() => {
                    const lines = mergeByJan(box.items);
                    const shown = openBoxes.has(box.store) ? lines : lines.slice(0, BOX_ITEM_LIMIT);
                    return shown.map(line => {
                      const lineKey = `${box.store}\u0001${line.key}`;
                      return (
                        <li key={line.key}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1">
                              {line.url ? (
                                <a
                                  href={line.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-w-0 truncate text-[var(--color-primary)] hover:underline"
                                  title={`在 ${box.store} 搜索 ${line.jan}`}
                                >
                                  {line.name}
                                </a>
                              ) : (
                                <span className="min-w-0 truncate text-[var(--color-text)]" title={line.name}>{line.name}</span>
                              )}
                              <CopyButton text={line.jan} label={`复制 JAN ${line.jan}`} />
                            </span>
                            <span className="shrink-0 font-mono text-xs text-[var(--color-text-secondary)]">{formatCurrency(line.unitPrice)} × {line.qty}</span>
                          </div>
                          {line.parts.length > 1 && (
                            <>
                              <button type="button" className="fluent-link text-xs" onClick={() => toggleLine(lineKey)}>
                                来自 {line.parts.length} 笔进货{openLines.has(lineKey) ? '（收起）' : ''}
                              </button>
                              {openLines.has(lineKey) && (
                                <ul className="mt-0.5 space-y-0.5 pl-3 text-xs text-[var(--color-text-secondary)]">
                                  {line.parts.map(p => (
                                    <li key={p.tid} className="flex justify-between gap-2">
                                      <span>成本 {formatCurrency(p.unit_cost)}</span>
                                      <span className="font-mono">× {p.qty}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </li>
                      );
                    });
                  })()}
                </ul>
                {mergeByJan(box.items).length > BOX_ITEM_LIMIT && (
                  <button type="button" className="fluent-link mt-1 text-xs" onClick={() => toggleBox(box.store)}>
                    {openBoxes.has(box.store) ? '收起' : `展开全部 ${mergeByJan(box.items).length} 种（还有 ${mergeByJan(box.items).length - BOX_ITEM_LIMIT}）`}
                  </button>
                )}
                {box.rule && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{box.rule}</p>}
                {[...box.blockers, ...box.warnings].map(w => (
                  <p key={w} className="mt-1 text-xs text-[var(--color-warning)]">{w}</p>
                ))}
              </div>
            ))}
          </div>

          {saleError && <MessageBar intent="error">{saleError}</MessageBar>}
          {!!result.unpriced?.length && (
            <MessageBar intent="warning">没有 7 天内有效报价、建议留库：{result.unpriced.map(u => `${u.name} ×${u.qty}`).join('、')}</MessageBar>
          )}
          {!!result.need_confirm?.length && (
            <MessageBar intent="warning">
              这些店报价更高但规则未确认 / 被排除，出货前请人工确认：{result.need_confirm.map(n => `${n.name} @${n.store} ${formatCurrency(n.price)}`).join('、')}
            </MessageBar>
          )}
          {!!result.closed_stores?.length && (
            <MessageBar intent="warning">今天休业或有限制：{result.closed_stores.map(c => `${c.store}（${c.reasons.join('、')}）`).join('、')}</MessageBar>
          )}
          {!!result.category_warnings?.length && <MessageBar intent="warning">{result.category_warnings.join('；')}</MessageBar>}
          {result.checks && !result.checks.ok && <MessageBar intent="error">自检没有通过，请不要直接按这个方案出货：{result.checks.lines.join(' / ')}</MessageBar>}
        </div>
      )}

      {!!result?.missing_meta?.length && (
        <div className="mt-3 space-y-2">
          <MessageBar intent="warning">这些商品缺少尺寸，没有参与计算。补上后点「重新计算」。</MessageBar>
          {result.missing_meta.map(m => (
            <div key={m.jan} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-[var(--color-text)]" title={m.product_name}>{m.product_name}</span>
                {editingJan !== m.jan && (
                  <button type="button" onClick={() => setEditingJan(m.jan)} className="fluent-link shrink-0 text-sm">补尺寸</button>
                )}
              </div>
              {editingJan === m.jan && (
                <div className="mt-2">
                  <ShippingMetaForm
                    jan={m.jan}
                    defaultNote={m.product_name}
                    onSaved={() => {
                      setEditingJan(null);
                      setResult(r => (r ? { ...r, missing_meta: r.missing_meta?.filter(x => x.jan !== m.jan) } : r));
                    }}
                    onCancel={() => setEditingJan(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!!result?.no_jan?.length && (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">没有 JAN、不参与计算：{result.no_jan.join('、')}</p>
      )}
      {/* 按店售出 = 同一订单售出（交易页同一个表单），预填店铺 / 数量 / 单价 / 分摊的运费与手续费 */}
      <Modal
        isOpen={!!sale}
        onClose={saleGuard.doClose}
        beforeClose={saleGuard.handleCloseRequest}
        closeOnEsc={!saleGuard.showConfirm}
        closeOnOverlayClick={!saleGuard.showConfirm}
        title={sale ? `售出到 ${sale.box.store}（同一订单 ${sale.transactions.length} 件）` : ''}
        size="xl"
      >
        {sale && (
          <MultiItemSaleForm
            transactions={sale.transactions}
            initialPlatformName={sale.box.store}
            initialDrafts={sale.drafts}
            onSuccess={() => {
              resyncAfterSale.current = true;
              setSoldStores(prev => new Set(prev).add(sale.box.store));
              setSale(null);
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            }}
            onCancel={saleGuard.doClose}
            onDirtyChange={saleGuard.setIsDirty}
          />
        )}
      </Modal>
      <ConfirmModal
        isOpen={saleGuard.showConfirm}
        onClose={saleGuard.cancelConfirm}
        onConfirm={saleGuard.doClose}
        title={UNSAVED_CHANGES_CONFIRM.title}
        message={UNSAVED_CHANGES_CONFIRM.message}
        confirmText={UNSAVED_CHANGES_CONFIRM.confirmText}
        cancelText={UNSAVED_CHANGES_CONFIRM.cancelText}
      />
    </section>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-[var(--color-success)]' : tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]';
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-stat)] px-3 py-2">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className={`font-mono ${strong ? 'text-lg font-semibold' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  );
}

