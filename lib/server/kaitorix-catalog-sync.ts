// lib/server/kaitorix-catalog-sync.ts
// 买取X「全部买取数据」CSV 每日同步到 kaitorix_catalog。仅供 app/api 路由使用。
// 文档：https://kaitorix.app/open/docs（数据下载 CSV；需「ダウンロードプラン」加购，认证用 Open API 同一个 key）
//   POST /api/data-export/today/generate  每天（JST 0:00 重置）只能生成一次，已生成返回 409
//   GET  /api/data-export/today/download  gzip；每 1 分钟一次，超过返回 429（含 retry_after 秒）

import { gunzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/api/fetchAll';
import { parseCatalogCsv, type CatalogPrice, type CatalogRow } from '@/lib/kaitorix-catalog-csv';
import { diffPriceHistory, jstDayStartIso, type PriceHistoryRow } from '@/lib/kaitorix-price-history';

const BASE_URL = 'https://kaitorix.app';
const UPSERT_CHUNK = 1000;
const HISTORY_CHUNK = 2000;
/** 解析出的行数低于该值时不清理旧行：避免一次异常的小文件把整张目录表清空 */
const MIN_ROWS_FOR_CLEANUP = 1000;
const MAX_DOWNLOAD_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 65_000;

export class CatalogSyncError extends Error {
  readonly status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
  }
}

export interface CatalogSyncResult {
  generated: 'created' | 'already_generated';
  fileBytes: number;
  parsedRows: number;
  skippedRows: number;
  storeCount: number;
  upserted: number;
  removed: number | null;
  /** 本次追加的价格历史行数（只含变动；首次同步为全部报价的基线） */
  historyRows: number;
  durationMs: number;
}

function normalizeApiKey(apiKey: string | undefined): string {
  return (apiKey || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bearer\s+/i, '')
    .trim();
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function readError(res: Response): Promise<{ message: string; retryAfter?: number }> {
  const json = await res.json().catch(() => null) as { error?: string; message?: string; detail?: string; retry_after?: number } | null;
  return {
    message: json?.error || json?.message || json?.detail || `HTTP ${res.status}`,
    retryAfter: typeof json?.retry_after === 'number' ? json.retry_after : undefined,
  };
}

async function generateToday(apiKey: string): Promise<'created' | 'already_generated'> {
  const res = await fetch(`${BASE_URL}/api/data-export/today/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (res.ok) return 'created';
  if (res.status === 409) return 'already_generated'; // 本日分已生成，直接下载
  const { message } = await readError(res);
  if (res.status === 402) throw new CatalogSyncError('未订阅「全部买取数据」下载加购（402）', 402);
  if (res.status === 401 || res.status === 403) throw new CatalogSyncError('Kaitorix API Key 无效或无权限', 401);
  throw new CatalogSyncError(`生成 CSV 失败：${message}`, 502);
}

async function downloadToday(apiKey: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}/api/data-export/today/download`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());

    const { message, retryAfter } = await readError(res);
    if (res.status === 429 && attempt < MAX_DOWNLOAD_RETRIES) {
      // 1 分钟下载间隔：按 retry_after 等待后重试
      await sleep(Math.min(((retryAfter ?? 60) + 1) * 1000, MAX_RETRY_WAIT_MS));
      continue;
    }
    if (res.status === 404) throw new CatalogSyncError('本日 CSV 尚未生成', 404);
    throw new CatalogSyncError(`下载 CSV 失败：${message}`, res.status === 429 ? 429 : 502);
  }
}

function decodeCsv(file: Buffer): string {
  // 官方文件是 gzip；兼容中间层已解压的情况（按魔数判断）
  const raw = file.length > 2 && file[0] === 0x1f && file[1] === 0x8b ? gunzipSync(file) : file;
  return new TextDecoder('utf-8').decode(raw);
}

export async function syncKaitorixCatalog(): Promise<CatalogSyncResult> {
  const startedAt = Date.now();
  const apiKey = normalizeApiKey(process.env.KAITORIX_OPEN_API_KEY);
  if (!apiKey) throw new CatalogSyncError('未配置 Kaitorix Open API Key', 500);

  const generated = await generateToday(apiKey);
  const file = await downloadToday(apiKey);
  const parsed = parseCatalogCsv(decodeCsv(file));
  if (parsed.rows.length === 0) throw new CatalogSyncError('CSV 中没有可用的商品行', 502);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 同步前的目录快照：与新价格对比，只把变动追加进 kaitorix_price_history
  let existing: Array<{ jan: string; prices: CatalogPrice[] | null }>;
  try {
    existing = await fetchAllRows((from, to, opts) =>
      supabase.from('kaitorix_catalog').select('jan, prices', opts).order('jan').range(from, to),
    );
  } catch (error) {
    throw new CatalogSyncError(`读取现有目录失败：${(error as { message?: string })?.message ?? error}`, 500);
  }
  const oldByJan = new Map(existing.map(r => [r.jan, r.prices ?? []]));
  const dayStart = jstDayStartIso();

  // 主键含 observed_at：重跑同一天的同步时，已写入的历史行被忽略，不会重复
  let historyRows = 0;
  const insertHistory = async (rows: PriceHistoryRow[]) => {
    for (let i = 0; i < rows.length; i += HISTORY_CHUNK) {
      const { error } = await supabase
        .from('kaitorix_price_history')
        .upsert(rows.slice(i, i + HISTORY_CHUNK), { onConflict: 'jan,store,observed_at', ignoreDuplicates: true });
      if (error) throw new CatalogSyncError(`写入 kaitorix_price_history 失败（本次已追加 ${historyRows} 行）：${error.message}`, 500);
      historyRows += Math.min(HISTORY_CHUNK, rows.length - i);
    }
  };

  // 本次同步的统一时间戳：之后用它清理「这次没出现」的旧行
  const syncedAt = new Date().toISOString();
  let upserted = 0;
  for (let i = 0; i < parsed.rows.length; i += UPSERT_CHUNK) {
    const slice = parsed.rows.slice(i, i + UPSERT_CHUNK);
    // 先写历史再更新目录：中途失败重跑时，历史靠主键去重，不会漏记变动
    await insertHistory(slice.flatMap(row => diffPriceHistory(row.jan, oldByJan.get(row.jan), row.prices, dayStart)));
    const chunk: Array<CatalogRow & { synced_at: string }> = slice.map(row => ({ ...row, synced_at: syncedAt }));
    const { error } = await supabase.from('kaitorix_catalog').upsert(chunk, { onConflict: 'jan' });
    if (error) throw new CatalogSyncError(`写入 kaitorix_catalog 失败（已写入 ${upserted} 行）：${error.message}`, 500);
    upserted += chunk.length;
  }

  // 全部写入成功后，才清理本次文件里已不存在的商品（当天没有任何店报价了），
  // 清理前给它们的每家店记一条「不再报价」，价格曲线才能断开
  let removed: number | null = null;
  if (parsed.rows.length >= MIN_ROWS_FOR_CLEANUP) {
    const present = new Set(parsed.rows.map(r => r.jan));
    await insertHistory(
      existing.filter(r => !present.has(r.jan)).flatMap(r => diffPriceHistory(r.jan, r.prices ?? [], [], dayStart)),
    );
    const { error, count } = await supabase
      .from('kaitorix_catalog')
      .delete({ count: 'exact' })
      .lt('synced_at', syncedAt);
    if (error) throw new CatalogSyncError(`清理旧行失败：${error.message}`, 500);
    removed = count ?? 0;
  }

  return {
    generated,
    fileBytes: file.length,
    parsedRows: parsed.rows.length,
    skippedRows: parsed.skipped,
    storeCount: parsed.stores.length,
    upserted,
    removed,
    historyRows,
    durationMs: Date.now() - startedAt,
  };
}
