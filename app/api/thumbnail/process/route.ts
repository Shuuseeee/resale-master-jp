// app/api/thumbnail/process/route.ts — 每日补跑商品缩略图队列（Vercel Cron，vercel.json）
// 平时由 /api/thumbnail/enqueue 入队后立刻处理；这里先补扫未入队的历史漏图，再处理原生 App 入队、失败待重试、被限流放回的任务。
// 用 CRON_SECRET 校验 Authorization: Bearer；手动补跑：
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/thumbnail/process
import { NextRequest, NextResponse } from 'next/server';
import { cleanupThumbnailQueue, enqueueMissingThumbnails, processThumbnailQueue } from '@/lib/server/jan-thumbnails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: '未配置 CRON_SECRET' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const queued = await enqueueMissingThumbnails();
    const result = await processThumbnailQueue({ maxJobs: 150, budgetMs: 270_000 });
    const cleaned = await cleanupThumbnailQueue();
    return NextResponse.json({ ok: true, queued, ...result, cleaned });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
