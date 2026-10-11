// lib/utils/arrivals.ts — 分批到货的数量口径（与数据库 check_sale_within_arrived / assistant_purchases 一致）
// 已到货 = quantity_arrived；没有到货明细（NULL：老数据、原生 App 标记的到货）时按状态推断：未到货 = 0，其余 = 全部到齐。
// 可出售 = 已到货 − 已售 − 已退货（只能卖已到货的，对齐买取X）。

interface ArrivalFields {
  status: string;
  quantity: number;
  quantity_arrived?: number | null;
  quantity_sold?: number | null;
  quantity_returned?: number | null;
}

export function arrivedQty(t: ArrivalFields): number {
  return t.quantity_arrived ?? (t.status === 'pending' ? 0 : t.quantity);
}

export function sellableQty(t: ArrivalFields): number {
  return Math.max(0, arrivedQty(t) - (t.quantity_sold ?? 0) - (t.quantity_returned ?? 0));
}

/** 还没到的件数 */
export function notArrivedQty(t: ArrivalFields): number {
  return Math.max(0, t.quantity - arrivedQty(t));
}

/** 已到一部分（显示「到货 3/5」） */
export function isPartiallyArrived(t: ArrivalFields): boolean {
  const n = arrivedQty(t);
  return n > 0 && n < t.quantity;
}
