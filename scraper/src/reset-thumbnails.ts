// reset-thumbnails.ts — 一次性运维脚本：全量重置缩略图
//   1) 清空 product-images bucket（走 Storage API，不直接删 storage.objects，避免底层文件成孤儿）
//   2) 清空 jan_thumbnail_cache / jan_thumbnail_queue
//   3) batch_enqueue_jan_thumbnails() 从 transactions 全量 distinct JAN 重新入队
// 之后由 thumbnail-fetcher worker 走 Kaitorix API 重抓。
//
// 执行：cd scraper && npx tsx src/reset-thumbnails.ts

import { supabase } from './supabase.js';
import { log, logError } from './logger.js';

const BUCKET = 'product-images';
const LIST_PAGE_SIZE = 100;

// list() 会把「文件夹」当条目返回（id 为 null），remove(文件夹名) 是静默无效的，
// 必须递归进文件夹删真实文件（文件删光后文件夹自动消失）
async function clearPrefix(prefix: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE });
    if (error) throw new Error(`storage list "${prefix}": ${error.message}`);
    const entries = data || [];
    if (entries.length === 0) return removed;

    const files = entries
      .filter((o) => o.id !== null && o.name)
      .map((o) => (prefix ? `${prefix}/${o.name}` : o.name));
    const folders = entries.filter((o) => o.id === null && o.name);

    let progress = 0;
    if (files.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(files);
      if (rmErr) throw new Error(`storage remove: ${rmErr.message}`);
      progress += files.length;
      log(`removed ${files.length} objects under "${prefix || '/'}" (total ${removed + progress})`);
    }
    for (const folder of folders) {
      progress += await clearPrefix(prefix ? `${prefix}/${folder.name}` : folder.name);
    }
    removed += progress;
    // 本轮没有任何进展（只剩删不掉的条目）→ 防御性退出，避免死循环
    if (progress === 0) return removed;
  }
}

async function clearBucket(): Promise<number> {
  return clearPrefix('');
}

async function main() {
  log(`clearing storage bucket "${BUCKET}"...`);
  const removed = await clearBucket();
  log(`storage cleared: ${removed} objects removed`);

  const { error: cacheErr } = await supabase
    .from('jan_thumbnail_cache')
    .delete()
    .neq('jan', '');
  if (cacheErr) throw new Error(`clear jan_thumbnail_cache: ${cacheErr.message}`);
  log('jan_thumbnail_cache cleared');

  const { error: queueErr } = await supabase
    .from('jan_thumbnail_queue')
    .delete()
    .neq('jan', '');
  if (queueErr) throw new Error(`clear jan_thumbnail_queue: ${queueErr.message}`);
  log('jan_thumbnail_queue cleared');

  const { data: enqueued, error: rpcErr } = await supabase.rpc('batch_enqueue_jan_thumbnails');
  if (rpcErr) throw new Error(`batch_enqueue_jan_thumbnails: ${rpcErr.message}`);
  log(`re-enqueued ${enqueued} JANs, start the thumbnail worker to refetch`);
}

main().catch((err) => {
  logError('reset-thumbnails failed', err);
  process.exit(1);
});
