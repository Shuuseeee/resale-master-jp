// lib/api/financial.ts
// 财务数据 API 函数
//
// 入账记在每次出售上（sales_records.payment_received，SQL 29，照买取X）。交易状态由数据库触发器跟着变：
// 全部卖完且每次出售都已入账 → 已售出。库还没升级（没有这一列）时退回旧做法：只把「待入账」交易改成已售出。

import { supabase } from '@/lib/supabase/client';

const CHUNK = 100; // .in() 拼进地址，几百个 UUID 会超过网关上限

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

function isMissingPaymentCol(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || /payment_received/.test(error.message ?? ''));
}

/**
 * 确认入账：这些交易名下所有还没入账的出售标为已入账（部分售出的也可以），
 * 再把仍是「待入账」的（没有出售记录的老数据 / 库没升级）改成已售出。
 * 返回确认了的交易 id（有出售被标记或状态被改的）。出错时抛出。
 */
async function confirmTransactions(ids: string[]): Promise<Set<string>> {
  const confirmed = new Set<string>();
  for (const part of chunks(ids)) {
    const { data, error } = await supabase
      .from('sales_records')
      .update({ payment_received: true })
      .in('transaction_id', part)
      .eq('payment_received', false)
      .select('transaction_id');
    if (error && !isMissingPaymentCol(error)) throw error;
    (data ?? []).forEach(r => confirmed.add(r.transaction_id));

    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .update({ status: 'sold' })
      .in('id', part)
      .eq('status', 'awaiting_payment')
      .select('id');
    if (txError) throw txError;
    (txs ?? []).forEach(t => confirmed.add(t.id));
  }
  return confirmed;
}

/**
 * 确认一笔交易的入账
 */
export async function confirmPaymentReceived(id: string): Promise<boolean> {
  try {
    await confirmTransactions([id]);
    return true;
  } catch (error) {
    console.error('入金確認失敗:', error);
    return false;
  }
}

/**
 * 批量确认入账，返回实际确认和跳过的数量，保证幂等
 */
export async function confirmBatchPaymentReceived(ids: string[]): Promise<{ confirmed: number; skipped: number }> {
  try {
    const confirmed = (await confirmTransactions(ids)).size;
    return { confirmed, skipped: ids.length - confirmed };
  } catch (error) {
    console.error('批量入金确认失败:', error);
    return { confirmed: 0, skipped: ids.length };
  }
}

/**
 * 按出售确认入账（待入账「按订单」对账：只标这个订单里的出售）。
 * 库还没升级时退回按交易确认（fallbackTransactionIds）。
 */
export async function confirmSalesPaymentReceived(
  saleIds: string[],
  fallbackTransactionIds: string[],
): Promise<{ ok: boolean; legacy: boolean }> {
  try {
    for (const part of chunks(saleIds)) {
      const { error } = await supabase
        .from('sales_records')
        .update({ payment_received: true })
        .in('id', part)
        .eq('payment_received', false);
      if (error) {
        if (isMissingPaymentCol(error)) {
          await confirmTransactions(fallbackTransactionIds);
          return { ok: true, legacy: true };
        }
        throw error;
      }
    }
    return { ok: true, legacy: false };
  } catch (error) {
    console.error('按订单入金确认失败:', error);
    return { ok: false, legacy: false };
  }
}

/**
 * 单次出售改回「未入账」（误点时撤销）。交易若已是已售出，触发器会把它退回待入账。
 */
export async function setSalePaymentReceived(saleId: string, received: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('sales_records')
    .update({ payment_received: received })
    .eq('id', saleId);
  if (error) {
    console.error('入账状态更新失败:', error);
    return false;
  }
  return true;
}
