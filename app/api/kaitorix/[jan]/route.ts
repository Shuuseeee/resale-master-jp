import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Service role client for server-side operations (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> }
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
    return NextResponse.json({ error: 'Invalid JAN code' }, { status: 400 });
  }

  // Check cache
  const { data: cached } = await supabase
    .from('kaitorix_price_cache')
    .select('*')
    .eq('jan', jan)
    .single();

  const now = new Date();
  const isFresh = cached?.fetched_at &&
    (now.getTime() - new Date(cached.fetched_at).getTime()) < CACHE_TTL_MS;

  if (cached && isFresh) {
    return NextResponse.json({
      jan: cached.jan,
      name: cached.product_name || '',
      max_price: cached.max_price,
      max_store: cached.max_store || '',
      prices: cached.prices || [],
      _source: 'cache',
    });
  }

  // Enqueue scrape request (service_role bypasses RLS)
  await supabase.rpc('enqueue_kaitorix_scrape', {
    p_jan: jan,
    p_user_id: '00000000-0000-0000-0000-000000000000',
  });

  // Return stale cache if available
  if (cached) {
    return NextResponse.json({
      jan: cached.jan,
      name: cached.product_name || '',
      max_price: cached.max_price,
      max_store: cached.max_store || '',
      prices: cached.prices || [],
      _source: 'stale',
      _fetched_at: cached.fetched_at,
    });
  }

  // No cache at all
  return NextResponse.json({
    jan,
    name: '',
    max_price: 0,
    max_store: '',
    prices: [],
    _source: 'pending',
  });
}
