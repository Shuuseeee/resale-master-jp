'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchJanThumbnails, type JanThumbnailMap } from '@/lib/api/jan-thumbnails';

const EMPTY_THUMBNAILS: JanThumbnailMap = new Map();

/** 后台取图晚于交易加载：缺图时每 5 秒重查，最多 2 分钟，避免无图商品无限轮询。 */
export function useJanThumbnails(jans: string[]): JanThumbnailMap {
  const unique = [...new Set(jans.filter(j => /^\d{8,13}$/.test(j)))].sort();
  const janKey = unique.join(',');
  // 每次进入页面或 JAN 集合变化时重新等待，不能用 Query 缓存里跨挂载累计的请求次数限流。
  const pollUntil = useMemo(() => Date.now() + 120_000, [janKey]);
  const { data } = useQuery({
    queryKey: ['jan-thumbnails', unique],
    queryFn: () => fetchJanThumbnails(unique),
    enabled: unique.length > 0,
    retry: 1,
    refetchInterval: query =>
      Date.now() < pollUntil && (query.state.data?.size ?? 0) < unique.length ? 5000 : false,
  });
  return data ?? EMPTY_THUMBNAILS;
}
