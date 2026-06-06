// app/api/thumbnail/enqueue/route.ts
// 按 JAN 入队，由独立 scraper 后台抓取 1-chome 主图（全站同 JAN 共享一张缓存）
// add/edit 页 onPersist 成功后 fire-and-forget 调用

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUserClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await getUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const jan = typeof body?.jan === 'string' ? body.jan.trim() : '';
  if (!/^\d{8,13}$/.test(jan)) {
    return NextResponse.json({ error: 'JAN 码格式不正确' }, { status: 400 });
  }

  // enqueue_jan_thumbnail 内部已 dedup（已缓存 / 已在队列则不重复入队）
  const { data: queueId, error } = await supabase.rpc('enqueue_jan_thumbnail', { p_jan: jan });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ queued: queueId != null, queue_id: queueId });
}
