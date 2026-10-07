// lib/server/kaitorix-official.ts
// Kaitorix 官方 Open API（https://kaitorix.app/open/docs）的服务端调用：
// 每日配额记录、按 JAN 拉价并写入 kaitorix_price_cache。仅供 app/api 路由使用。
//
// 限制（来自官方文档）：每日次数以响应头 X-RateLimit-* 为准（JST 0:00 重置）；
// 另有每秒 1 次请求（TPS=1），超出同样返回 429——与「当日额度用完」的 429 要区分。

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getPriceUpdatedAt } from '@/lib/kaitorix-domain';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const KAITORIX_OPEN_API_KEY = process.env.KAITORIX_OPEN_API_KEY;

/** 尚无任何响应头可参考时的日额度兜底（Premium 为 500）；之后一律以响应头为准 */
export const DEFAULT_DAILY_LIMIT = Number(process.env.KAITORIX_OPEN_API_DAILY_LIMIT || 500);

/** 自动刷新（进入页面触发）剩余额度不超过该值时停止，给手动强刷留余量 */
export const AUTO_REFRESH_RESERVE = 20;

export const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function getAuthedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export interface OfficialPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
  updated_at?: string;
}

interface OpenApiProductResponse {
  jan?: string;
  asin?: string;
  name?: string;
  max_price?: number;
  prices?: unknown;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number | null;
  reset: string | null;
}

export interface OfficialProduct {
  jan: string;
  name: string;
  max_price: number;
  max_store: string;
  prices: OfficialPrice[];
  fetchedAt: string;
}

export type OfficialRefreshResult =
  | { ok: true; product: OfficialProduct; rateLimit: RateLimitInfo }
  | {
      ok: false;
      status: number;
      error: string;
      rateLimit?: RateLimitInfo;
      /** 每秒 1 次的限速触发（非额度用完）：稍后重试即可 */
      tpsLimited?: boolean;
      /** 本次未发起官方请求（额度保留线 / 未配置 Key） */
      skipped?: boolean;
    };

export function getJstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const limit = Number(headers.get('X-RateLimit-Limit') || DEFAULT_DAILY_LIMIT);
  const remainingRaw = headers.get('X-RateLimit-Remaining');
  const resetRaw = headers.get('X-RateLimit-Reset');
  const resetSeconds = resetRaw ? Number(resetRaw) : null;

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT,
    remaining: remainingRaw !== null && Number.isFinite(Number(remainingRaw)) ? Number(remainingRaw) : null,
    reset: resetSeconds && Number.isFinite(resetSeconds) ? new Date(resetSeconds * 1000).toISOString() : null,
  };
}

async function getTodayUsage() {
  const usageDate = getJstDateKey();
  const { data } = await serviceSupabase
    .from('kaitorix_open_api_usage')
    .select('*')
    .eq('usage_date', usageDate)
    .maybeSingle();

  return { usageDate, usage: data };
}

async function recordUsage(
  usageDate: string,
  status: number,
  rateLimit: RateLimitInfo,
  errorMessage?: string,
) {
  const inferredUsed = rateLimit.remaining === null ? null : Math.max(0, rateLimit.limit - rateLimit.remaining);
  const payload = {
    usage_date: usageDate,
    used_count: inferredUsed ?? 1,
    last_limit: rateLimit.limit,
    last_remaining: rateLimit.remaining,
    last_reset_at: rateLimit.reset,
    last_status: status,
    last_error: errorMessage ?? null,
  };

  if (inferredUsed !== null) {
    await serviceSupabase
      .from('kaitorix_open_api_usage')
      .upsert(payload, { onConflict: 'usage_date' });
    return;
  }

  const { usage } = await getTodayUsage();
  await serviceSupabase
    .from('kaitorix_open_api_usage')
    .upsert(
      { ...payload, used_count: (usage?.used_count ?? 0) + 1 },
      { onConflict: 'usage_date' },
    );
}

/**
 * 规范化店铺报价：
 * - 店铺标记 stopped（停止买取）的报价不收录，否则会抬高最高价；
 * - 相对时间（"52分前"）按抓取时刻换算成精确的 updated_at 一并保存，之后 7 天参考规则不再依赖相对文本。
 */
function normalizePrices(prices: unknown, fetchedAtMs: number): OfficialPrice[] {
  if (!Array.isArray(prices)) return [];
  const out: OfficialPrice[] = [];
  for (const raw of prices) {
    const item = raw as { store?: unknown; price?: unknown; url?: unknown; updated?: unknown; stopped?: unknown };
    const price = Number(item.price);
    if (!item.store || !Number.isFinite(price) || item.stopped === true) continue;
    const updated = item.updated ? String(item.updated) : '';
    const updatedAtMs = getPriceUpdatedAt({ updated }, fetchedAtMs, fetchedAtMs);
    out.push({
      store: String(item.store),
      price,
      url: item.url ? String(item.url) : '',
      updated,
      ...(updatedAtMs != null ? { updated_at: new Date(updatedAtMs).toISOString() } : {}),
    });
  }
  return out;
}

function normalizeApiKey(apiKey: string | undefined): string {
  return (apiKey || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bearer\s+/i, '')
    .trim();
}

function buildProductUrl(jan: string, apiKey?: string): string {
  const url = new URL(`https://kaitorix.app/open/api/product/${encodeURIComponent(jan)}`);
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

async function readUpstreamError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    return json?.error || json?.message || '';
  }
  return response.text().catch(() => '');
}

/** 查不到 / 无价格的 JAN 记一条空缓存行（仅在没有任何行时），避免每次进页面都重复消耗额度 */
async function recordMissingProduct(jan: string) {
  await serviceSupabase
    .from('kaitorix_price_cache')
    .upsert(
      {
        jan,
        max_price: 0,
        max_store: '',
        prices: [],
        fetched_at: new Date().toISOString(),
        last_fetch_source: 'official',
      },
      { onConflict: 'jan', ignoreDuplicates: true },
    );
}

/**
 * 调官方 Open API 取一个 JAN 的最新买取价并写入 kaitorix_price_cache。
 * @param reserve 剩余额度（来自上一次响应头）不超过该值时不发请求；手动强刷传 0，由官方判定是否超额。
 */
export async function refreshFromOfficial(
  jan: string,
  { reserve = 0 }: { reserve?: number } = {},
): Promise<OfficialRefreshResult> {
  const apiKey = normalizeApiKey(KAITORIX_OPEN_API_KEY);
  if (!apiKey) {
    return { ok: false, status: 500, error: '未配置 Kaitorix Open API Key', skipped: true };
  }

  const { usageDate, usage } = await getTodayUsage();
  const knownLimit = usage?.last_limit ?? DEFAULT_DAILY_LIMIT;
  const knownRemaining = usage?.last_remaining;
  if (reserve > 0 && knownRemaining !== null && knownRemaining !== undefined && knownRemaining <= reserve) {
    return {
      ok: false,
      status: 429,
      error: 'Kaitorix 官方 API 今日自动刷新额度已留作手动强刷',
      rateLimit: { limit: knownLimit, remaining: knownRemaining, reset: usage?.last_reset_at ?? null },
      skipped: true,
    };
  }

  let response: Response;
  try {
    response = await fetch(buildProductUrl(jan), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    // 文档同时允许 ?key=：个别代理路径对 Authorization 头处理不同，鉴权失败时用查询参数重试一次
    if (response.status === 401 || response.status === 403) {
      response = await fetch(buildProductUrl(jan, apiKey), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch {
    return { ok: false, status: 502, error: '无法连接 Kaitorix 官方 API，请检查本地/部署环境网络' };
  }

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (response.status === 429) {
    // 日额度用完时响应头 remaining 为 0；否则视为每秒 1 次的限速，不能把当天记成「已用完」
    if (rateLimit.remaining === 0) {
      await recordUsage(usageDate, response.status, rateLimit, 'rate limited');
      return { ok: false, status: 429, error: 'Kaitorix 官方 API 今日配额已用完', rateLimit };
    }
    return { ok: false, status: 429, error: 'Kaitorix 官方 API 请求过于频繁，请稍后重试', tpsLimited: true };
  }

  if (response.status === 404) {
    await recordUsage(usageDate, response.status, rateLimit, 'not found');
    await recordMissingProduct(jan);
    return { ok: false, status: 404, error: 'Kaitorix 未找到该商品', rateLimit };
  }

  if (response.status === 401 || response.status === 403) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || `status ${response.status}`);
    return { ok: false, status: 401, error: 'Kaitorix Open API Key 无效或无权限', rateLimit };
  }

  if (response.status === 400) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || 'bad request');
    return { ok: false, status: 400, error: upstreamError || 'Kaitorix 官方 API 参数错误', rateLimit };
  }

  if (!response.ok) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || `status ${response.status}`);
    return {
      ok: false,
      status: response.status >= 500 ? 502 : response.status,
      error: upstreamError || `Kaitorix 官方 API 暂时不可用 (${response.status})`,
      rateLimit,
    };
  }

  const data = await response.json().catch(() => null) as OpenApiProductResponse | null;
  const fetchedAtMs = Date.now();
  const prices = normalizePrices(data?.prices, fetchedAtMs);
  if (!data || prices.length === 0) {
    await recordUsage(usageDate, response.status, rateLimit, 'empty prices');
    await recordMissingProduct(jan);
    return { ok: false, status: 422, error: 'Kaitorix 官方 API 未返回价格数据', rateLimit };
  }

  // 最高价基于收录后的报价重算（官方 max_price 可能含已停止买取的店铺）
  const best = prices.reduce((max, current) => current.price > max.price ? current : max, prices[0]);
  const product: OfficialProduct = {
    jan: data.jan || jan,
    name: data.name || '',
    max_price: best.price,
    max_store: best.store,
    prices,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
  };

  const { error: upsertError } = await serviceSupabase
    .from('kaitorix_price_cache')
    .upsert({
      jan: product.jan,
      product_name: product.name,
      max_price: product.max_price,
      max_store: product.max_store,
      prices: product.prices,
      fetched_at: product.fetchedAt,
      raw_response: data,
      last_fetch_source: 'official',
    }, { onConflict: 'jan' });

  if (upsertError) {
    await recordUsage(usageDate, response.status, rateLimit, upsertError.message);
    return { ok: false, status: 500, error: '保存 Kaitorix 官方价格失败', rateLimit };
  }

  await recordUsage(usageDate, response.status, rateLimit);
  return { ok: true, product, rateLimit };
}
