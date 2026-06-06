// thumbnail-fetcher.ts — 独立 worker，JAN 维度（全站同 JAN 共享一张图）：
//   1) dequeue_jan_thumbnail 拿任务（仅 jan）
//   2) GET https://www.1-chome.com/api/index/findByKeyword?keyword={jan} —— 1-chome 的 JSON API
//   3) 跳过 kbName==="中古品" 的条目，精确匹配 jan（含 keitaiColorOptions 多色 SKU）
//   4) 按 isKeitaiItem 拼 target_url（productDetail / wineDetail / {goodsId}/{allGoodsKbId}）
//      ⚠ price_tracker CLAUDE.md 明确说：变量名（keitai）和 URL（productDetail/wineDetail）
//        对应反直觉，但已被生产验证，保持原样
//   5) Playwright 打开 target_url；多色商品按 API 给的 color / 商品名切 dropdown 颜色
//   6) 取 div.product-detail img[src^="/api/file/image/"] 主图 → 下载 → sharp WebP ≤100KB
//   7) 上传 product-images/{jan}.webp → upsert jan_thumbnail_cache（不 touch transactions）
//
// 启动：cd scraper && npm run thumbnail（或 pm2 ecosystem.config.js 的 thumbnail-fetcher）

import { chromium, type BrowserContext, type Page } from 'playwright';
import sharp from 'sharp';
import { supabase } from './supabase.js';
import { jitter } from './config.js';
import { log, logError } from './logger.js';

const BUCKET = 'product-images';
const POLL_INTERVAL_BUSY = 2_000;
const POLL_INTERVAL_IDLE = 5_000;
const MAX_ATTEMPTS = 5;
const TARGET_BYTES = 100 * 1024;
const QUALITY_STEPS = [82, 70, 58, 45];
const NAV_TIMEOUT_MS = 25_000;
const SELECTOR_TIMEOUT_MS = 15_000;

// 1-chome 后端 API：findByKeyword 返回所有匹配 SKU（含 goodsId / allGoodsKbId / isKeitaiItem）
const ONE_CHOME_API = 'https://www.1-chome.com/api/index/findByKeyword';
const PRODUCT_URL = 'https://www.1-chome.com/productDetail';
const WINE_URL = 'https://www.1-chome.com/wineDetail';

// 详情页主图 selector：iPhone (productDetail) 和 wine (wineDetail) 两种 layout
// 共用 src 前缀 /api/file/image/，class 不一致所以走 src-prefix
const IMG_SELECTOR = 'div.product-detail img[src^="/api/file/image/"]';
// 颜色变体下拉（Element Plus el-select）
const COLOR_SELECT_SEL = 'div.product-detail .el-select .el-select__wrapper';
const COLOR_ITEM_SEL = '.el-select-dropdown__item';

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'ja,en;q=0.9',
  'Referer': 'https://www.1-chome.com/',
};

let running = true;
let context: BrowserContext | null = null;

interface QueueRow {
  id: string;
  jan: string;
  attempts: number;
}

interface OneChomeMatch {
  targetUrl: string;
  /** 颜色后缀（如 "ブラック"）；非多色 SKU 为空 */
  colorLabel: string;
  /** API 返回的商品名，用于多色 dropdown 兜底匹配 */
  productName: string;
}

async function ensureBrowser() {
  if (context) return;
  log('Launching Chromium for thumbnail-fetcher...');
  context = await chromium.launchPersistentContext('./browser-data-thumbnail', {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    userAgent: HTTP_HEADERS['User-Agent'],
  });
  log('Thumbnail browser ready');
}

async function closeBrowserSafe() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
    log('Thumbnail browser closed');
  }
}

// 步骤 2-4：调 1-chome JSON API，精确匹配 jan_code，拼 target_url
async function resolveTargetUrl(jan: string): Promise<OneChomeMatch | null> {
  const url = `${ONE_CHOME_API}?page=1&size=24&keyword=${encodeURIComponent(jan)}`;
  const resp = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error(`findByKeyword HTTP ${resp.status}`);

  const json = await resp.json();
  if (json?.code !== 200 || !Array.isArray(json?.data?.content)) {
    return null;
  }

  for (const item of json.data.content) {
    if (item?.kbName === '中古品') continue;
    if (!item?.goodsId || !item?.allGoodsKbId) continue;

    const baseUrl = item.isKeitaiItem ? PRODUCT_URL : WINE_URL;
    const targetUrl = `${baseUrl}/${item.goodsId}/${item.allGoodsKbId}`;

    const productName = String(item.title || '');

    // 多色 SKU：每个颜色一条 jan，找到目标 jan 对应的 color 字符串
    if (Array.isArray(item.keitaiColorOptions) && item.keitaiColorOptions.length > 0) {
      const matched = item.keitaiColorOptions.find((c: { jan?: string }) => c?.jan === jan);
      if (matched) {
        const colorLabel = String(matched.color || '');
        return { targetUrl, colorLabel, productName: `${productName} ${colorLabel}`.trim() };
      }
      continue;
    }

    // 单 SKU：item.jan 直接等于目标
    if (item.jan === jan) {
      return { targetUrl, colorLabel: '', productName };
    }
  }
  return null;
}

// 步骤 5（多色 SKU 专用）：按 colorLabel / product_name 切 dropdown 颜色
// 复用 price_tracker/image-fetcher.js:62-106 的策略
async function selectMatchingColor(page: Page, colorLabel: string, productName: string) {
  const wrapper = await page.$(COLOR_SELECT_SEL);
  if (!wrapper) return; // 单 SKU，没下拉

  await wrapper.click();
  const opened = await page
    .waitForSelector(COLOR_ITEM_SEL, { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }
  await page.waitForTimeout(200);

  const items: string[] = await page.$$eval(COLOR_ITEM_SEL, (els) =>
    els.map((el) => (el.textContent || '').trim()).filter(Boolean),
  );

  // 优先 colorLabel（findByKeyword API 直接给出的精确颜色）
  // 兜底用 productName 末尾文本（长文本优先匹配，避免短词截断）
  let target = colorLabel && items.find((t) => t === colorLabel);
  if (!target) {
    const sorted = [...items].sort((a, b) => b.length - a.length);
    target = sorted.find((t) => productName.includes(t));
  }
  if (!target) {
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }

  const prevSrc = await page
    .$eval(IMG_SELECTOR, (el) => (el as HTMLImageElement).currentSrc || el.getAttribute('src') || '')
    .catch(() => '');

  await page.evaluate(
    ([sel, text]) => {
      const t = Array.from(document.querySelectorAll(sel)).find(
        (el) => (el.textContent || '').trim() === text,
      );
      if (t) (t as HTMLElement).click();
    },
    [COLOR_ITEM_SEL, target] as const,
  );

  // 等图换；若点的就是当前色，src 不会变，timeout 吞掉
  await page
    .waitForFunction(
      ([sel, prev]) => {
        const el = document.querySelector(sel);
        const cur = el && ((el as HTMLImageElement).currentSrc || el.getAttribute('src'));
        return cur && cur !== prev;
      },
      [IMG_SELECTOR, prevSrc] as const,
      { timeout: 5_000 },
    )
    .catch(() => {});
}

// 步骤 5-6：打开 target_url，切色后取主图 URL
async function extractImageUrl(
  page: Page,
  targetUrl: string,
  colorLabel: string,
  productName: string,
): Promise<string | null> {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  const found = await page
    .waitForSelector(IMG_SELECTOR, { timeout: SELECTOR_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!found) return null;

  await selectMatchingColor(page, colorLabel, productName);

  const raw = await page.$eval(
    IMG_SELECTOR,
    (el) => (el as HTMLImageElement).currentSrc || el.getAttribute('src') || '',
  );
  if (!raw) return null;
  return new URL(raw, page.url()).href;
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

async function handleJob(job: QueueRow): Promise<void> {
  await ensureBrowser();
  const page = await context!.newPage();
  try {
    // 步骤 2-4：API → target_url（productName 由 API 一并给出）
    const match = await resolveTargetUrl(job.jan);
    if (!match) throw new Error('1-chome findByKeyword 无匹配 SKU');

    // 步骤 5-6：headless 抓图
    const imgUrl = await extractImageUrl(page, match.targetUrl, match.colorLabel, match.productName);
    if (!imgUrl) throw new Error('详情页主图 selector 未命中');

    const resp = await fetch(imgUrl, { headers: HTTP_HEADERS });
    if (!resp.ok) throw new Error(`fetch image HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) throw new Error('empty image buffer');

    const webp = await compressToWebp(buf);

    // 步骤 7：上传 product-images/{jan}.webp + upsert jan_thumbnail_cache
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

    log(`[ok] jan=${job.jan} (${webp.length} B) -> ${match.targetUrl}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  } finally {
    await page.close().catch(() => {});
  }
}

async function pollOnce(): Promise<boolean> {
  const { data, error } = await supabase.rpc('dequeue_jan_thumbnail', { p_limit: 1 });
  if (error) {
    logError('dequeue_jan_thumbnail failed', error);
    return false;
  }
  const rows = (data || []) as QueueRow[];
  if (rows.length === 0) return false;

  await handleJob(rows[0]);
  return true;
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

      const hadWork = await pollOnce();
      const delay = jitter(hadWork ? POLL_INTERVAL_BUSY : POLL_INTERVAL_IDLE);
      if (!hadWork) log('thumbnail queue empty, waiting...');
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
  closeBrowserSafe().then(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

mainLoop().catch((err) => {
  logError('thumbnail-fetcher fatal', err);
  closeBrowserSafe().then(() => process.exit(1));
});
