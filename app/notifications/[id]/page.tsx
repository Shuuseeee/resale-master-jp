// app/notifications/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

interface CouponItem {
  platform: string;
  name: string;
  discount_str: string;
  condition_str: string;
  coupon_code?: string;
  expiry_date: string;
  notes?: string;
  is_online_only?: boolean;
  is_offline_only?: boolean;
}

interface NotificationData {
  target_date?: string;
  weather?: {
    weather: string;
    current: string;
    high: string;
    low: string;
    precip: string;
    wind: string;
    dress_morning?: any;
    dress_daytime?: any;
    dress_evening?: any;
  };
  starting?: CouponItem[];
  expiring?: Record<string, CouponItem[]>;
  total_count?: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: NotificationData;
  read: boolean;
  created_at: string;
}

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();
      setNotification(data);
      setLoading(false);
      if (data && !data.read) {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">加载中...</div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center gap-4">
        <div className="text-[var(--color-text-muted)]">通知不存在</div>
        <Link href="/notifications" className="text-[var(--color-primary)] text-sm font-medium hover:text-[var(--color-primary-hover)]">← 返回通知列表</Link>
      </div>
    );
  }

  if (notification.type === 'coupon_alert') {
    return <CouponAlertDetail notification={notification} onBack={() => router.push('/notifications')} />;
  }

  // Generic fallback
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => router.push('/notifications')} className="text-[var(--color-primary)] text-sm mb-4 flex items-center gap-1 font-medium hover:text-[var(--color-primary-hover)]">← 返回</button>
        <div className="sn-detail-card">
          <h1 className="sn-detail-title-lg mb-2">{notification.title}</h1>
          {notification.body && <p className="text-[var(--color-text-muted)]">{notification.body}</p>}
          <p className="text-xs text-[var(--color-text-muted)] mt-4">{new Date(notification.created_at).toLocaleString('zh-CN')}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Coupon Alert Detail ─────────────────────────────────────────────────────

const urgencyStyle: Record<number, { border: string; label: string; labelColor: string }> = {
  0: { border: 'border-l-[var(--color-danger)]', label: '今日到期', labelColor: 'bg-[var(--color-danger)] text-white' },
  1: { border: 'border-l-[var(--color-warning)]', label: '明日到期', labelColor: 'bg-[var(--color-warning)] text-white' },
  3: { border: 'border-l-[var(--color-warning)]', label: '还剩3天', labelColor: 'bg-[var(--color-warning)] text-white' },
  7: { border: 'border-l-[var(--color-info)]', label: '还剩7天', labelColor: 'bg-[var(--color-info)] text-white' },
};

function CouponAlertDetail({ notification, onBack }: { notification: Notification; onBack: () => void }) {
  const d = notification.data;
  const dateStr = d.target_date
    ? new Date(d.target_date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : new Date(notification.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const expiringEntries = Object.entries(d.expiring || {}).sort((a, b) => Number(a[0]) - Number(b[0]));

  const renderDress = (dress: any) => {
    if (!dress) return <span>-</span>;
    if (typeof dress === 'string') return <div dangerouslySetInnerHTML={{ __html: dress }} />;
    if (typeof dress === 'object') {
      if (dress.img) {
        return (
          <div className="flex flex-col items-center gap-1 mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dress.img} alt="dress index" className="w-10 h-10 object-contain" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] leading-tight text-center max-w-[85px] text-[var(--color-text)]">
                {dress.text_cn || dress.text_jp}
              </span>
              {dress.text_cn && dress.text_jp && (
                <span className="text-[8px] leading-tight text-center max-w-[85px] text-[var(--color-text-muted)]">
                  {dress.text_jp}
                </span>
              )}
            </div>
          </div>
        );
      }
      if (dress.html) return <div dangerouslySetInnerHTML={{ __html: dress.html }} />;
      if (dress.text) return <span>{dress.text}</span>;
      if (dress.label) return <span>{dress.label}</span>;
      return <span className="text-[10px] break-all">{JSON.stringify(dress)}</span>;
    }
    return <span>-</span>;
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] pb-12">
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1 text-[var(--color-primary)] text-sm mb-4 font-medium hover:text-[var(--color-primary-hover)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          通知列表
        </button>

        {/* Header card */}
        <div className="sn-detail-card mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h1 className="sn-detail-title-lg mb-1">{notification.title}</h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{dateStr}</p>
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>
          {d.total_count != null && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm font-medium px-3 py-1.5 rounded-[var(--radius-md)] border border-[rgba(16,185,129,0.25)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              关注 {d.total_count} 张优惠券
            </div>
          )}
        </div>

        {/* Weather card */}
        {d.weather && (
          <div className="sn-detail-card mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[var(--color-text)] font-medium">
                  <svg className="w-5 h-5 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  东京 {d.weather.weather}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-[var(--color-info)] text-white px-2 py-0.5 rounded-full">{d.weather.precip}</span>
                  <span className="text-xs bg-[rgba(59,130,246,0.1)] text-[var(--color-info)] px-2 py-0.5 rounded-full">{d.weather.wind}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[var(--color-text)]">{d.weather.current}℃</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{d.weather.low}° / {d.weather.high}°</div>
              </div>
            </div>
            
            {/* Dressing Index */}
            {(d.weather.dress_morning || d.weather.dress_daytime || d.weather.dress_evening) && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between items-stretch text-sm text-[var(--color-text)]">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] mb-1">早上</span>
                  {renderDress(d.weather.dress_morning)}
                </div>
                <div className="w-px bg-[var(--color-border)] my-1 mx-1"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] mb-1">白天</span>
                  {renderDress(d.weather.dress_daytime)}
                </div>
                <div className="w-px bg-[var(--color-border)] my-1 mx-1"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] mb-1">晚上</span>
                  {renderDress(d.weather.dress_evening)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Starting today */}
        {d.starting && d.starting.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-1 h-5 bg-[var(--color-primary)] rounded-full" />
              <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">明日生效</h2>
            </div>
            <div className="space-y-3">
              {d.starting.map((c, i) => <CouponCard key={i} coupon={c} borderClass="border-l-[rgba(16,185,129,0.3)]" labelClass="bg-[var(--color-primary)] text-white" labelText="明日开始" />)}
            </div>
          </section>
        )}

        {/* Expiring */}
        {expiringEntries.map(([days, coupons]) => {
          const style = urgencyStyle[Number(days)] || { border: 'border-l-[var(--color-border)]', label: `还剩${days}天`, labelColor: 'bg-[var(--color-text-muted)] text-white' };
          return (
            <section key={days} className="mb-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`w-1 h-5 rounded-full ${
                  Number(days) === 0 ? 'bg-[var(--color-danger)]' : Number(days) === 1 ? 'bg-[var(--color-warning)]' : Number(days) <= 3 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-info)]'
                }`} />
                <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">{style.label}</h2>
              </div>
              <div className="space-y-3">
                {(coupons as CouponItem[]).map((c, i) => <CouponCard key={i} coupon={c} borderClass={style.border} labelClass={style.labelColor} labelText={style.label} />)}
              </div>
            </section>
          );
        })}

        {d.total_count === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <div className="flex justify-center mb-3">
              <svg className="w-10 h-10 text-[var(--color-text-muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div className="text-sm">今日无需注意的优惠券</div>
          </div>
        )}

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          {new Date(notification.created_at).toLocaleString('zh-CN')}
        </p>
      </div>
    </div>
  );
}

function CouponCard({ coupon, borderClass, labelClass, labelText }: {
  coupon: CouponItem;
  borderClass: string;
  labelClass: string;
  labelText: string;
}) {
  return (
    <div className={`rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)] border-l-4 ${borderClass} border border-[var(--color-border)]`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-[var(--radius-sm)]">
              {coupon.platform}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] ${labelClass}`}>{labelText}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)] mt-1.5">{coupon.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-lg font-bold text-[var(--color-danger)]">{coupon.discount_str}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
        {coupon.condition_str && <span>{coupon.condition_str}</span>}
        {coupon.is_online_only && <span className="text-[var(--color-info)]">仅限线上</span>}
        {coupon.is_offline_only && <span className="text-[var(--color-text-muted)]">仅限门店</span>}
        {coupon.coupon_code && (
          <span className="font-mono bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[var(--color-text)]">
            {coupon.coupon_code}
          </span>
        )}
      </div>
      {coupon.notes && <p className="text-xs text-[var(--color-text-muted)] mt-2 italic">{coupon.notes}</p>}
      <p className="text-[10px] text-[var(--color-text-muted)] mt-2">有效期: {coupon.expiry_date}</p>
    </div>
  );
}
