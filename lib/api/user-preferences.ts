// lib/api/user-preferences.ts — 用户偏好的 Supabase 读写
import { supabase } from '@/lib/supabase/client';
import type { ColumnConfig } from '@/lib/transactions/columns';

export async function getColumnPreferences(): Promise<ColumnConfig[] | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('transactions_columns')
    .single();

  if (error || !data?.transactions_columns) return null;
  return data.transactions_columns as ColumnConfig[];
}

export async function saveColumnPreferences(cols: ColumnConfig[]): Promise<{ error?: unknown }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, transactions_columns: cols, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  return { error: error ?? undefined };
}

// —— 默认支付卡（新建交易时自动选中；user_preferences.default_payment_method_id）——

/** 读取默认卡 id；没有设置、或读取失败（如线上库还没加这一列）时返回 null，不影响其它功能 */
export async function getDefaultPaymentMethodId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('default_payment_method_id')
    .maybeSingle();

  if (error || !data?.default_payment_method_id) return null;
  return data.default_payment_method_id as string;
}

/** 设置 / 清除（传 null）默认卡 */
export async function saveDefaultPaymentMethodId(id: string | null): Promise<{ error?: unknown }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, default_payment_method_id: id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  return { error: error ?? undefined };
}
