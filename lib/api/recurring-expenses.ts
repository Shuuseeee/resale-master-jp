// lib/api/recurring-expenses.ts — 定期经费（对齐买取X）
// 规则存 recurring_expenses；到期的那几笔由 RPC generate_recurring_expenses 补记进 supplies_costs（recurring_id 指回规则）。
// 补记在打开应用时由 components/RecurringExpensesRunner.tsx 调一次，新建规则后也立刻调一次。
import { supabase } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/api/fetchAll';
import type { RecurringExpense, RecurringFrequency } from '@/types/database.types';

export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 「每月 15 日」「每周三」「每年 4 月 1 日」：按开始日推出记账日 */
export function frequencyText(frequency: RecurringFrequency, startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number);
  if (frequency === 'weekly') return `每周${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
  if (frequency === 'monthly') return d >= 29 ? `每月 ${d} 日（短月记在月末）` : `每月 ${d} 日`;
  return `每年 ${m} 月 ${d} 日`;
}

export interface RecurringExpenseInput {
  category: string;
  amount: number;
  description: string | null;
  notes: string | null;
  frequency: RecurringFrequency;
  start_date: string;
  end_date: string | null;
}

/** 失败即抛错（库未升级时表不存在也会抛，由页面显示错误） */
export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  return fetchAllRows<RecurringExpense>((from, to, opts) =>
    supabase
      .from('recurring_expenses')
      .select('*', opts)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

export async function createRecurringExpense(input: RecurringExpenseInput): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').insert(input);
  if (error) throw error;
}

/** 开始日与周期决定已记笔数的对应关系，建好后不能改；其它字段只影响之后记入的经费 */
export async function updateRecurringExpense(
  id: string,
  patch: Partial<Pick<RecurringExpense, 'category' | 'amount' | 'description' | 'notes' | 'end_date' | 'active'>>,
): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id);
  if (error) throw error;
}

/** 删除规则；已记入的经费保留（外键 ON DELETE SET NULL） */
export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
  if (error) throw error;
}

/** 补记所有到期的定期经费，返回新记的笔数 */
export async function generateRecurringExpenses(): Promise<number> {
  const { data, error } = await supabase.rpc('generate_recurring_expenses');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
