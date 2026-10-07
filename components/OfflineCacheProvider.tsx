'use client';

import { useEffect, useRef, useState } from 'react';
import { IsRestoringProvider, useQueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { useAuth } from '@/contexts/AuthContext';
import {
  OFFLINE_CACHE_BUSTER,
  OFFLINE_CACHE_MAX_AGE,
  createIdbPersister,
  flushOfflineCache,
  readLastUserId,
  shouldPersistQuery,
  writeLastUserId,
} from '@/lib/offline/persister';

// 恢复阶段的兜底超时：IndexedDB 偶发卡住时不能让整个应用永远停在骨架屏
const RESTORE_TIMEOUT_MS = 3000;

/**
 * 把 TanStack Query 的缓存持久化到 IndexedDB（按用户分键），冷启动时先恢复再发请求。
 *
 * 恢复期间通过 IsRestoringProvider 暂停所有查询：页面先拿到上次的缓存数据（立即可看，离线也可看），
 * 恢复完成后在线的话会照常按 staleTime 重新拉取；hydrate 只会用更新的数据覆盖，不会回滚新数据。
 *
 * 必须放在 AuthProvider 内部（需要知道当前用户）。
 */
export default function OfflineCacheProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [restoring, setRestoring] = useState(true);
  const activeRef = useRef<{ id: string; unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (loading) return;

    // 缓存归属：在线用当前登录用户；离线且 token 已过期（getSession 返回 null）时，
    // 回落到「最近一次登录的用户」，这样离线冷启动仍能读到上次的数据
    const id = user?.id ?? (navigator.onLine === false ? readLastUserId() : null);

    // 同一用户已在持久化中：不要重复恢复（否则离线 → 恢复联网、token 刷新时会让所有查询再暂停一次）
    if (id === (activeRef.current?.id ?? null)) {
      if (!id) setRestoring(false);
      return;
    }

    activeRef.current?.unsubscribe();
    activeRef.current = null;

    if (!id) {
      setRestoring(false);
      return;
    }
    if (user?.id) writeLastUserId(user.id);

    setRestoring(true);
    const [unsubscribe, restored] = persistQueryClient({
      queryClient,
      persister: createIdbPersister(id),
      buster: OFFLINE_CACHE_BUSTER,
      maxAge: OFFLINE_CACHE_MAX_AGE,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    });
    activeRef.current = { id, unsubscribe };

    const timeout = setTimeout(() => setRestoring(false), RESTORE_TIMEOUT_MS);
    restored
      .catch(() => {
        // 恢复失败（数据损坏等）时 persist 库已丢弃该缓存，按无缓存继续即可
      })
      .finally(() => {
        clearTimeout(timeout);
        setRestoring(false);
      });
  }, [loading, user?.id, queryClient]);

  // 卸载时退订并清引用（React 严格模式下 effect 会被重放，引用不清会导致订阅丢失）
  useEffect(
    () => () => {
      activeRef.current?.unsubscribe();
      activeRef.current = null;
    },
    [],
  );

  // 页面转入后台 / 关闭时立即落盘（iOS 可能直接杀掉后台进程，等不到节流定时器）
  useEffect(() => {
    const flush = () => void flushOfflineCache();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>;
}
