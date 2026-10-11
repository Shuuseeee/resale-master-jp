// lib/api/arrivals.ts — 分批到货（对齐买取X「着荷」）
// 明细存 transaction_arrivals（一次到货一行）；数据库触发器把合计写进 transactions.quantity_arrived 并同步状态
// （到了 1 件以上 = 库存中，删光 = 未到货），出售数量由触发器限制在已到货以内。数量口径见 lib/utils/arrivals.ts。
// 兼容「代码先部署、库还没升级」：到货表不存在时，「全部到货」退回旧做法（只改状态）。
import { supabase } from '@/lib/supabase/client';
import { getTodayString } from '@/lib/utils/dateUtils';
import { arrivedQty, notArrivedQty } from '@/lib/utils/arrivals';
import type { TransactionArrival } from '@/types/database.types';

/** 扫码到货 / 到货管理要用到的交易字段 */
export interface ArrivalTransaction {
  id: string;
  product_name: string;
  jan_code: string | null;
  date: string;
  status: string;
  quantity: number;
  quantity_arrived?: number | null;
  quantity_sold?: number | null;
  quantity_returned?: number | null;
  unit_price: number | null;
  order_number: string | null;
  purchase_platforms: { name: string } | null;
  payment_methods: { name: string } | null;
}

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /transaction_arrivals/.test(error.message ?? ''));

export async function listArrivals(transactionId: string): Promise<TransactionArrival[]> {
  const { data, error } = await supabase
    .from('transaction_arrivals')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('arrived_date')
    .order('created_at');
  if (isMissingTable(error)) return [];
  if (error) throw error;
  return data ?? [];
}

export async function addArrival(
  transactionId: string,
  quantity: number,
  arrivedDate: string = getTodayString(),
  notes: string | null = null,
): Promise<TransactionArrival> {
  const { data, error } = await supabase
    .from('transaction_arrivals')
    .insert({ transaction_id: transactionId, quantity, arrived_date: arrivedDate, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArrivals(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('transaction_arrivals').delete().in('id', ids);
  if (error) throw error;
}

/**
 * 把还没到的件数一次记为到货（「全部到货」）。返回新建的明细（撤销用）；没有剩余时返回 null。
 * 到货表还不存在时退回旧做法：未到货 → 库存中。
 */
export async function markAllArrived(id: string): Promise<TransactionArrival | null> {
  const { data: tx, error } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (error) throw error;
  const remaining = notArrivedQty(tx);
  if (remaining <= 0) return null;
  try {
    return await addArrival(id, remaining);
  } catch (e) {
    if (!isMissingTable(e as { code?: string; message?: string })) throw e;
    const { error: upErr } = await supabase.from('transactions').update({ status: 'in_stock' }).eq('id', id).eq('status', 'pending');
    if (upErr) throw upErr;
    return null;
  }
}

/** 旧调用方用：全部到货，成功返回 true */
export async function markTransactionArrived(id: string): Promise<boolean> {
  try {
    await markAllArrived(id);
    return true;
  } catch (e) {
    console.error('标记到货失败:', e);
    return false;
  }
}

/** 改回未到货（数据库触发器会清掉到货明细）；已有出售的不能改 */
export async function resetToPending(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').update({ status: 'pending' }).eq('id', id).eq('status', 'in_stock').eq('quantity_sold', 0);
  if (error) throw error;
}

/**
 * 扫码到货：按 JAN 找还有未到件数的进货（未到货 + 只到了一部分），以及已全部到货的笔数。
 * select('*')：库还没加 quantity_arrived 列时也能读。
 */
export async function findArrivalCandidates(
  jan: string,
): Promise<{ open: ArrivalTransaction[]; arrivedCount: number; productName: string | null }> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, purchase_platforms!purchase_platform_id(name), payment_methods!card_id(name)')
    .eq('jan_code', jan)
    .in('status', ['pending', 'in_stock'])
    .order('date', { ascending: true })
    .order('id');
  if (error) throw error;
  const rows = (data ?? []) as ArrivalTransaction[];
  const open = rows.filter(t => notArrivedQty(t) > 0);
  return {
    open,
    arrivedCount: rows.filter(t => arrivedQty(t) >= t.quantity).length,
    productName: rows[rows.length - 1]?.product_name ?? null,
  };
}
