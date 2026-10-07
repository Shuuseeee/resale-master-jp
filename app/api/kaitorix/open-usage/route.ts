import { NextResponse } from 'next/server';
import {
  DEFAULT_DAILY_LIMIT,
  getAuthedUser,
  getJstDateKey,
  serviceSupabase,
} from '@/lib/server/kaitorix-official';

export async function GET() {
  const user = await getAuthedUser();
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
