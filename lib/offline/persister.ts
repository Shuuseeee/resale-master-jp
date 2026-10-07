// lib/offline/persister.ts
// TanStack Query 缓存的离线持久化：按用户分键写入 IndexedDB，登出时整体清空。
//
// 安全边界（财务数据会落在设备上）：
//  - 每个用户独立一条记录（key = rq:<userId>），不会串号；
//  - 登出 / 会话被撤销（SIGNED_OUT）时调用 clearOfflineCache()，清库 + 取消排队中的写入；
//  - 只持久化白名单里、且成功的查询（PERSISTED_QUERY_KEYS），不落地其它请求结果。

import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import type { Query } from '@tanstack/query-core';
import { idbClear, idbDelete, idbGet, idbSet } from './idb';

/**
 * 缓存版本号。持久化的数据结构（如 TransactionWithProfit 的字段）变化时手动 +1，
 * 旧版本缓存会在恢复时被丢弃，避免新代码读到旧结构。
 */
export const OFFLINE_CACHE_BUSTER = 'v1';

/** 缓存最长保留时间。超过则恢复时丢弃（过旧的财务数据比没有更误导） */
export const OFFLINE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** 需要离线可用的查询（取 queryKey 第一段）。新增离线页面时在此登记 */
export const PERSISTED_QUERY_KEYS: ReadonlySet<string> = new Set(['transactions', 'platforms', 'dashboard']);

export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === 'success' && PERSISTED_QUERY_KEYS.has(String(query.queryKey[0]));
}

const LAST_USER_KEY = 'resale-offline:last-user';
const WRITE_THROTTLE_MS = 1000;

export interface LastUser {
  id: string;
  email: string | null;
}

/**
 * 最近一次成功登录的用户。离线且 token 已过期（getSession 返回 null）时，
 * 据此找回该用户的缓存，并在导航栏显示邮箱而不是「未登录」。
 * 只存 id 与邮箱，不存任何凭证；登出时随缓存一并清除。
 */
export function readLastUser(): LastUser | null {
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastUser>;
    return typeof parsed.id === 'string' ? { id: parsed.id, email: parsed.email ?? null } : null;
  } catch {
    return null;
  }
}

export function writeLastUser(user: LastUser) {
  try {
    window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  } catch {
    // 存储不可用时忽略，仅失去「离线 + token 过期」时的缓存找回
  }
}

// ---- 写入合并（trailing throttle）----
// persistQueryClient 每次缓存事件都会触发一次保存，交易列表数百行，直接逐次写 IDB 会很浪费。
let pending: { key: string; value: PersistedClient } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
// 登出清库后到下一次创建 persister（= 下一次登录）之前，禁止任何写入，
// 防止登出瞬间仍在触发的缓存事件把刚清掉的数据又写回去
let writesBlocked = false;

async function flushNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const job = pending;
  pending = null;
  if (!job) return;
  try {
    await idbSet(job.key, job.value);
  } catch {
    // 写失败（配额 / 隐私模式）：忽略，仅失去离线缓存
  }
}

/** 页面隐藏 / 关闭前立即落盘，避免 iOS 在后台直接杀进程时丢掉最后一次更新 */
export function flushOfflineCache(): Promise<void> {
  return flushNow();
}

export function createIdbPersister(userId: string): Persister {
  const key = `rq:${userId}`;
  writesBlocked = false;
  return {
    persistClient: client => {
      if (writesBlocked) return;
      pending = { key, value: client };
      if (!timer) timer = setTimeout(() => void flushNow(), WRITE_THROTTLE_MS);
    },
    restoreClient: async () => {
      try {
        return await idbGet<PersistedClient>(key);
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await idbDelete(key);
      } catch {
        // ignore
      }
    },
  };
}

/** 登出 / 会话撤销时调用：取消排队写入，清空所有用户的离线缓存与“最近用户”标记 */
export async function clearOfflineCache(): Promise<void> {
  // 必须先封住写入并取消排队中的写入，否则它们可能在清库之后又把数据写回去
  writesBlocked = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
  try {
    window.localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
  try {
    await idbClear();
  } catch {
    // ignore
  }
}
