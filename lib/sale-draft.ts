// lib/sale-draft.ts — 记住上一次出售的「出售对象 / 订单号 / 日期」5 分钟（照买取X 出售表单的 om_last_sale）
// 连续把同一张出售订单里的几件商品一件件记进去时，不用每次重选店、重填订单号。
// 和买取X 不同：单价 / 数量 / 手续费 / 备注不带（那是上一件商品的，带到下一件容易记错价；单价由所选店的报价带出）。
// 存在浏览器 localStorage（每台设备各自记）。

const KEY = 'lastSaleDraft';
const TTL_MS = 5 * 60 * 1000;

export interface LastSale {
  selling_platform_id: string;
  sale_order_number: string;
  sale_date: string;
}

export function loadLastSale(): LastSale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastSale & { ts?: number };
    if (!v.ts || Date.now() - v.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { selling_platform_id: v.selling_platform_id || '', sale_order_number: v.sale_order_number || '', sale_date: v.sale_date || '' };
  } catch {
    return null;
  }
}

export function saveLastSale(sale: LastSale): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...sale, ts: Date.now() }));
  } catch {
    // 存不了只是下次不预填
  }
}
