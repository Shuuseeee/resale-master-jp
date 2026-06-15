// lib/api/notifications.ts
// 通知数据访问层

import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/types/database.types';

// ── 查询 ─────────────────────────────────────────────────────────────────────

/**
 * 获取通知列表（最新在前，不含 data 字段以减少传输量）
 */
export async function getNotifications(
  limit = 50
): Promise<{ data: Notification[]; error: boolean }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,title,body,read,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('获取通知列表失败:', error);
    return { data: [], error: true };
  }

  return { data: (data as Notification[]) || [], error: false };
}

/**
 * 获取单条通知（含完整 data 字段）
 * - data:null, error:false  → 通知不存在（正常）
 * - data:null, error:true   → 查询失败（网络 / 权限问题）
 */
export async function getNotification(
  id: string
): Promise<{ data: Notification | null; error: boolean }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // maybeSingle：不存在时 data=null、error=null，而非抛错

  if (error) {
    console.error('获取通知详情失败:', error);
    return { data: null, error: true };
  }

  return { data: data as Notification | null, error: false };
}

/**
 * 获取当前用户未读通知数（精确 count，命中 partial index idx_notifications_user_unread）
 */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);

  if (error) {
    console.error('获取未读通知数失败:', error);
    return 0;
  }

  return count ?? 0;
}

// ── 写操作（返回 boolean 表示是否成功，供调用方乐观回滚）────────────────────

/**
 * 将当前用户所有未读通知标记为已读
 */
export async function markAllRead(): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);

  if (error) {
    console.error('标记全部已读失败:', error);
    return false;
  }

  return true;
}

/**
 * 将单条通知标记为已读
 */
export async function markRead(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) {
    console.error('标记已读失败:', error);
    return false;
  }

  return true;
}

/**
 * 删除单条通知
 */
export async function deleteNotification(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除通知失败:', error);
    return false;
  }

  return true;
}

// ── 工具：通知其他组件角标需要刷新 ─────────────────────────────────────────

/**
 * 派发 notifications-changed 事件，让 Navigation 等组件即时刷新未读角标。
 * 当 Realtime 未开启时，用户本人操作（标记已读/删除）仍能即时更新角标。
 */
export function dispatchNotificationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications-changed'));
  }
}
