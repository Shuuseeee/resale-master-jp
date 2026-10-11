// lib/server/mcp-tools.ts — 自有 MCP（app/api/[transport]/route.ts）的三个工具的实现
// 数据：只读视图 assistant_overview / assistant_purchases / assistant_buyback_prices + 商品尺寸表 product_shipping_meta，
//      用 service role 读取、按令牌对应的用户过滤（令牌由本站 OAuth 服务器签发，见 lib/server/oauth.ts；工具全部只读）。
// 计算：出货方案与店铺规则交给 Vercel Python 函数 /api/solver（solver/service.py，规则与求解器来自原 ResaleAssist）。
/* eslint-disable @typescript-eslint/no-explicit-any -- 视图行按列名取值 */

import { serviceDb } from '@/lib/server/oauth';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';

const DAY_MS = 86_400_000;

/** MCP 请求的登录身份（app/api/mcp 校验 Bearer 令牌后传入） */
export interface McpUser {
  userId: string;
}

// service role 能看到所有用户：下面每个查询都必须带 .eq('user_id', user.userId)
// （assistant_buyback_prices 是公共买取价，没有 user_id）

/** JST 今天（YYYY-MM-DD） */
function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function solverUrl(): string {
  if (process.env.SOLVER_URL) return process.env.SOLVER_URL;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}/api/solver` : 'http://localhost:3000/api/solver';
}

async function callSolver(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(solverUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-solver-secret': process.env.SOLVER_SECRET ?? '' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`求解服务返回异常（HTTP ${res.status}）：${text.slice(0, 200)}`);
  }
}

async function unsoldPurchases(user: McpUser, includePending: boolean): Promise<any[]> {
  const sb = serviceDb();
  const rows = await fetchAllRows<any>((from, to, opts) =>
    sb
      .from('assistant_purchases')
      .select('*', opts)
      .eq('user_id', user.userId)
      .gt('quantity_unsold', 0)
      .order('purchase_date')
      .order('id')
      .range(from, to),
  );
  // 可出货件数：只算已到货未售（分批到货，视图列 quantity_arrived_unsold；库没升级时按状态）；include_pending 时含未到的
  return rows
    .filter(r => r.status === 'in_stock' || r.status === 'pending')
    .map(r => ({
      ...r,
      shippable: includePending
        ? r.quantity_unsold
        : (r.quantity_arrived_unsold ?? (r.status === 'in_stock' ? r.quantity_unsold : 0)),
    }))
    .filter(r => r.shippable > 0);
}

/** 库存与利润概况：整体汇总 + 每笔未售进货（与网页 / 买取X 同口径） */
export async function inventoryOverview(user: McpUser, includeItems: boolean) {
  const sb = serviceDb();
  const { data: overview, error } = await sb.from('assistant_overview').select('*').eq('user_id', user.userId).maybeSingle();
  if (error) throw error;
  const result: Record<string, unknown> = { as_of: todayJst(), overview };
  if (includeItems) {
    result.unsold = (await unsoldPurchases(user, true)).map(r => ({
      purchase_date: r.purchase_date,
      product_name: r.product_name,
      jan: r.jan_code,
      status: r.status_label,
      qty_unsold: r.quantity_unsold,
      qty_arrived_unsold: r.quantity_arrived_unsold ?? (r.status === 'in_stock' ? r.quantity_unsold : 0),
      unit_cost: Number(r.unit_cost),
      best_price: r.best_price == null ? null : Number(r.best_price),
      best_stores: r.best_stores,
      best_price_updated_at: r.best_price_updated_at,
      estimated_profit: r.estimated_profit == null ? null : Number(r.estimated_profit),
      days_held: r.days_held,
    }));
  }
  return result;
}

export async function storeRules() {
  return callSolver({ action: 'rules', day: todayJst() });
}

interface PlanOptions {
  excludeStores?: string[];
  keepJans?: string[];
  includePending?: boolean;
  staleLimit?: number;
}

/** 出货方案：未售库存 × 各店报价 × 商品尺寸 → 全局最优分配（含运费、包邮条件、自检） */
export async function planShipment(user: McpUser, opts: PlanOptions) {
  const keep = new Set(opts.keepJans ?? []);
  const unsold = await unsoldPurchases(user, !!opts.includePending);
  const purchases = unsold.filter(r => r.jan_code && !keep.has(r.jan_code));
  const noJan = unsold.filter(r => !r.jan_code).map(r => r.product_name);
  if (!purchases.length) return { ok: false, error: '没有可分销的未售库存（需要有 JAN）', no_jan: noJan };
  const result = await planFromRows(user, purchases, opts);
  return { ...result, kept_jans: [...keep], no_jan: noJan };
}

/**
 * 网页比价弹层用：只对选中的进货、按给定数量排方案（数量不超过未售数）。
 * selections 来自前端，一律按 user_id 重新查视图，不信任前端传来的成本 / 价格。
 */
export async function planShipmentForSelection(
  user: McpUser,
  selections: { transactionId: string; qty: number }[],
  opts: Pick<PlanOptions, 'excludeStores' | 'staleLimit'> = {},
) {
  const sb = serviceDb();
  const ids = [...new Set(selections.map(s => s.transactionId))];
  if (!ids.length) return { ok: false, error: '没有选中商品' };
  const rows = await fetchAllByIds<any>(ids, (chunk, from, to, o) =>
    sb.from('assistant_purchases').select('*', o).eq('user_id', user.userId).in('id', chunk).order('id').range(from, to),
  );
  const qtyById = new Map(selections.map(s => [s.transactionId, Math.max(0, Math.floor(s.qty))]));
  const picked = rows
    .map(r => ({ ...r, shippable: Math.min(Number(r.quantity_unsold) || 0, qtyById.get(r.id) ?? 0) }))
    .filter(r => r.shippable > 0);
  const noJan = picked.filter(r => !r.jan_code).map(r => r.product_name);
  const withJan = picked.filter(r => r.jan_code);
  if (!withJan.length) return { ok: false, error: '选中的商品没有可出货的数量（需要有 JAN）', no_jan: noJan };
  const result = await planFromRows(user, withJan, opts);
  return { ...result, no_jan: noJan };
}

/** 共同部分：查尺寸与报价 → 组装求解器输入 → 调 /api/solver。rows 需带 shippable（本次出货件数） */
async function planFromRows(user: McpUser, purchases: any[], opts: Pick<PlanOptions, 'excludeStores' | 'staleLimit'>) {
  const sb = serviceDb();
  const jans = [...new Set(purchases.map(r => r.jan_code as string))];
  const [metaRows, priceRows] = await Promise.all([
    fetchAllByIds<any>(jans, (chunk, from, to, o) =>
      sb.from('product_shipping_meta').select('jan, vol, min_size, category', o).eq('user_id', user.userId).in('jan', chunk).order('jan').range(from, to),
    ),
    fetchAllByIds<any>(jans, (chunk, from, to, o) =>
      sb.from('assistant_buyback_prices').select('jan, store, price, price_updated_at', o).in('jan', chunk).order('jan').order('store').range(from, to),
    ),
  ]);
  const meta = new Map(metaRows.map(m => [m.jan, m]));
  const now = Date.now();
  const prices = new Map<string, Record<string, [number, number]>>();
  for (const p of priceRows) {
    const age = p.price_updated_at ? Math.max(0, Math.floor((now - Date.parse(p.price_updated_at)) / DAY_MS)) : 0;
    const m = prices.get(p.jan) ?? prices.set(p.jan, {}).get(p.jan)!;
    m[p.store] = [Number(p.price), age];
  }

  const missingMeta: { jan: string; product_name: string }[] = [];
  const items = [];
  for (const r of purchases) {
    const m = meta.get(r.jan_code);
    if (!m) {
      if (!missingMeta.some(x => x.jan === r.jan_code)) missingMeta.push({ jan: r.jan_code, product_name: r.product_name });
      continue;
    }
    items.push({
      tid: r.id,
      name: r.product_name,
      jan: r.jan_code,
      qty: r.shippable,
      qty_full: r.quantity,
      qty_sold: r.quantity_sold,
      total: Number(r.purchase_price_total),
      cp: Number(r.points_total),
      pp: 0,
      ex: 0,
      vol: Number(m.vol),
      mint: m.min_size,
      cat: m.category,
      prices: prices.get(r.jan_code) ?? {},
    });
  }
  if (!items.length) return { ok: false, error: '商品都缺少尺寸数据（体积 / 最小箱型），无法排方案', missing_meta: missingMeta };

  const result = await callSolver({
    action: 'plan',
    items,
    exclude_stores: opts.excludeStores ?? [],
    stale_limit: opts.staleLimit ?? 7,
    day: todayJst(),
  });
  return { ...result, missing_meta: missingMeta };
}
