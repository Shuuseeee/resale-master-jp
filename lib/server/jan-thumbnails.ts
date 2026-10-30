// lib/server/jan-thumbnails.ts — 商品缩略图队列处理（JAN 维度，全站同 JAN 共享一张图）
// 原来在本地 scraper（scraper/src/thumbnail-fetcher.ts，pm2 常驻轮询）跑，2026-10-11 搬到 Vercel：
//   · /api/thumbnail/enqueue 入队后用 after() 立刻处理几条（保存交易后几秒内出图）
//   · /api/thumbnail/process 每日 Cron 补跑（原生 App 直接调 RPC 入队的、之前失败待重试的）
// 每条任务：dequeue_jan_thumbnail → Kaitorix search API 精确匹配 JAN 取 image_url（Amazon CDN）
//          → 下载 → sharp 压成 ≤100KB 的 800×800 WebP → 上传 product-images/{jan}.webp → upsert jan_thumbnail_cache。
// 不热链 Amazon：缓存里永远是自己 Storage 的公开地址。search API 429 时放回队列、本轮停止。
import sharp from 'sharp';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';
const MAX_ATTEMPTS = 5;
const TARGET_BYTES = 100 * 1024;
const QUALITY_STEPS = [82, 70, 58, 45];
const FETCH_TIMEOUT_MS = 15_000;
/** search API 两次调用之间的间隔（原本地 worker 是 5 秒一条，这里批量处理时放慢一点避免 429） */
const JOB_GAP_MS = 1_500;
const KAITORIX_SEARCH_API = 'https://kaitorix.app/api/search';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Amazon CDN 对非浏览器 UA 可能 403，下载图片必须带浏览器 UA
const IMAGE_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
};

interface QueueRow {
  id: string;
  jan: string;
  attempts: number;
}

export interface ThumbnailRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  rateLimited: boolean;
}

// 限流是临时状态：不计失败、不耗 attempts
class RateLimitError extends Error {}

function serviceDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function apiHeaders() {
  const token = (process.env.KAITORIX_API_TOKENS || '').split(',')[0]?.trim();
  if (!token) throw new Error('未配置 KAITORIX_API_TOKENS');
  // 与 app/api/jan-product/[jan]/route.ts 调 search API 的写法一致
  return { 'X-API-Token': token, Referer: 'https://kaitorix.app', Origin: 'https://kaitorix.app', 'User-Agent': BROWSER_UA, Accept: '*/*' };
}

/** search 是模糊搜索：必须 results[0].jan === 目标 JAN 且有 image_url */
async function resolveImageUrl(jan: string): Promise<string> {
  const resp = await fetch(`${KAITORIX_SEARCH_API}?q=${encodeURIComponent(jan)}&limit=1`, {
    headers: apiHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (resp.status === 429) throw new RateLimitError('search API HTTP 429');
  if (!resp.ok) throw new Error(`search API HTTP ${resp.status}`);
  const json = await resp.json();
  const first = Array.isArray(json?.results) ? json.results[0] : null;
  if (!first || first.jan !== jan) throw new Error('search API 无精确匹配 JAN');
  const imageUrl = typeof first.image_url === 'string' ? first.image_url.trim() : '';
  if (!imageUrl) throw new Error('search API 匹配项无 image_url');
  return imageUrl;
}

// fit:'contain' + 透明边 → 永远 800×800 方形；下游 object-cover 在 1:1 输入下等价于不裁切
async function compressToWebp(buf: Buffer): Promise<Buffer> {
  const padding = { r: 0, g: 0, b: 0, alpha: 0 };
  for (const q of QUALITY_STEPS) {
    const out = await sharp(buf)
      .resize(800, 800, { fit: 'contain', background: padding, withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
    if (out.length <= TARGET_BYTES) return out;
  }
  return sharp(buf)
    .resize(600, 600, { fit: 'contain', background: padding, withoutEnlargement: true })
    .webp({ quality: 50 })
    .toBuffer();
}

/** @returns 'ok' | 'failed' | 'rate-limited' */
async function handleJob(db: SupabaseClient, job: QueueRow): Promise<'ok' | 'failed' | 'rate-limited'> {
  try {
    const imgUrl = await resolveImageUrl(job.jan);
    const resp = await fetch(imgUrl, { headers: IMAGE_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`fetch image HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) throw new Error('empty image buffer');
    const webp = await compressToWebp(buf);

    const path = `${job.jan}.webp`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, webp, { contentType: 'image/webp', upsert: true });
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);
    const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl;
    if (!publicUrl) throw new Error('getPublicUrl returned empty');

    const { error: cacheErr } = await db.from('jan_thumbnail_cache').upsert(
      { jan: job.jan, image_url: publicUrl, image_fetched_at: new Date().toISOString(), image_fetch_failed_count: 0, error_message: null },
      { onConflict: 'jan' },
    );
    if (cacheErr) throw new Error(`cache upsert: ${cacheErr.message}`);
    await db.from('jan_thumbnail_queue').update({ status: 'completed' }).eq('id', job.id);
    return 'ok';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof RateLimitError) {
      // 还原 attempts（dequeue 已 +1）、放回 pending
      await db
        .from('jan_thumbnail_queue')
        .update({ status: 'pending', attempts: Math.max(job.attempts - 1, 0), error_message: msg })
        .eq('id', job.id);
      return 'rate-limited';
    }
    console.error(`[thumbnail] jan=${job.jan} 失败:`, msg);
    const { data: cacheRow } = await db.from('jan_thumbnail_cache').select('image_fetch_failed_count').eq('jan', job.jan).maybeSingle();
    await db.from('jan_thumbnail_cache').upsert(
      { jan: job.jan, image_fetch_failed_count: (cacheRow?.image_fetch_failed_count ?? 0) + 1, error_message: msg },
      { onConflict: 'jan' },
    );
    await db
      .from('jan_thumbnail_queue')
      .update({ status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', error_message: msg })
      .eq('id', job.id);
    return 'failed';
  }
}

/**
 * 依次处理队列里待处理的任务，直到队列空、处理满 maxJobs 条、到达时间预算或撞到限流。
 * 一次只出队一条（与本地 worker 并存时也安全：出队是 FOR UPDATE SKIP LOCKED）。
 */
export async function processThumbnailQueue({ maxJobs, budgetMs }: { maxJobs: number; budgetMs: number }): Promise<ThumbnailRunResult> {
  const db = serviceDb();
  const deadline = Date.now() + budgetMs;
  const result: ThumbnailRunResult = { processed: 0, succeeded: 0, failed: 0, rateLimited: false };

  while (result.processed < maxJobs && Date.now() < deadline) {
    const { data, error } = await db.rpc('dequeue_jan_thumbnail', { p_limit: 1 });
    if (error) throw new Error(`dequeue_jan_thumbnail: ${error.message}`);
    const job = (data as QueueRow[] | null)?.[0];
    if (!job) break;

    const outcome = await handleJob(db, job);
    if (outcome === 'rate-limited') {
      result.rateLimited = true;
      break;
    }
    result.processed++;
    if (outcome === 'ok') result.succeeded++;
    else result.failed++;
    if (result.processed < maxJobs) await new Promise(r => setTimeout(r, JOB_GAP_MS));
  }
  return result;
}

/** 清理 24 小时前已完成 / 已失败的队列行 */
export async function cleanupThumbnailQueue(): Promise<number> {
  const { data } = await serviceDb().rpc('cleanup_jan_thumbnail_queue');
  return Number(data ?? 0);
}

/** 补扫历史导入 / 入队请求失败的交易；数据库会跳过已有图、已有任务和累计失败 5 次的 JAN。 */
export async function enqueueMissingThumbnails(): Promise<number> {
  const { data, error } = await serviceDb().rpc('batch_enqueue_jan_thumbnails');
  if (error) throw new Error(`batch_enqueue_jan_thumbnails: ${error.message}`);
  return Number(data ?? 0);
}
