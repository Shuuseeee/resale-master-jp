// app/notifications/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { layout, heading } from '@/lib/theme';
import { usePushNotification } from '@/hooks/usePushNotification';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

type DateGroup = '今日' | '昨日' | 'それ以前';

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const date = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  if (date >= todayStart) return '今日';
  if (date >= yesterdayStart) return '昨日';
  return 'それ以前';
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (date >= todayStart) {
    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    return `${diffHours}時間前`;
  }
  return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}

const typeIconConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  coupon_alert: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    color: 'text-blue-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  arrival_reminder: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    color: 'text-teal-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  monthly_report: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    color: 'text-purple-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
};

const defaultIconConfig = {
  bg: 'bg-gray-100 dark:bg-gray-700',
  color: 'text-gray-400',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
};

function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm animate-pulse">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 dark:bg-gray-600 rounded w-1/2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-600 rounded w-1/4" />
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
    setTestResult('送信中...');
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
      if (data.ok) {
        setTestResult(`送信完了: ${data.results.length}台 ${JSON.stringify(data.results)}`);
      } else {
        setTestResult(`失敗: ${data.error}${data.hint ? ' — ' + data.hint : ''}`);
      }
    } catch (e) {
      setTestResult(`エラー: ${e}`);
    }
  }

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
  const groupOrder: DateGroup[] = ['今日', '昨日', 'それ以前'];
  const groupMap = new Map<DateGroup, Notification[]>();
  for (const n of notifications) {
    const g = getDateGroup(n.created_at);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(n);
  }
  const groups = groupOrder.filter(g => groupMap.has(g)).map(g => ({ label: g, items: groupMap.get(g)! }));

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className={heading.h1}>通知</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-teal-500 text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-teal-600 dark:text-teal-400 font-medium"
            >
              全部已读
            </button>
          )}
        </div>

        {/* Dev-only: test push panel */}
        {process.env.NODE_ENV === 'development' && subscribed && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">调试模式</span>
              <button
                onClick={sendTestPush}
                className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                发送测试推送
              </button>
            </div>
            {testResult && (
              <pre className="text-[10px] text-amber-800 dark:text-amber-200 whitespace-pre-wrap break-all">{testResult}</pre>
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
          <div className="text-center py-16 text-gray-400">
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wide px-1 mb-2">
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
                            className={`flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm transition-colors border ${
                              n.read
                                ? 'border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700'
                                : 'border-l-4 border-l-teal-500 border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700'
                            }`}
                          >
                            {/* Type icon */}
                            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconCfg.bg} ${iconCfg.color}`}>
                              {iconCfg.icon}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2">
                                <p className={`font-semibold text-sm truncate ${n.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                  {n.title}
                                </p>
                                {!n.read && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-teal-500" />}
                              </div>
                              {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                              <p className="text-[10px] text-gray-400 mt-1">
                                {formatRelativeTime(n.created_at)}
                              </p>
                            </div>
                          </Link>

                          {/* Delete button */}
                          <button
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="absolute right-3 top-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 transition-colors opacity-60 hover:opacity-100"
                            aria-label="削除"
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
              <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-6">
                仅显示最近 50 条通知
              </p>
            )}
          </>
        )}

        {/* Push notification settings */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wide mb-3 px-1">通知設定</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">プッシュ通知</p>
                {permission === 'denied' && (
                  <p className="text-xs text-gray-400 mt-0.5">ブラウザで通知が拒否されています</p>
                )}
              </div>
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={pushLoading || permission === 'denied'}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  permission === 'denied'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                    : subscribed
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                }`}
              >
                <div className={`w-8 h-4 rounded-full relative transition-colors ${
                  subscribed ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    subscribed ? 'left-4' : 'left-0.5'
                  }`} />
                </div>
                {permission === 'denied' ? '拒否済み' : subscribed ? 'オン' : 'オフ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
