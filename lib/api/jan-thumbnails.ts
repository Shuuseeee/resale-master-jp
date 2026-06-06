// lib/api/jan-thumbnails.ts
// JAN 维度缩略图缓存的批量读取。缩略图按 JAN 全站共享，列表页一次性把可见交易的
// JAN 批量查出来，构成 jan → {image_url, image_fetched_at} 的 map 传给行/卡片。

import { supabase } from '@/lib/supabase/client';

export interface JanThumbnail {
  image_url: string;
  image_fetched_at: string | null;
}

export type JanThumbnailMap = Map<string, JanThumbnail>;

// Supabase 的 .in() 单次别塞太多，分批查
const CHUNK = 200;

/**
 * 批量查 JAN 缩略图缓存。只返回 image_url 非空的行。
 * @param jans 去重后的 JAN 列表
 */
export async function fetchJanThumbnails(jans: string[]): Promise<JanThumbnailMap> {
  const map: JanThumbnailMap = new Map();
  const unique = [...new Set(jans.filter((j) => /^\d{8,13}$/.test(j)))];
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('jan_thumbnail_cache')
      .select('jan, image_url, image_fetched_at')
      .in('jan', slice)
      .not('image_url', 'is', null);

    if (error) {
      console.error('fetchJanThumbnails 失败:', error.message);
      continue;
    }
    for (const row of data || []) {
      if (row.image_url) {
        map.set(row.jan, { image_url: row.image_url, image_fetched_at: row.image_fetched_at });
      }
    }
  }

  return map;
}
