// app/notifications/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getNotification,
  markRead,
  dispatchNotificationsChanged,
} from '@/lib/api/notifications';
import type { Notification, CouponItem, DressIndex } from '@/types/database.types';
import Link from 'next/link';

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoadError(false);
    const { data, error } = await getNotification(id);
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setNotification(data);
    setLoading(false);
    if (data && !data.read) {
      const ok = await markRead(id);
      if (ok) dispatchNotificationsChanged();
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">加载中...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center gap-4">
        <div className="text-[var(--color-text-muted)]">加载失败，请重试</div>
        <button
          onClick={load}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
        >
          重试
        </button>
        <Link href="/notifications" className="text-[var(--color-primary)] text-sm font-medium hover:text-[var(--color-primary-hover)]">← 返回通知列表</Link>
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

const urgencyStyle: Record<number, { label: string; labelColor: string }> = {
  0: { label: '今日到期', labelColor: 'bg-[var(--color-danger)] text-white' },
  1: { label: '明日到期', labelColor: 'bg-[var(--color-warning)] text-white' },
  3: { label: '还剩3天', labelColor: 'bg-[var(--color-warning)] text-white' },
  7: { label: '还剩7天', labelColor: 'bg-[var(--color-info)] text-white' },
};

function CouponAlertDetail({ notification, onBack }: { notification: Notification; onBack: () => void }) {
  const d = notification.data;
  const dateStr = d.target_date
    ? new Date(d.target_date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : new Date(notification.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const expiringEntries = Object.entries(d.expiring || {}).sort((a, b) => Number(a[0]) - Number(b[0]));

  const renderDress = (dress: DressIndex | undefined) => {
    if (!dress) return <span>-</span>;
    if (typeof dress === 'string') return <div dangerouslySetInnerHTML={{ __html: dress }} />;
    if (typeof dress === 'object') {
      const d = dress as Record<string, unknown>;
      if (d.img) {
        return (
          <div className="flex flex-col items-center gap-1 mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.img as string} alt="dress index" className="w-10 h-10 object-contain" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] leading-tight text-center max-w-[85px] text-[var(--color-text)]">
                {(d.text_cn || d.text_jp) as string}
              </span>
              {Boolean(d.text_cn && d.text_jp) && (
                <span className="text-[8px] leading-tight text-center max-w-[85px] text-[var(--color-text-muted)]">
                  {d.text_jp as string}
                </span>
              )}
            </div>
          </div>
        );
      }
      if (d.html) return <div dangerouslySetInnerHTML={{ __html: d.html as string }} />;
      if (d.text) return <span>{d.text as string}</span>;
      if (d.label) return <span>{d.label as string}</span>;
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
            <div className="mt-3 inline-flex items-center gap-1.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm font-medium px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-primary-border)]">
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
                  <span className="text-xs bg-[var(--color-info-subtle)] text-[var(--color-info)] px-2 py-0.5 rounded-full">{d.weather.wind}</span>
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
            <div className="flex items-center mb-2 px-1">
              <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">明日生效</h2>
            </div>
            <div className="space-y-3">
              {d.starting.map((c, i) => <CouponCard key={i} coupon={c} labelClass="bg-[var(--color-primary)] text-white" labelText="明日开始" />)}
            </div>
          </section>
        )}

        {/* Expiring */}
        {expiringEntries.map(([days, coupons]) => {
          const style = urgencyStyle[Number(days)] || { label: `还剩${days}天`, labelColor: 'bg-[var(--color-text-muted)] text-white' };
          return (
            <section key={days} className="mb-4">
              <div className="flex items-center mb-2 px-1">
                <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">{style.label}</h2>
              </div>
              <div className="space-y-3">
                {(coupons as CouponItem[]).map((c, i) => <CouponCard key={i} coupon={c} labelClass={style.labelColor} labelText={style.label} />)}
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

function CouponCard({ coupon, labelClass, labelText }: {
  coupon: CouponItem;
  labelClass: string;
  labelText: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
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
