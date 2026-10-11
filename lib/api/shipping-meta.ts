// lib/api/shipping-meta.ts — 商品出货尺寸（product_shipping_meta，用户 × JAN）
// 出货方案求解用：体积（L/件，含缓冲）、最小箱型（三边合计 60–160 cm）、分类（规则里「スマホ 3台以上」等按分类计数）。
// 缺尺寸的商品不参与出货方案（列在 missing_meta）。RLS 只许本人读写。
import { supabase } from '@/lib/supabase/client';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';

export interface ShippingMeta {
  jan: string;
  vol: number;
  min_size: number;
  category: string | null;
  note: string | null;
}

export const BOX_SIZES = [60, 80, 100, 120, 140, 160] as const;

/** 分类存日文值（与 solver/core/rules.json 一致）；规则目前只按「スマホ」「ゲーム」计数 */
export const SHIPPING_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: '不指定' },
  { value: 'スマホ', label: '手机（スマホ）' },
  { value: 'ゲーム', label: '游戏（ゲーム）' },
  { value: '家電', label: '家电（家電）' },
];

export async function getAllShippingMeta(): Promise<ShippingMeta[]> {
  return fetchAllRows<ShippingMeta>((from, to, opts) =>
    supabase.from('product_shipping_meta').select('jan, vol, min_size, category, note', opts).order('jan').range(from, to),
  );
}

export async function getShippingMeta(jans: string[]): Promise<Map<string, ShippingMeta>> {
  const rows = await fetchAllByIds<ShippingMeta>(jans, (chunk, from, to, opts) =>
    supabase.from('product_shipping_meta').select('jan, vol, min_size, category, note', opts).in('jan', chunk).order('jan').range(from, to),
  );
  return new Map(rows.map(r => [r.jan, r]));
}

export async function saveShippingMeta(meta: ShippingMeta): Promise<void> {
  const { error } = await supabase.from('product_shipping_meta').upsert(
    {
      jan: meta.jan,
      vol: meta.vol,
      min_size: meta.min_size,
      category: meta.category || null,
      note: meta.note || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,jan' },
  );
  if (error) throw error;
}

export async function deleteShippingMeta(jan: string): Promise<void> {
  const { error } = await supabase.from('product_shipping_meta').delete().eq('jan', jan);
  if (error) throw error;
}
