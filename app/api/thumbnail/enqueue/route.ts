// app/api/thumbnail/enqueue/route.ts
// 按 JAN 入队，响应后用 after() 立刻处理队列（lib/server/jan-thumbnails.ts：Kaitorix search API 取图并转存 Storage，
// 全站同 JAN 共享一张缓存）。顺带处理原生 App 入队的待处理任务；没处理完的由每日 Cron（/api/thumbnail/process）补跑。
// add/edit 页 onPersist 成功后 fire-and-forget 调用（{ jan }）；数据导入成功后一次传整份文件的 JAN（{ jans }）

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
  const isJan = (v: unknown): v is string => typeof v === 'string' && /^\d{8,13}$/.test(v.trim());
  const batch = Array.isArray(body?.jans);
  const jans = [...new Set((batch ? body.jans : [body?.jan]).filter(isJan).map((j: string) => j.trim()))].slice(0, 500) as string[];
  if (!jans.length) {
    return NextResponse.json({ error: 'JAN 码格式不正确' }, { status: 400 });
  }

  // enqueue_jan_thumbnail 内部已 dedup（已缓存 / 已在队列则不重复入队，返回 null）
  let queued = 0;
  let firstId: unknown = null;
  for (let i = 0; i < jans.length; i += 10) {
    const results = await Promise.all(jans.slice(i, i + 10).map(jan => supabase.rpc('enqueue_jan_thumbnail', { p_jan: jan })));
    const failed = results.find(r => r.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    for (const r of results) {
      if (r.data != null) {
        queued++;
        firstId ??= r.data;
      }
    }
  }

  // 响应后接着处理：单个最多 5 条；导入一次可能几十个 JAN，这次尽量多处理（每条约 2–3 秒，受 maxDuration 限制），
  // 没处理完的由每日 Cron（/api/thumbnail/process）补
  if (queued > 0) {
    after(async () => {
      try {
        await processThumbnailQueue(batch ? { maxJobs: 20, budgetMs: 50_000 } : { maxJobs: 5, budgetMs: 45_000 });
      } catch (err) {
        console.error('[thumbnail] 入队后处理失败:', err);
      }
    });
  }

  return NextResponse.json(batch ? { queued } : { queued: queued > 0, queue_id: firstId });
}
