// components/settings/ShippingMetaSection.tsx — 设置「商品尺寸」：出货方案求解用的体积 / 最小箱型 / 分类（product_shipping_meta）
// 列出未售库存里的 JAN 与已登记尺寸的 JAN；缺尺寸的排在前面，可就地补 / 改 / 删。比价弹层里也能补（ShippingMetaForm 共用）。
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
import { deleteShippingMeta, getAllShippingMeta, SHIPPING_CATEGORIES, type ShippingMeta } from '@/lib/api/shipping-meta';
import ShippingMetaForm from '@/components/BuybackComparison/ShippingMetaForm';
import TabList from '@/components/fluent/TabList';
import Spinner from '@/components/fluent/Spinner';
import MessageBar from '@/components/fluent/MessageBar';
import { badge, card } from '@/lib/theme';

interface Row {
  jan: string;
  name: string;
  unsold: number;
  meta: ShippingMeta | null;
}

type View = 'missing' | 'unsold' | 'all';
const VIEWS: { id: View; label: string }[] = [
  { id: 'missing', label: '缺尺寸' },
  { id: 'unsold', label: '未售商品' },
  { id: 'all', label: '全部' },
];

const categoryLabel = (v: string | null) => SHIPPING_CATEGORIES.find(c => c.value === (v ?? ''))?.label ?? v ?? '';

export default function ShippingMetaSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('missing');
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txs, metas] = await Promise.all([
        fetchAllRows<{ jan_code: string | null; product_name: string; date: string; quantity_in_stock: number | null }>((from, to, opts) =>
          supabase
            .from('transactions')
            .select('jan_code, product_name, date, quantity_in_stock', opts)
            .in('status', ['pending', 'in_stock'])
            .not('jan_code', 'is', null)
            .order('date')
            .order('id')
            .range(from, to),
        ),
        getAllShippingMeta(),
      ]);
      const map = new Map<string, Row>();
      for (const t of txs) {
        if (!t.jan_code) continue;
        const r = map.get(t.jan_code) ?? { jan: t.jan_code, name: t.product_name, unsold: 0, meta: null };
        r.name = t.product_name;
        r.unsold += Math.max(0, t.quantity_in_stock ?? 0);
        map.set(t.jan_code, r);
      }
      for (const m of metas) {
        const r = map.get(m.jan) ?? { jan: m.jan, name: m.note ?? '', unsold: 0, meta: null };
        r.meta = m;
        map.set(m.jan, r);
      }
      setRows([...map.values()].sort((a, b) => Number(!!a.meta) - Number(!!b.meta) || b.unsold - a.unsold || a.name.localeCompare(b.name)));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (!rows) return [];
    if (view === 'missing') return rows.filter(r => !r.meta && r.unsold > 0);
    if (view === 'unsold') return rows.filter(r => r.unsold > 0);
    return rows;
  }, [rows, view]);
  const missingCount = rows?.filter(r => !r.meta && r.unsold > 0).length ?? 0;

  const remove = async (r: Row) => {
    if (!confirm(`删除「${r.name || r.jan}」的尺寸？`)) return;
    try {
      await deleteShippingMeta(r.jan);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <section className={card.primary + ' p-6'}>
      <h2 className="text-xl font-bold text-[var(--color-text)]">商品尺寸</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        出货方案（比价弹层「计算方案」、AI 的 plan_shipment）按体积和最小箱型装箱、算宅急便运费；缺尺寸的商品不参与计算。
        体积按一件含缓冲材的大小估（升），分类用于「手机 3 台以上」这类店铺规则。
      </p>
      {missingCount > 0 && (
        <div className="mt-4"><MessageBar intent="warning">有 {missingCount} 个未售商品还没有尺寸。</MessageBar></div>
      )}
      <div className="mt-4 overflow-x-auto">
        <TabList items={VIEWS} selected={view} onSelect={setView} ariaLabel="尺寸筛选" />
      </div>
      <div className="mt-3">
        {error ? (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        ) : !rows ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{view === 'missing' ? '未售商品都有尺寸了' : '没有商品'}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map(r => (
              <li key={r.jan} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text)]" title={r.name}>{r.name || '（无商品名）'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span className="font-mono">{r.jan}</span>
                      {r.unsold > 0 && <span>未售 {r.unsold}</span>}
                      {r.meta ? (
                        <span>
                          {r.meta.vol} L · {r.meta.min_size} 尺寸{r.meta.category ? ` · ${categoryLabel(r.meta.category)}` : ''}
                        </span>
                      ) : (
                        <span className={badge.pending}>缺尺寸</span>
                      )}
                    </p>
                  </div>
                  {editing !== r.jan && (
                    <div className="flex shrink-0 gap-3 text-sm">
                      <button type="button" className="fluent-link" onClick={() => setEditing(r.jan)}>{r.meta ? '编辑' : '补尺寸'}</button>
                      {r.meta && <button type="button" className="fluent-link" onClick={() => remove(r)}>删除</button>}
                    </div>
                  )}
                </div>
                {editing === r.jan && (
                  <div className="mt-3">
                    <ShippingMetaForm
                      jan={r.jan}
                      initial={r.meta}
                      defaultNote={r.name}
                      onSaved={() => {
                        setEditing(null);
                        load();
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
