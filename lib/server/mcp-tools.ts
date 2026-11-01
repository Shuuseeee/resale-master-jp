// lib/server/mcp-tools.ts — 自有 MCP（app/api/[transport]/route.ts）的三个工具的实现
// 数据：只读视图 assistant_overview / assistant_purchases / assistant_buyback_prices + 商品尺寸表 product_shipping_meta，
//      用 service role 读取、按令牌对应的用户过滤（令牌由本站 OAuth 服务器签发，见 lib/server/oauth.ts；工具全部只读）。
// 计算：出货方案与店铺规则交给 Vercel Python 函数 /api/solver（solver/service.py，规则与求解器来自原 ResaleAssist）。
/* eslint-disable @typescript-eslint/no-explicit-any -- 视图行按列名取值 */

import { serviceDb } from '@/lib/server/oauth';
import { normalizeStoreName } from '@/lib/kaitorix-config';
import { fetchAllByIds, fetchAllRows } from '@/lib/api/fetchAll';

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3600_000;

/** 报价是几天前（按日本时间的日历日：今天 = 0、昨天 = 1），与 kaitorixReferenceCutoff 同一口径 */
function jstDaysAgo(iso: string, now: number): number {
  const day = (t: number) => Math.floor((t + JST_OFFSET_MS) / DAY_MS);
  return Math.max(0, day(now) - day(Date.parse(iso)));
}

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
  /** 只用这些店的报价（网页「设置 > 买取价格检查」勾选的店，存在浏览器里；按规范店名比较）。不传 = 全部店 */
  onlyStores?: string[];
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
  opts: Pick<PlanOptions, 'excludeStores' | 'onlyStores' | 'staleLimit'> = {},
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

/** 用户在「设置 > 买取价格检查」勾选的店（user_preferences.buyback_stores，SQL 31）；没设置过 / 库没升级 = undefined（全部店） */
async function userBuybackStores(user: McpUser): Promise<string[] | undefined> {
  const { data, error } = await serviceDb().from('user_preferences').select('buyback_stores').eq('user_id', user.userId).maybeSingle();
  if (error || !Array.isArray(data?.buyback_stores)) return undefined;
  return data.buyback_stores as string[];
}

/** 共同部分：查尺寸与报价 → 组装求解器输入 → 调 /api/solver。rows 需带 shippable（本次出货件数） */
async function planFromRows(user: McpUser, purchases: any[], opts: Pick<PlanOptions, 'excludeStores' | 'onlyStores' | 'staleLimit'>) {
  const sb = serviceDb();
  // 只用勾选的店：网页请求带了就用它（浏览器里的副本），否则读账号里存的（MCP）
  const onlyStores = opts.onlyStores ?? await userBuybackStores(user);
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
  // 与网页比价 / 仪表盘同一口径：没勾选的店的报价不参与（filterPricesByStores 也是按规范店名白名单）
  const only = onlyStores ? new Set(onlyStores.map(normalizeStoreName)) : null;
  for (const p of priceRows) {
    if (only && !only.has(normalizeStoreName(p.store))) continue;
    const age = p.price_updated_at ? jstDaysAgo(p.price_updated_at, now) : 0;
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
    // 默认 1 = 只用今天、昨天更新的报价（与网页 / 视图 is_stale 一致）
    stale_limit: opts.staleLimit ?? 1,
    day: todayJst(),
  });
  if (result?.ok && Array.isArray(result.boxes)) await attachStoreLinks(result.boxes, jans);
  return { ...result, missing_meta: missingMeta };
}

/**
 * 人工实测过的店铺地址，优先于买取X 给的地址（买取X 的数据有过时的：携帯空間 它记的是旧域名 keitai-space.jp、没有搜索）。
 * search 里的 {jan} 换成 JAN。发现别的店链接不对时加在这里。
 */
const STORE_LINK_OVERRIDES: Record<string, { home: string; search?: string }> = {
  // 2026-10-13 用户实测
  携帯空間: { home: 'https://www.keitaispace.co.jp/', search: 'https://www.keitaispace.co.jp/product/?kw={jan}#list' },
};

/**
 * 给方案里的每家店 / 每件商品挂上链接：店名 → 店铺首页，商品 → 该店的 JAN 搜索页。
 * 地址来自官方 API 价格缓存里每条报价的 url（买取X 给的：能搜的店是「站内搜索 + JAN」，不能搜的是首页；每日 CSV 不带地址）。
 * 某个 JAN 没有该店的地址时，用同一家店别的 JAN（本次或最近 300 条缓存）的搜索地址换掉 JAN 作模板；再没有就退回首页。
 */
async function attachStoreLinks(boxes: any[], jans: string[]) {
  const sb = serviceDb();
  // 本次的 JAN（逐件地址）+ 最近的缓存（学各店的搜索模板与首页；价格缓存是公共数据，不分用户）
  const [{ data: own }, { data: recent }] = await Promise.all([
    sb.from('kaitorix_price_cache').select('jan, prices').in('jan', jans.slice(0, 200)),
    sb.from('kaitorix_price_cache').select('jan, prices').order('fetched_at', { ascending: false }).limit(300),
  ]);
  const direct = new Map<string, string>();
  const template = new Map<string, string>();
  const home = new Map<string, string>();
  for (const row of [...(own ?? []), ...(recent ?? [])]) {
    for (const p of Array.isArray(row.prices) ? row.prices : []) {
      const url = typeof p?.url === 'string' ? p.url : '';
      if (!p?.store || !/^https?:\/\//.test(url)) continue;
      direct.set(`${row.jan}\u0001${p.store}`, url);
      if (url.includes(row.jan) && !template.has(p.store)) template.set(p.store, url.split(row.jan).join('{jan}'));
      if (!home.has(p.store)) {
        try {
          home.set(p.store, new URL(url).origin + '/');
        } catch {
          // 地址格式不对就不给首页链接
        }
      }
    }
  }
  for (const box of boxes) {
    const override = STORE_LINK_OVERRIDES[box.store];
    box.store_url = override?.home ?? home.get(box.store) ?? null;
    for (const it of box.items ?? []) {
      const jan = encodeURIComponent(it.jan);
      it.url = override
        ? override.search?.split('{jan}').join(jan) ?? override.home
        : direct.get(`${it.jan}\u0001${box.store}`) ?? template.get(box.store)?.split('{jan}').join(jan) ?? box.store_url;
    }
  }
}

export interface SearchOptions {
  jans?: string[];
  keyword?: string;
  status?: ('pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned')[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '未到货',
  in_stock: '库存中',
  awaiting_payment: '待入账',
  sold: '已售出',
  returned: '已退货',
};

/**
 * 查交易明细（含已售）：每笔进货的成本、积分、到货、状态、确定利润，以及每次出售（日期 / 渠道 / 单价 / 扣除 / 利润）、
 * 退货（日期 / 退款 / 损失）、当前最高买取价。取代网页上「复制 AI 分析数据」的用途（AI 直接查，不用复制粘贴）。
 */
export async function searchTransactions(user: McpUser, opts: SearchOptions) {
  const sb = serviceDb();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  let q = sb
    .from('transactions')
    .select(
      'id, date, product_name, jan_code, order_number, status, quantity, quantity_arrived, quantity_sold, quantity_returned, quantity_in_stock, unit_price, shipping_fee, coupon_amount, purchase_price_total, point_paid, expected_platform_points, expected_card_points, extra_platform_points, total_profit, roi, notes, purchase_platform:purchase_platforms(name), payment_method:payment_methods(name)',
    )
    .eq('user_id', user.userId)
    .order('date', { ascending: false })
    .order('id')
    .limit(limit);
  if (opts.jans?.length) q = q.in('jan_code', opts.jans.slice(0, 100));
  if (opts.keyword?.trim()) q = q.ilike('product_name', `%${opts.keyword.trim().replace(/[%_]/g, '')}%`);
  if (opts.status?.length) q = q.in('status', opts.status);
  if (opts.dateFrom) q = q.gte('date', opts.dateFrom);
  if (opts.dateTo) q = q.lte('date', opts.dateTo);
  const { data: txs, error } = await q;
  if (error) throw error;
  if (!txs?.length) return { count: 0, transactions: [] };

  const ids = txs.map(t => t.id);
  const jans = [...new Set(txs.map(t => t.jan_code).filter((j): j is string => !!j))];
  const [{ data: sales }, { data: returns }, { data: best }] = await Promise.all([
    sb
      .from('sales_records')
      .select('transaction_id, sale_date, quantity_sold, selling_price_per_unit, platform_fee, shipping_fee, total_profit, sale_order_number, notes, selling_platform:selling_platforms(name)')
      .eq('user_id', user.userId)
      .in('transaction_id', ids)
      .order('sale_date'),
    sb
      .from('return_records')
      .select('transaction_id, return_date, quantity_returned, return_amount, loss_amount, notes')
      .eq('user_id', user.userId)
      .in('transaction_id', ids)
      .order('return_date'),
    jans.length
      ? sb.from('assistant_purchases').select('id, best_price, best_stores, best_price_updated_at, estimated_profit').eq('user_id', user.userId).in('id', ids)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const bestById = new Map((best ?? []).map((b: any) => [b.id, b]));
  const num = (v: unknown) => (v == null ? null : Number(v));

  return {
    count: txs.length,
    truncated: txs.length === limit,
    transactions: txs.map((t: any) => {
      const b: any = bestById.get(t.id);
      return {
        date: t.date,
        product_name: t.product_name,
        jan: t.jan_code,
        order_number: t.order_number,
        status: STATUS_LABEL[t.status] ?? t.status,
        purchase_source: t.purchase_platform?.name ?? null,
        payment_method: t.payment_method?.name ?? null,
        quantity: t.quantity,
        quantity_arrived: t.quantity_arrived ?? (t.status === 'pending' ? 0 : t.quantity),
        quantity_sold: t.quantity_sold,
        quantity_returned: t.quantity_returned,
        quantity_unsold: t.quantity_in_stock,
        unit_price: num(t.unit_price),
        shipping_fee: num(t.shipping_fee),
        coupon_amount: num(t.coupon_amount),
        purchase_price_total: num(t.purchase_price_total),
        points_used: num(t.point_paid),
        points_earned: (Number(t.expected_platform_points) || 0) + (Number(t.expected_card_points) || 0) + (Number(t.extra_platform_points) || 0),
        confirmed_profit: num(t.total_profit),
        profit_rate: num(t.roi),
        notes: t.notes,
        sales: (sales ?? [])
          .filter((s: any) => s.transaction_id === t.id)
          .map((s: any) => ({
            date: s.sale_date,
            channel: s.selling_platform?.name ?? null,
            qty: s.quantity_sold,
            unit_price: num(s.selling_price_per_unit),
            deduction: (Number(s.platform_fee) || 0) + (Number(s.shipping_fee) || 0),
            profit: num(s.total_profit),
            order_number: s.sale_order_number,
            notes: s.notes,
          })),
        returns: (returns ?? [])
          .filter((r: any) => r.transaction_id === t.id)
          .map((r: any) => ({ date: r.return_date, qty: r.quantity_returned, refund: num(r.return_amount), loss: num(r.loss_amount), notes: r.notes })),
        best_buyback: b?.best_price != null ? { price: Number(b.best_price), stores: b.best_stores, updated_at: b.best_price_updated_at, estimated_profit: num(b.estimated_profit) } : null,
      };
    }),
  };
}
