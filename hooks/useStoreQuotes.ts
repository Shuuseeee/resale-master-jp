// hooks/useStoreQuotes.ts — 出售表单用：这几个 JAN 在各店的当前买取价（照买取X 出售表单：选了出售对象就带出该店报价）
// 来源 = 视图 assistant_buyback_prices（官方 API 缓存与每日 CSV 取较新，与仪表盘同一口径），只读、不消耗官方 API 额度；
// 超过 7 天的报价不用（is_stale，与店铺报价 7 天规则一致）。店名与销售平台名按 storeMatchKey 比较（忽略大小写、空格、全半角、「買取」字样）。
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { fetchAllByIds } from '@/lib/api/fetchAll';
import { storeMatchKey } from '@/lib/kaitorix-config';

export interface StoreQuote {
  store: string;
  price: number;
  updatedAt: string | null;
}

/** JAN → 店名键（storeMatchKey）→ 报价 */
export type StoreQuoteMap = Map<string, Map<string, StoreQuote>>;

export function useStoreQuotes(jans: (string | null | undefined)[]): StoreQuoteMap {
  const key = useMemo(() => [...new Set(jans.filter((j): j is string => !!j))].sort().join(','), [jans]);
  const [quotes, setQuotes] = useState<StoreQuoteMap>(new Map());

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setQuotes(new Map());
      return;
    }
    let cancelled = false;
    fetchAllByIds<{ jan: string; store: string; price: number; price_updated_at: string | null; is_stale: boolean }>(
      list,
      (chunk, from, to, opts) =>
        supabase
          .from('assistant_buyback_prices')
          .select('jan, store, price, price_updated_at, is_stale', opts)
          .in('jan', chunk)
          .order('jan')
          .order('store')
          .range(from, to),
    )
      .then(rows => {
        if (cancelled) return;
        const map: StoreQuoteMap = new Map();
        for (const r of rows) {
          if (r.is_stale || !(Number(r.price) > 0)) continue;
          const byStore = map.get(r.jan) ?? new Map<string, StoreQuote>();
          // 写法不同的同一家店（如旧名「買取Top Offers」）落到同一个键时，留更新时间较新的那条
          const k = storeMatchKey(r.store);
          const prev = byStore.get(k);
          if (!prev || (r.price_updated_at ?? '') > (prev.updatedAt ?? '')) {
            byStore.set(k, { store: r.store, price: Number(r.price), updatedAt: r.price_updated_at });
          }
          map.set(r.jan, byStore);
        }
        setQuotes(map);
      })
      .catch(() => {
        // 拿不到报价只是不自动填价，表单照常可用
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return quotes;
}

/** 这个 JAN 在这家（按销售平台名匹配店名）的报价 */
export function quoteFor(quotes: StoreQuoteMap, jan: string | null | undefined, platformName: string | null | undefined): StoreQuote | null {
  if (!jan || !platformName) return null;
  return quotes.get(jan)?.get(storeMatchKey(platformName)) ?? null;
}

/** 报价更新时间的短格式（M/D HH:mm） */
export function formatQuoteTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
}
