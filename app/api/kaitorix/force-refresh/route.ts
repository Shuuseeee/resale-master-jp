import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const KAITORIX_OPEN_API_KEY = process.env.KAITORIX_OPEN_API_KEY;
const DEFAULT_DAILY_LIMIT = Number(process.env.KAITORIX_OPEN_API_DAILY_LIMIT || 30);

interface OpenApiPrice {
  store: string;
  price: number;
  url: string;
  updated: string;
}

interface OpenApiProductResponse {
  jan?: string;
  asin?: string;
  name?: string;
  max_price?: number;
  prices?: OpenApiPrice[];
}

async function getUserClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function getJstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function parseRateLimitHeaders(headers: Headers) {
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
  rateLimit: { limit: number; remaining: number | null; reset: string | null },
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

function normalizePrices(prices: unknown): OpenApiPrice[] {
  if (!Array.isArray(prices)) return [];
  return prices
    .map((price) => {
      const item = price as Partial<OpenApiPrice>;
      const priceNum = Number(item.price);
      if (!item.store || !Number.isFinite(priceNum)) return null;
      return {
        store: String(item.store),
        price: priceNum,
        url: item.url ? String(item.url) : '',
        updated: item.updated ? String(item.updated) : '',
      };
    })
    .filter(Boolean) as OpenApiPrice[];
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function normalizeApiKey(apiKey: string | undefined): string {
  return (apiKey || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bearer\s+/i, '')
    .trim();
}

function getAuthorizationHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
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

export async function POST(request: NextRequest) {
  const supabase = await getUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError('请先登录后再使用官方强刷', 401);

  const kaitorixApiKey = normalizeApiKey(KAITORIX_OPEN_API_KEY);
  if (!kaitorixApiKey) {
    return jsonError('未配置 Kaitorix Open API Key', 500);
  }

  const body = await request.json().catch(() => null);
  const jan = typeof body?.jan === 'string' ? body.jan.trim() : '';
  if (!/^(\d{7,14}|B[A-Z0-9]{9})$/i.test(jan)) {
    return jsonError('JAN/ASIN 格式不正确', 400);
  }

  const { usageDate, usage } = await getTodayUsage();
  const localLimit = usage?.last_limit ?? DEFAULT_DAILY_LIMIT;
  const localRemaining = usage?.last_remaining;
  if (localRemaining !== null && localRemaining !== undefined && localRemaining <= 0) {
    return jsonError('Kaitorix 官方 API 今日配额已用完', 429, {
      rateLimit: {
        limit: localLimit,
        remaining: 0,
        reset: usage?.last_reset_at ?? null,
      },
    });
  }
  if ((usage?.used_count ?? 0) >= localLimit) {
    return jsonError('Kaitorix 官方 API 今日配额已用完', 429, {
      rateLimit: {
        limit: localLimit,
        remaining: 0,
        reset: usage?.last_reset_at ?? null,
      },
    });
  }

  let response: Response;
  try {
    response = await fetch(buildProductUrl(jan), {
      headers: {
        Authorization: getAuthorizationHeader(kaitorixApiKey),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    // Kaitorix docs also allow ?key=. Some hosting/proxy paths can behave
    // differently with Authorization headers, so retry once with the documented
    // query-param auth before surfacing an auth failure.
    if (response.status === 401 || response.status === 403) {
      response = await fetch(buildProductUrl(jan, kaitorixApiKey), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch (error) {
    return jsonError('无法连接 Kaitorix 官方 API，请检查本地/部署环境网络', 502, {
      detail: process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error ? error.message : String(error),
    });
  }

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (response.status === 429) {
    await recordUsage(usageDate, response.status, { ...rateLimit, remaining: 0 }, 'rate limited');
    return jsonError('Kaitorix 官方 API 今日配额已用完', 429, {
      rateLimit: { ...rateLimit, remaining: 0 },
    });
  }

  if (response.status === 404) {
    await recordUsage(usageDate, response.status, rateLimit, 'not found');
    return jsonError('Kaitorix 未找到该商品', 404, { rateLimit });
  }

  if (response.status === 401 || response.status === 403) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || `status ${response.status}`);
    return jsonError('Kaitorix Open API Key 无效或无权限', 401, { rateLimit });
  }

  if (response.status === 400) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || 'bad request');
    return jsonError(upstreamError || 'Kaitorix 官方 API 参数错误', 400, { rateLimit });
  }

  if (!response.ok) {
    const upstreamError = await readUpstreamError(response);
    await recordUsage(usageDate, response.status, rateLimit, upstreamError || `status ${response.status}`);
    return jsonError(
      upstreamError || `Kaitorix 官方 API 暂时不可用 (${response.status})`,
      response.status >= 500 ? 502 : response.status,
      { rateLimit },
    );
  }

  const data = await response.json().catch(() => null) as OpenApiProductResponse | null;
  const prices = normalizePrices(data?.prices);
  if (!data || prices.length === 0) {
    await recordUsage(usageDate, response.status, rateLimit, 'empty prices');
    return jsonError('Kaitorix 官方 API 未返回价格数据', 422, { rateLimit });
  }

  const best = prices.reduce((max, current) => current.price > max.price ? current : max, prices[0]);
  const cacheJan = data.jan || jan;
  const fetchedAt = new Date().toISOString();

  const { error: upsertError } = await serviceSupabase
    .from('kaitorix_price_cache')
    .upsert({
      jan: cacheJan,
      product_name: data.name || '',
      max_price: data.max_price ?? best.price,
      max_store: best.store,
      prices,
      fetched_at: fetchedAt,
      raw_response: data,
      last_fetch_source: 'official',
    }, { onConflict: 'jan' });

  if (upsertError) {
    await recordUsage(usageDate, response.status, rateLimit, upsertError.message);
    return jsonError('保存 Kaitorix 官方价格失败', 500, { rateLimit });
  }

  await recordUsage(usageDate, response.status, rateLimit);

  return NextResponse.json({
    jan: cacheJan,
    name: data.name || '',
    max_price: data.max_price ?? best.price,
    max_store: best.store,
    prices,
    _source: 'cache',
    _fetched_at: fetchedAt,
    rateLimit,
  });
}
