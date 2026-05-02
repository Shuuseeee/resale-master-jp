// app/notifications/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { badge, button, card, heading, layout } from '@/lib/theme';
import PullToRefresh from '@/components/PullToRefresh';
import { usePushNotification } from '@/hooks/usePushNotification';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

type DateGroup = '今天' | '昨天' | '更早';

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const date = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  if (date >= todayStart) return '今天';
  if (date >= yesterdayStart) return '昨天';
  return '更早';
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (date >= todayStart) {
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    return `${diffHours} 小时前`;
  }
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

const typeIconConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  coupon_alert: {
    bg: 'bg-[rgba(59,130,246,0.12)]',
    color: 'text-[var(--color-info)]',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  arrival_reminder: {
    bg: 'bg-[var(--color-primary-subtle)]',
    color: 'text-[var(--color-primary)]',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  monthly_report: {
    bg: 'bg-purple-500/15',
    color: 'text-purple-600',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
};

const defaultIconConfig = {
  bg: 'bg-[var(--color-bg-subtle)]',
  color: 'text-[var(--color-text-muted)]',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
};

function SkeletonCard() {
  return (
    <div className={`${card.primary} flex animate-pulse items-start gap-3 p-4`}>
      <div className="h-9 w-9 flex-shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 w-3/4 rounded bg-[var(--color-bg-subtle)]" />
        <div className="h-2.5 w-1/2 rounded bg-[var(--color-bg-subtle)]" />
        <div className="h-2 w-1/4 rounded bg-[var(--color-bg-subtle)]" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotification();
  const [testResult, setTestResult] = useState<string | null>(null);

  async function sendTestPush() {
    setTestResult('发送中...');
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
      if (data.ok) {
        setTestResult(`发送完成: ${data.results.length} 台 ${JSON.stringify(data.results)}`);
      } else {
        setTestResult(`失败: ${data.error}${data.hint ? ' - ' + data.hint : ''}`);
      }
    } catch (e) {
      setTestResult(`错误: ${e}`);
    }
  }

  useEffect(() => {
    const handler = () => loadNotifications();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

  useEffect(() => {
    loadNotifications();

    // Realtime: new notifications auto-appear at top
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('id,type,title,body,read,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function markReadOptimistic(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Animate out, then remove
    setDeletingIds(prev => new Set([...prev, id]));
    await new Promise(r => setTimeout(r, 220));
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  // Group by date
  const groupOrder: DateGroup[] = ['今天', '昨天', '更早'];
  const groupMap = new Map<DateGroup, Notification[]>();
  for (const n of notifications) {
    const g = getDateGroup(n.created_at);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(n);
  }
  const groups = groupOrder.filter(g => groupMap.has(g)).map(g => ({ label: g, items: groupMap.get(g)! }));

  return (
    <PullToRefresh onRefresh={loadNotifications}>
    <div className={layout.page}>
      <div className={layout.container}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className={heading.h1}>通知</h1>
            {unreadCount > 0 && (
              <span className={badge.success + ' min-w-[20px] text-center'}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className={button.link}
            >
              全部已读
            </button>
          )}
        </div>

        {/* Dev-only: test push panel */}
        {process.env.NODE_ENV === 'development' && subscribed && (
          <div className="mb-4 rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-warning)]">调试模式</span>
              <button
                onClick={sendTestPush}
                className="rounded-[var(--radius-md)] bg-[var(--color-warning)] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
              >
                发送测试推送
              </button>
            </div>
            {testResult && (
              <pre className="whitespace-pre-wrap break-all text-[10px] text-[var(--color-text)]">{testResult}</pre>
            )}
          </div>
        )}

        {/* Notification list */}
        {loading ? (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : notifications.length === 0 ? (
          <div className={card.primary + ' py-16 text-center text-[var(--color-text-muted)]'}>
            <div className="mb-4 flex justify-center">
              <svg className="h-12 w-12 text-[var(--color-text-muted)] opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="text-sm">暂无通知</div>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {groups.map(({ label, items }) => (
                <div key={label}>
                  <div className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--color-text-muted)]">
                    {label}
                  </div>
                  <div className="space-y-2">
                    {items.map((n) => {
                      const iconCfg = typeIconConfig[n.type] || defaultIconConfig;
                      const isDeleting = deletingIds.has(n.id);
                      return (
                        <div
                          key={n.id}
                          className={`relative group transition-all duration-200 ${isDeleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                        >
                          <Link
                            href={`/notifications/${n.id}`}
                            onClick={() => { if (!n.read) markReadOptimistic(n.id); }}
                            className={`flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)] transition-colors border ${
                              n.read
                                ? 'border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
                                : 'border-l-4 border-l-[var(--color-primary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
                            }`}
                          >
                            {/* Type icon */}
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] ${iconCfg.bg} ${iconCfg.color}`}>
                              {iconCfg.icon}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2">
                                <p className={`truncate text-sm font-semibold ${n.read ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                                  {n.title}
                                </p>
                                {!n.read && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-primary)]" />}
                              </div>
                              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">{n.body}</p>}
                              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                                {formatRelativeTime(n.created_at)}
                              </p>
                            </div>
                          </Link>

                          {/* Delete button */}
                          <button
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] opacity-60 transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--color-danger)] hover:opacity-100 active:text-[var(--color-danger)]"
                            aria-label="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 50-item cap hint */}
            {notifications.length >= 50 && (
              <p className="mt-6 text-center text-[10px] text-[var(--color-text-muted)]">
                仅显示最近 50 条通知
              </p>
            )}
          </>
        )}

        {/* Push notification settings */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <h2 className="mb-3 px-1 text-xs font-semibold tracking-wide text-[var(--color-text-muted)]">通知设置</h2>
          <div className={card.primary + ' p-4'}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">推送通知</p>
                {permission === 'denied' && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">浏览器已拒绝通知权限</p>
                )}
              </div>
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={pushLoading || permission === 'denied'}
                className={`flex flex-shrink-0 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-sm font-medium transition-all ${
                  permission === 'denied'
                    ? 'cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                    : subscribed
                    ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                }`}
              >
                <div className={`relative h-4 w-8 rounded-full transition-colors ${
                  subscribed ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                }`}>
                  <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                    subscribed ? 'left-4' : 'left-0.5'
                  }`} />
                </div>
                {permission === 'denied' ? '已拒绝' : subscribed ? '开启' : '关闭'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}
