// thumbnail-fetcher.ts — 独立 worker，JAN 维度（全站同 JAN 共享一张图）：
//   1) dequeue_jan_thumbnail 拿任务（仅 jan）
//   2) GET https://kaitorix.app/api/search?q={jan}&limit=1 —— Kaitorix search API
//      返回 { results: [{ jan, name, image_url }] }，image_url 是 Amazon CDN 图
//   3) search 是模糊搜索，必须校验 results[0].jan === 目标 jan 且 image_url 非空
//   4) 下载原图 → sharp WebP ≤100KB
//   5) 上传 product-images/{jan}.webp → upsert jan_thumbnail_cache（不 touch transactions）
//
// 不热链 Amazon URL：下载后转存自己的 Storage，缓存里永远是 Supabase public URL。
// （旧实现用 Playwright 抓 1-chome 详情页主图，已整体移除）
//
// 启动：cd scraper && npm run thumbnail（或 pm2 ecosystem.config.js 的 thumbnail-fetcher）

import sharp from 'sharp';
import { supabase } from './supabase.js';
import { jitter } from './config.js';
import { log, logError } from './logger.js';

const BUCKET = 'product-images';
const POLL_INTERVAL_BUSY = 5_000;
const POLL_INTERVAL_IDLE = 5_000;
// 429 时暂停轮询，等限流窗口过去（bulk 重抓时最容易触发）
const RATE_LIMIT_BACKOFF_MS = 90_000;
const MAX_ATTEMPTS = 5;
const TARGET_BYTES = 100 * 1024;
const QUALITY_STEPS = [82, 70, 58, 45];
const FETCH_TIMEOUT_MS = 15_000;

const KAITORIX_SEARCH_API = 'https://kaitorix.app/api/search';
const KAITORIX_TOKEN = (process.env.KAITORIX_API_TOKENS || '').split(',')[0]?.trim();

if (!KAITORIX_TOKEN) {
  throw new Error('Missing KAITORIX_API_TOKENS in .env');
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 对齐 app/api/jan-product/[jan]/route.ts 调 search API 的 header 写法
const API_HEADERS = {
  'X-API-Token': KAITORIX_TOKEN,
  'Referer': 'https://kaitorix.app',
  'Origin': 'https://kaitorix.app',
  'User-Agent': BROWSER_UA,
  'Accept': '*/*',
};

// Amazon CDN 对非浏览器 UA（Node fetch 默认 undici）可能 403，下载图片必须带浏览器 UA
const IMAGE_HEADERS = {
  'User-Agent': BROWSER_UA,
  'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
};

let running = true;

interface QueueRow {
  id: string;
  jan: string;
  attempts: number;
}

// 限流是临时状态：不计失败、不耗 attempts，退避后重试
class RateLimitError extends Error {}

// 步骤 2-3：调 search API，精确匹配 jan，取 image_url
async function resolveImageUrl(jan: string): Promise<string> {
  const url = `${KAITORIX_SEARCH_API}?q=${encodeURIComponent(jan)}&limit=1`;
  const resp = await fetch(url, {
    headers: API_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (resp.status === 429) throw new RateLimitError('search API HTTP 429');
  if (!resp.ok) throw new Error(`search API HTTP ${resp.status}`);

  const json = await resp.json();
  const first = Array.isArray(json?.results) ? json.results[0] : null;

  if (!first || first.jan !== jan) {
    throw new Error('search API 无精确匹配 JAN');
  }
  const imageUrl = typeof first.image_url === 'string' ? first.image_url.trim() : '';
  if (!imageUrl) {
    throw new Error('search API 匹配项无 image_url');
  }
  return imageUrl;
}

// fit:'contain' + 透明 padding → 输出永远 800×800 方形；
// 下游 ProductImage 的 object-cover 在 1:1 输入下等价于不裁切的 contain
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

/** @returns true 表示撞了限流，调用方应退避 */
async function handleJob(job: QueueRow): Promise<boolean> {
  try {
    const imgUrl = await resolveImageUrl(job.jan);

    const resp = await fetch(imgUrl, {
      headers: IMAGE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) throw new Error(`fetch image HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) throw new Error('empty image buffer');

    const webp = await compressToWebp(buf);

    // 步骤 5：上传 product-images/{jan}.webp + upsert jan_thumbnail_cache
    const path = `${job.jan}.webp`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, webp, { contentType: 'image/webp', upsert: true });
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) throw new Error('getPublicUrl returned empty');

    const { error: cacheErr } = await supabase
      .from('jan_thumbnail_cache')
      .upsert(
        {
          jan: job.jan,
          image_url: publicUrl,
          image_fetched_at: new Date().toISOString(),
          image_fetch_failed_count: 0,
          error_message: null,
        },
        { onConflict: 'jan' },
      );
    if (cacheErr) throw new Error(`cache upsert: ${cacheErr.message}`);

    await supabase.from('jan_thumbnail_queue').update({ status: 'completed' }).eq('id', job.id);

    log(`[ok] jan=${job.jan} (${webp.length} B) <- ${imgUrl}`);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // 限流：还原 attempts（dequeue 已 +1）、放回 pending，不计入失败统计
    if (err instanceof RateLimitError) {
      log(`[rate-limited] jan=${job.jan}, requeue and back off ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
      await supabase
        .from('jan_thumbnail_queue')
        .update({ status: 'pending', attempts: Math.max(job.attempts - 1, 0), error_message: msg })
        .eq('id', job.id);
      return true;
    }

    logError(`[fail] jan=${job.jan}`, msg);

    // 累加 JAN 级失败计数（upsert 保证没有 cache 行时也能记）
    const { data: cacheRow } = await supabase
      .from('jan_thumbnail_cache')
      .select('image_fetch_failed_count')
      .eq('jan', job.jan)
      .maybeSingle();
    await supabase.from('jan_thumbnail_cache').upsert(
      {
        jan: job.jan,
        image_fetch_failed_count: (cacheRow?.image_fetch_failed_count ?? 0) + 1,
        error_message: msg,
      },
      { onConflict: 'jan' },
    );

    const newStatus = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
    await supabase
      .from('jan_thumbnail_queue')
      .update({ status: newStatus, error_message: msg })
      .eq('id', job.id);
    return false;
  }
}

type PollResult = 'worked' | 'idle' | 'rate-limited';

async function pollOnce(): Promise<PollResult> {
  const { data, error } = await supabase.rpc('dequeue_jan_thumbnail', { p_limit: 1 });
  if (error) {
    logError('dequeue_jan_thumbnail failed', error);
    return 'idle';
  }
  const rows = (data || []) as QueueRow[];
  if (rows.length === 0) return 'idle';

  const rateLimited = await handleJob(rows[0]);
  return rateLimited ? 'rate-limited' : 'worked';
}

async function mainLoop() {
  log('thumbnail-fetcher started, polling jan_thumbnail_queue...');
  let cleanupCounter = 0;
  while (running) {
    try {
      cleanupCounter++;
      if (cleanupCounter % 100 === 0) {
        const { data: cleaned } = await supabase.rpc('cleanup_jan_thumbnail_queue');
        if (cleaned && Number(cleaned) > 0) log(`cleaned ${cleaned} old thumbnail queue rows`);
      }

      const result = await pollOnce();
      const delay =
        result === 'rate-limited'
          ? jitter(RATE_LIMIT_BACKOFF_MS)
          : jitter(result === 'worked' ? POLL_INTERVAL_BUSY : POLL_INTERVAL_IDLE);
      if (result === 'idle') log('thumbnail queue empty, waiting...');
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, delay);
        if (!running) {
          clearTimeout(t);
          resolve();
        }
      });
    } catch (err) {
      logError('thumbnail-fetcher main loop error', err);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}

function shutdown() {
  log('thumbnail-fetcher shutting down...');
  running = false;
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

mainLoop().catch((err) => {
  logError('thumbnail-fetcher fatal', err);
  process.exit(1);
});
