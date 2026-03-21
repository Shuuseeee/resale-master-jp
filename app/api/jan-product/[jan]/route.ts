import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// GET: lookup product_name by JAN from kaitorix_price_cache
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> },
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  const { data } = await supabase
    .from('kaitorix_price_cache')
    .select('product_name, max_price')
    .eq('jan', jan)
    .single();

  // 只返回有效数据（max_price > 0）
  if (data?.max_price && data.max_price > 0) {
    return NextResponse.json({ product_name: data.product_name || '' });
  }

  // 缓存无效或缺失 → 重新入队等待爬虫抓取
  await supabase.rpc('enqueue_kaitorix_scrape', { p_jan: jan, p_user_id: null });

  return NextResponse.json({ product_name: '' });
}

// POST: seed product_name into cache (ON CONFLICT DO NOTHING to protect scraper data)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jan: string }> },
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
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

  // 首次创建后立即入队，让爬虫补全价格数据
  await supabase.rpc('enqueue_kaitorix_scrape', { p_jan: jan, p_user_id: null });

  return NextResponse.json({ ok: true });
}
