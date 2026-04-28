// lib/api/transactions.ts
// 交易相关的通用 Supabase 操作(轻量编辑/复制/删除)
// 完整的新建表单和完整编辑仍在各自页面里直接调用 supabase

import { supabase } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database.types';

export type QuickEditPayload = Partial<Pick<Transaction,
  | 'status'
  | 'quantity'
  | 'unit_price'
  | 'order_number'
  | 'card_id'
  | 'purchase_platform_id'
  | 'notes'
  | 'purchase_price_total'
  | 'card_paid'
  | 'point_paid'
  | 'balance_paid'
>>;

export async function quickUpdateTransaction(
  id: string,
  partial: QuickEditPayload
): Promise<{ error: any }> {
  const updateData: Record<string, any> = { ...partial };
  if ('order_number' in partial) {
    updateData.order_number = partial.order_number || null;
  }
  if ('card_id' in partial) {
    updateData.card_id = partial.card_id || null;
  }
  if ('purchase_platform_id' in partial) {
    updateData.purchase_platform_id = partial.purchase_platform_id || null;
  }

  const { error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id);

  return { error };
}

export interface QuickCopyOverrides {
  date: string;
  quantity: number;
  unit_price: number;
  order_number?: string;
}

export async function quickCopyTransaction(
  source: Transaction,
  overrides: QuickCopyOverrides
): Promise<{ data: Transaction | null; error: any }> {
  const newTotal = overrides.unit_price * overrides.quantity;
  const sourceTotal = source.purchase_price_total || 0;
  const moneyRatio = sourceTotal > 0 ? newTotal / sourceTotal : 1;
  const qtyRatio = source.quantity > 0 ? overrides.quantity / source.quantity : 1;

  const insertData = {
    date: overrides.date,
    product_name: source.product_name,
    quantity: overrides.quantity,
    purchase_price_total: newTotal,
    card_paid: Math.round(source.card_paid * moneyRatio),
    point_paid: Math.round(source.point_paid * moneyRatio),
    balance_paid: Math.round(source.balance_paid * moneyRatio),
    card_id: source.card_id || null,
    expected_platform_points: Math.round(source.expected_platform_points * qtyRatio),
    expected_card_points: Math.round(source.expected_card_points * moneyRatio),
    extra_platform_points: Math.round((source.extra_platform_points || 0) * qtyRatio),
    platform_points_platform_id: source.platform_points_platform_id || null,
    card_points_platform_id: source.card_points_platform_id || null,
    extra_platform_points_platform_id: source.extra_platform_points_platform_id || null,
    jan_code: source.jan_code || null,
    unit_price: overrides.unit_price,
    purchase_platform_id: source.purchase_platform_id || null,
    order_number: overrides.order_number || null,
    image_url: null,
    notes: source.notes || null,
    status: 'pending' as const,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert([insertData])
    .select()
    .single();

  return { data, error };
}

export async function deleteTransaction(id: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  return { error };
}
