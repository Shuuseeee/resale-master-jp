// lib/api/payment-method-rules.ts — 支付方式店铺特殊规则（payment_method_store_rates）的读写
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethodStoreRate } from '@/types/database.types';

/** 当前用户的全部规则（数量很少，整表读取）。线上库还没建表时返回 error，调用方按「没有规则」处理 */
export async function fetchStoreRates(paymentMethodId?: string): Promise<{ data: PaymentMethodStoreRate[]; error: unknown }> {
  let query = supabase.from('payment_method_store_rates').select('*');
  if (paymentMethodId) query = query.eq('payment_method_id', paymentMethodId);
  const { data, error } = await query;
  return { data: (data as PaymentMethodStoreRate[] | null) ?? [], error };
}

/**
 * 把某个支付方式的规则同步成 desired：删掉不再需要的，其余按（支付方式, 进货平台）upsert。
 * 规则数量很少，直接逐条比较。
 */
export async function syncStoreRates(
  paymentMethodId: string,
  existing: PaymentMethodStoreRate[],
  desired: Array<{ purchase_platform_id: string; point_rate: number }>,
): Promise<{ error?: unknown }> {
  const keep = new Set(desired.map(r => r.purchase_platform_id));
  const removeIds = existing.filter(r => !keep.has(r.purchase_platform_id)).map(r => r.id);

  if (removeIds.length > 0) {
    const { error } = await supabase.from('payment_method_store_rates').delete().in('id', removeIds);
    if (error) return { error };
  }

  const changed = desired.filter(d => {
    const old = existing.find(r => r.purchase_platform_id === d.purchase_platform_id);
    return !old || Number(old.point_rate) !== d.point_rate;
  });
  if (changed.length > 0) {
    const { error } = await supabase
      .from('payment_method_store_rates')
      .upsert(
        changed.map(d => ({ payment_method_id: paymentMethodId, purchase_platform_id: d.purchase_platform_id, point_rate: d.point_rate })),
        { onConflict: 'payment_method_id,purchase_platform_id' },
      );
    if (error) return { error };
  }
  return {};
}
