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

// GET: lookup product_name by JAN — cache first, then Kaitorix search API
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> },
) {
  const { jan } = await params;

  if (!jan || !/^\d{8,13}$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  // キャッシュに商品名があればそのまま返す
  const { data } = await supabase
    .from('kaitorix_price_cache')
    .select('product_name')
    .eq('jan', jan)
    .single();

  if (data?.product_name) {
    return NextResponse.json({ product_name: data.product_name });
  }

  // キャッシュミス or 商品名なし → search API で直接取得
  const productName = await fetchProductNameFromApi(jan);

  if (productName) {
    // キャッシュに保存（価格データがあれば上書きしない、商品名だけ更新）
    await supabase
      .from('kaitorix_price_cache')
      .upsert({ jan, product_name: productName }, { onConflict: 'jan' });
    return NextResponse.json({ product_name: productName });
  }

  // API でも取得できなかった場合はスクレイパーキューに入れてフォールバック
  await supabase.rpc('enqueue_kaitorix_scrape', { p_jan: jan, p_user_id: null });
  return NextResponse.json({ product_name: '' });
}

// POST: seed product_name into cache (ON CONFLICT DO NOTHING to protect scraper data)
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

  // Insert only if row doesn't exist yet — scraper data takes priority
  const { error } = await supabase
    .from('kaitorix_price_cache')
    .upsert(
      { jan, product_name: productName },
      { onConflict: 'jan', ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 首次创建後すぐにキューに入れて価格データを補完
  await supabase.rpc('enqueue_kaitorix_scrape', { p_jan: jan, p_user_id: null });

  return NextResponse.json({ ok: true });
}
