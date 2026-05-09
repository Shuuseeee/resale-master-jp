import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_DAILY_LIMIT = Number(process.env.KAITORIX_OPEN_API_DAILY_LIMIT || 30);

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

export async function GET() {
  const supabase = await getUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const usageDate = getJstDateKey();
  const { data } = await serviceSupabase
    .from('kaitorix_open_api_usage')
    .select('usage_date,used_count,last_limit,last_remaining,last_reset_at,last_status,last_error,updated_at')
    .eq('usage_date', usageDate)
    .maybeSingle();

  const limit = data?.last_limit ?? DEFAULT_DAILY_LIMIT;
  const remaining = data?.last_remaining ?? Math.max(0, limit - (data?.used_count ?? 0));

  return NextResponse.json({
    usageDate,
    used: data?.used_count ?? 0,
    limit,
    remaining,
    reset: data?.last_reset_at ?? null,
    lastStatus: data?.last_status ?? null,
    lastError: data?.last_error ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}
