import { NextRequest, NextResponse } from 'next/server';
import { CatalogSyncError, syncKaitorixCatalog } from '@/lib/server/kaitorix-catalog-sync';

// 解析 gzip + 分批写入约 2 万行，加上下载间隔重试，给足时长
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// 每日同步买取X 全量 CSV → kaitorix_catalog。
// 由 Vercel Cron 触发（vercel.json），用 CRON_SECRET 校验 Authorization: Bearer；
// 手动补跑：curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/kaitorix/catalog-sync
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: '未配置 CRON_SECRET' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncKaitorixCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CatalogSyncError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
