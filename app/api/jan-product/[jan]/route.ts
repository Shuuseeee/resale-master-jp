import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const KAITORIX_TOKEN = (process.env.KAITORIX_API_TOKENS || '').split(',')[0]?.trim();

async function fetchProductNameFromApi(jan: string): Promise<string> {
  if (!KAITORIX_TOKEN) return '';
  try {
    const res = await fetch(
      `https://kaitorix.app/api/search?q=${encodeURIComponent(jan)}&limit=1`,
      {
        headers: {
          'X-API-Token': KAITORIX_TOKEN,
          'Referer': 'https://kaitorix.app',
          'Origin': 'https://kaitorix.app',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return '';
    const json = await res.json();
    return (json?.results?.[0]?.name as string) || '';
  } catch {
    return '';
  }
}

// GET: lookup product_name by JAN。
// ① kaitorix_catalog（每日同步的买取X 全量商品目录，主键查询）→ ② kaitorix_price_cache →
// ③ 兜底：Kaitorix search API（目录没收录的冷门 / 停售商品）。都查不到返回空，由用户手填。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> },
) {
  const { jan } = await params;

  if (!jan || !/^\d{8,13}$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  const [catalog, cache] = await Promise.all([
    supabase.from('kaitorix_catalog').select('name').eq('jan', jan).maybeSingle(),
    supabase.from('kaitorix_price_cache').select('product_name').eq('jan', jan).maybeSingle(),
  ]);

  const knownName = catalog.data?.name || cache.data?.product_name;
  if (knownName) {
    return NextResponse.json({ product_name: knownName });
  }

  const productName = await fetchProductNameFromApi(jan);
  if (productName) {
    // 只存商品名，不写 fetched_at：这行还没有价格，进入买取价页时要触发官方刷新，
    // 不能被当成「24 小时内刚抓过」
    await supabase
      .from('kaitorix_price_cache')
      .upsert({ jan, product_name: productName, fetched_at: null }, { onConflict: 'jan', ignoreDuplicates: true });
    return NextResponse.json({ product_name: productName });
  }

  return NextResponse.json({ product_name: '' });
}

// POST: 新增交易后把用户填的 JAN → 商品名存进缓存（已有行不覆盖）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jan: string }> },
) {
  const { jan } = await params;

  if (!jan || !/^\d{8,13}$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const productName = body?.product_name;
  if (!productName || typeof productName !== 'string') {
    return NextResponse.json({ error: 'product_name required' }, { status: 400 });
  }

  // 只在没有这一行时插入；fetched_at 留空，价格由进入买取价页时的官方刷新补上
  const { error } = await supabase
    .from('kaitorix_price_cache')
    .upsert(
      { jan, product_name: productName, fetched_at: null },
      { onConflict: 'jan', ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
