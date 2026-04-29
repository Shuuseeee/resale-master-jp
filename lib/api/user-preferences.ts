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
