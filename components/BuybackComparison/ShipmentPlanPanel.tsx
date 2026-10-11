// components/BuybackComparison/ShipmentPlanPanel.tsx — 比价弹层里的「最优出货方案（含运费）」
// 按当前比较数量调 /api/shipment-plan（与 MCP plan_shipment 同一个求解器：全局最优分配，算运费、包邮条件、箱型、手续费，
// 附自检）。缺尺寸的商品可就地补尺寸后重算；数量改了会提示重新计算。
// 每家店：店名链到店铺首页，商品名链到该店的 JAN 搜索页（地址见 lib/server/mcp-tools.ts 的 attachStoreLinks），可复制单个 / 整箱 JAN。
'use client';

import { useState } from 'react';
import { Checkmark16Regular } from '@fluentui/react-icons/headless/svg/checkmark';
import { Copy16Regular } from '@fluentui/react-icons/headless/svg/copy';
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

/** 每家店的商品清单默认显示的条数，多出的折叠 */
const BOX_ITEM_LIMIT = 5;

const keyOf = (items: PlanSelection[]) => items.map(i => `${i.transactionId}:${i.qty}`).join('|');

export default function ShipmentPlanPanel({ items }: { items: PlanSelection[] }) {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [planKey, setPlanKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingJan, setEditingJan] = useState<string | null>(null);
  const [openBoxes, setOpenBoxes] = useState<Set<string>>(new Set());
  const toggleBox = (store: string) =>
    setOpenBoxes(prev => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });

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

  const stale = !!result && planKey !== keyOf(items);
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
                  <div className="text-right">
                    <div className="font-mono font-semibold text-[var(--color-text)]">{formatCurrency(box.net)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">净回款</div>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {(openBoxes.has(box.store) ? box.items : box.items.slice(0, BOX_ITEM_LIMIT)).map(it => (
                    <li key={it.tid} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        {it.url ? (
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 truncate text-[var(--color-primary)] hover:underline"
                            title={`在 ${box.store} 搜索 ${it.jan}`}
                          >
                            {it.name}
                          </a>
                        ) : (
                          <span className="min-w-0 truncate text-[var(--color-text)]" title={it.name}>{it.name}</span>
                        )}
                        <CopyButton text={it.jan} label={`复制 JAN ${it.jan}`} />
                      </span>
                      <span className="shrink-0 font-mono text-xs text-[var(--color-text-secondary)]">{formatCurrency(it.unit_price)} × {it.qty}</span>
                    </li>
                  ))}
                </ul>
                {box.items.length > BOX_ITEM_LIMIT && (
                  <button type="button" className="fluent-link mt-1 text-xs" onClick={() => toggleBox(box.store)}>
                    {openBoxes.has(box.store) ? '收起' : `展开全部 ${box.items.length} 种（还有 ${box.items.length - BOX_ITEM_LIMIT}）`}
                  </button>
                )}
                {box.rule && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{box.rule}</p>}
                {[...box.blockers, ...box.warnings].map(w => (
                  <p key={w} className="mt-1 text-xs text-[var(--color-warning)]">{w}</p>
                ))}
              </div>
            ))}
          </div>

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

/** 小号复制按钮：点后图标变成勾 1.5 秒（弹层里不再叠一层提示对话框） */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className={`shrink-0 rounded-[var(--radius-sm)] p-1 transition-colors hover:bg-[var(--color-bg-hover)] ${done ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
      title={done ? '已复制' : label}
      aria-label={label}
    >
      {done ? <Checkmark16Regular /> : <Copy16Regular />}
    </button>
  );
}
