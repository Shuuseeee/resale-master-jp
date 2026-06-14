// lib/api/sale-orders.ts
// 销售订单 API（多件商品作为同一订单售出）

import { supabase } from '@/lib/supabase/client';
import { computeSaleProfit, updateTransactionROI } from '@/lib/api/sales-records';
import type { SaleMathTxBasis } from '@/lib/api/sales-records';

export interface SaleOrderSharedInput {
  sale_date: string;
  selling_platform_id?: string | null;
  sale_order_number?: string | null;
  notes?: string | null;
}

export interface SaleOrderItemInput {
  transaction_id: string;
  /** 对应 transaction 的 quantity_in_stock（用于服务端校验） */
  quantity_in_stock: number;
  quantity_sold: number;
  selling_price_per_unit: number;
  platform_fee: number;
  shipping_fee: number;
  /** 利润计算基线，从已加载的 transaction 传入 */
  basis: SaleMathTxBasis;
}

/**
 * 创建销售订单，将多件商品作为同一订单售出
 *
 * 原子策略：
 *   1. 先建订单 sale_orders
 *   2. 单次批量 INSERT sales_records（一条 SQL = 单事务）
 *   3. 失败时补偿删除订单（此时无成员，删得干净）
 *   4. 成功后逐 transaction updateTransactionROI
 */
export async function createSaleOrder(
  shared: SaleOrderSharedInput,
  items: SaleOrderItemInput[]
): Promise<{ orderId: string | null; insertedTxIds: string[]; error: any }> {
  // ── 1. 登录态 ──
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orderId: null, insertedTxIds: [], error: { message: '未登录' } };
  }

  // ── 2. 前端已校验，API 再做硬校验 ──
  if (items.length === 0) {
    return { orderId: null, insertedTxIds: [], error: { message: '至少需要选择一件商品' } };
  }
  for (const item of items) {
    if (item.quantity_sold <= 0) {
      return { orderId: null, insertedTxIds: [], error: { message: '销售数量必须大于 0' } };
    }
    if (item.quantity_sold > item.quantity_in_stock) {
      return { orderId: null, insertedTxIds: [], error: { message: '销售数量不能超过库存数量' } };
    }
    if (item.selling_price_per_unit <= 0) {
      return { orderId: null, insertedTxIds: [], error: { message: '单价必须大于 0' } };
    }
  }

  // ── 3. 建订单（user_id 由 set_user_id 触发器填充） ──
  const { data: orderRow, error: orderError } = await supabase
    .from('sale_orders')
    .insert({
      sale_date: shared.sale_date,
      selling_platform_id: shared.selling_platform_id || null,
      sale_order_number: shared.sale_order_number || null,
      notes: shared.notes || null,
    })
    .select('id')
    .single();

  if (orderError || !orderRow) {
    console.error('创建订单失败:', orderError);
    return { orderId: null, insertedTxIds: [], error: orderError };
  }

  const orderId = orderRow.id;

  // ── 4. 构造批量 sales_records rows ──
  const rows = items.map(item => {
    const { cash_profit, total_profit, roi, actual_cash_spent } = computeSaleProfit(item, item.basis);
    return {
      transaction_id: item.transaction_id,
      user_id: user.id,
      sale_group_id: orderId,
      quantity_sold: item.quantity_sold,
      selling_price_per_unit: item.selling_price_per_unit,
      platform_fee: item.platform_fee,
      shipping_fee: item.shipping_fee,
      sale_date: shared.sale_date,
      selling_platform_id: shared.selling_platform_id || null,
      sale_order_number: shared.sale_order_number || null,
      notes: shared.notes || null,
      cash_profit,
      total_profit,
      roi,
      actual_cash_spent,
    };
  });

  // ── 5. 单次批量 INSERT（单事务：要么整批成功要么整批失败） ──
  const { error: insertError } = await supabase
    .from('sales_records')
    .insert(rows);

  if (insertError) {
    console.error('批量插入销售记录失败:', insertError);
    // 补偿删除订单（成员未插入，删得干净）
    await supabase.from('sale_orders').delete().eq('id', orderId);
    return { orderId: null, insertedTxIds: [], error: insertError };
  }

  // ── 6. 逐 transaction 更新聚合 ROI ──
  const uniqueTxIds = [...new Set(items.map(i => i.transaction_id))];
  await Promise.all(uniqueTxIds.map(txId => updateTransactionROI(txId)));

  return { orderId, insertedTxIds: uniqueTxIds, error: null };
}
