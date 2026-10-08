import { NextResponse } from 'next/server';
import { KAITORIX_NO_DATA_RETRY_MS, KAITORIX_REFRESH_AFTER_MS } from '@/lib/kaitorix-config';
import { getReferencePrices, type KaitorixPriceEntry } from '@/lib/kaitorix-domain';
import {
  AUTO_REFRESH_RESERVE,
  getAuthedUser,
  refreshFromOfficial,
  serviceSupabase as supabase,
} from '@/lib/server/kaitorix-official';

// 按 JAN 查买取价：缓存新鲜（有可参考价格 30 分钟内 / 无可参考价格 24 小时内）直接返回；过期或没有时，已登录用户触发一次官方 API 刷新。
// 官方刷新失败 / 额度保留线 / 限速时退回旧缓存（stale）或 pending，由前端稍后重试。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> }
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  const { data: cached } = await supabase
    .from('kaitorix_price_cache')
    .select('*')
    .eq('jan', jan)
    .single();

  const fromCache = (source: 'cache' | 'stale') => ({
    jan: cached!.jan,
    name: cached!.product_name || '',
    max_price: cached!.max_price,
    max_store: cached!.max_store || '',
    prices: cached!.prices || [],
    _source: source,
    _fetched_at: cached!.fetched_at,
  });

  // 有可参考价格（店铺报价更新未超过 7 天）的 JAN 按 30 分钟刷新；
  // 官方查不到 / 没有任何可参考价格的 JAN 隔 24 小时才再请求（官方 404 也扣额度，每次进页面重试会白白耗光）
  const fetchedAtMs = cached?.fetched_at ? new Date(cached.fetched_at).getTime() : null;
  const hasReferencePrice = cached
    ? getReferencePrices((cached.prices ?? []) as KaitorixPriceEntry[], fetchedAtMs).length > 0
    : false;
  const freshWindowMs = hasReferencePrice ? KAITORIX_REFRESH_AFTER_MS : KAITORIX_NO_DATA_RETRY_MS;
  const isFresh = fetchedAtMs !== null && Date.now() - fetchedAtMs < freshWindowMs;

  if (cached && isFresh) {
    return NextResponse.json(fromCache('cache'));
  }

  // 官方额度是用户付费资源：未登录请求只读缓存，不触发官方调用
  const user = await getAuthedUser();
  const result = user ? await refreshFromOfficial(jan, { reserve: AUTO_REFRESH_RESERVE }) : null;

  if (result?.ok) {
    const { product } = result;
    return NextResponse.json({
      jan: product.jan,
      name: product.name,
      max_price: product.max_price,
      max_store: product.max_store,
      prices: product.prices,
      _source: 'official',
      _fetched_at: product.fetchedAt,
    });
  }

  // 每秒 1 次限速：告诉前端稍后重试
  const retry = result && !result.ok && result.tpsLimited ? { _retry_after_ms: 1500 } : {};

  if (cached) {
    return NextResponse.json({ ...fromCache('stale'), ...retry });
  }

  return NextResponse.json({
    jan,
    name: '',
    max_price: 0,
    max_store: '',
    prices: [],
    _source: 'pending',
    ...retry,
  });
}
