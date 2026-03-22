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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotification();

  const [testResult, setTestResult] = useState<string | null>(null);

  async function sendTestPush() {
    setTestResult('发送中...');
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      console.log('[Test Push] Result:', data);
      if (data.ok) {
        setTestResult(`✅ 已发送到 ${data.results.length} 个设备：${JSON.stringify(data.results)}`);
      } else {
        setTestResult(`❌ 失败：${data.error}${data.hint ? ' — ' + data.hint : ''}`);
      }
    } catch (e) {
      setTestResult(`❌ 请求异常：${e}`);
    }
  }

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('id,type,title,body,read,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);

    // mark all as read
    if (data && data.some((n) => !n.read)) {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('read', false);
    }
  }

  const typeIcon: Record<string, string> = {
    coupon_alert: '🎫',
    arrival_reminder: '📦',
    monthly_report: '📊',
  };

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={heading.h1}>通知</h1>

          {/* Push subscription toggle */}
          <button
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={pushLoading || permission === 'denied'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
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
            {permission === 'denied' ? '通知已被拒绝' : subscribed ? '推送已开启' : '开启推送通知'}
          </button>
        </div>

        {/* Debug: test push button */}
        {subscribed && (
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

        {loading ? (
          <div className="text-gray-400 text-center py-16">加载中...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🔔</div>
            <div>暂无通知</div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={`/notifications/${n.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-600 transition-colors shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{typeIcon[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
