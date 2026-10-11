// app/api/thumbnail/enqueue/route.ts
// 按 JAN 入队，响应后用 after() 立刻处理队列（lib/server/jan-thumbnails.ts：Kaitorix search API 取图并转存 Storage，
// 全站同 JAN 共享一张缓存）。顺带处理原生 App 入队的待处理任务；没处理完的由每日 Cron（/api/thumbnail/process）补跑。
// add/edit 页 onPersist 成功后 fire-and-forget 调用

import { after, NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { processThumbnailQueue } from '@/lib/server/jan-thumbnails';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  if (queueId != null) {
    after(async () => {
      try {
        await processThumbnailQueue({ maxJobs: 5, budgetMs: 45_000 });
      } catch (err) {
        console.error('[thumbnail] 入队后处理失败:', err);
      }
    });
  }

  return NextResponse.json({ queued: queueId != null, queue_id: queueId });
}
