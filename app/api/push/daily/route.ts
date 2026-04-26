// app/api/push/daily/route.ts
// Production coupon reminder push — triggered by Vercel Cron (UTC 23:00 = JST 08:00)
// Auth: Vercel Cron automatically sends Authorization: Bearer <CRON_SECRET>
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTokyoWeather } from '@/lib/weather';

// ─── JST 日期工具 ─────────────────────────────────────────────────────────────
// Vercel 服务器运行在 UTC，必须显式换算 JST (UTC+9)

function getJSTDateString(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000);
  // 使用 en-CA locale 返回 YYYY-MM-DD 格式（UTC 时间 = 已偏移后的 JST 时间）
  return d.toISOString().slice(0, 10);
}

// ─── 序列化优惠券 ──────────────────────────────────────────────────────────────

function formatDiscount(c: Record<string, unknown>): string {
  const v = (c.discount_value as number) ?? 0;
  if (c.discount_type === 'percentage') return `${v}% OFF`;
  if (c.discount_type === 'point_multiply') return `${v}倍`;
  if (c.discount_type === 'cashback') return `${v}円還元`;
  return `减 ${v} 円`;
}

function formatCondition(c: Record<string, unknown>): string {
  const min = (c.min_purchase_amount as number) ?? 0;
  return min > 0 ? `满 ${min} 円可用` : '无门槛';
}

function serializeCoupon(c: Record<string, unknown>) {
  return {
    platform: (c.platform as string) ?? '通用',
    name: (c.name as string) ?? '未命名',
    discount_str: formatDiscount(c),
    condition_str: formatCondition(c),
    coupon_code: (c.coupon_code as string | null) ?? null,
    expiry_date: ((c.expiry_date as string) ?? '').split('T')[0],
    is_online_only: (c.is_online_only as boolean) ?? false,
    is_offline_only: (c.is_offline_only as boolean) ?? false,
  };
}

// ─── 主处理器 ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 校验 CRON_SECRET（Vercel Cron 自动注入）
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // JST 日期
  const today = getJSTDateString(0);
  const tomorrow = getJSTDateString(1);
  const in7days = getJSTDateString(7);

  // 查询所有有推送订阅的用户
  const { data: allSubs, error: subErr } = await adminClient
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!allSubs || allSubs.length === 0) {
    return NextResponse.json({ ok: true, message: 'No subscribers' });
  }

  const userIds = [...new Set(allSubs.map((s: { user_id: string }) => s.user_id))];

  // 并行查询所有用户的优惠券 + 天气
  const [{ data: expiringAll }, { data: startingAll }, weatherInfo] = await Promise.all([
    adminClient
      .from('coupons')
      .select('id,user_id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used,is_online_only,is_offline_only,notes')
      .in('user_id', userIds)
      .eq('is_used', false)
      .lte('expiry_date', in7days)
      .gte('expiry_date', today)
      .order('expiry_date', { ascending: true }),
    adminClient
      .from('coupons')
      .select('id,user_id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used,is_online_only,is_offline_only,notes')
      .in('user_id', userIds)
      .eq('is_used', false)
      .eq('start_date', tomorrow)
      .order('expiry_date', { ascending: true }),
    getTokyoWeather(),
  ]);

  // 按 user_id 分组优惠券
  const expiringByUser: Record<string, Record<string, ReturnType<typeof serializeCoupon>[]>> = {};
  const startingByUser: Record<string, ReturnType<typeof serializeCoupon>[]> = {};

  for (const c of (expiringAll ?? [])) {
    const uid = c.user_id as string;
    if (!expiringByUser[uid]) expiringByUser[uid] = {};
    const diff = Math.ceil(
      (new Date(c.expiry_date as string).getTime() - new Date(today).getTime()) / 86_400_000,
    );
    const key = String(diff);
    if (!expiringByUser[uid][key]) expiringByUser[uid][key] = [];
    expiringByUser[uid][key].push(serializeCoupon(c as Record<string, unknown>));
  }

  for (const c of (startingAll ?? [])) {
    const uid = c.user_id as string;
    if (!startingByUser[uid]) startingByUser[uid] = [];
    startingByUser[uid].push(serializeCoupon(c as Record<string, unknown>));
  }

  // 加载 web-push
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPrivateKey || !vapidPublicKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }
  const webpushModule = await import('web-push');
  const webpush = webpushModule.default ?? webpushModule;
  webpush.setVapidDetails('mailto:syuletyoucryjp@gmail.com', vapidPublicKey, vapidPrivateKey);

  const results: Array<{ userId: string; notificationId: string | null; status: string }> = [];

  for (const userId of userIds) {
    const expiring = expiringByUser[userId] ?? {};
    const starting = startingByUser[userId] ?? [];
    const expiringCount = Object.values(expiring).reduce((s, arr) => s + arr.length, 0);
    const totalCount = starting.length + expiringCount;

    // 构建通知 body
    let body = '今日无需关注的优惠券，安心做自己吧';
    if (totalCount > 0) {
      const parts: string[] = [];
      if (starting.length > 0) parts.push(`${starting.length}张明日生效`);
      for (const [days, items] of Object.entries(expiring).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        if (items.length === 0) continue;
        const d = Number(days);
        if (d === 0) parts.push(`${items.length}张今日到期`);
        else if (d === 1) parts.push(`${items.length}张明日到期`);
        else parts.push(`${items.length}张${d}天后到期`);
      }
      body = parts.join('、');
    }

    let title = '优惠券提醒';
    if (weatherInfo && weatherInfo.current !== '-') {
      title = `东京 ${weatherInfo.current}℃ ${weatherInfo.weather}`;
    } else if (totalCount > 0) {
      title = `优惠券提醒 (${totalCount}张)`;
    }

    const notifData = {
      target_date: today,
      total_count: totalCount,
      starting,
      expiring,
      weather: weatherInfo
        ? {
            weather: weatherInfo.weather,
            current: weatherInfo.current,
            high: weatherInfo.high,
            low: weatherInfo.low,
            precip: weatherInfo.precip,
            wind: weatherInfo.wind,
            dress_morning: weatherInfo.dress_morning,
            dress_daytime: weatherInfo.dress_daytime,
            dress_evening: weatherInfo.dress_evening,
          }
        : undefined,
    };

    const { data: notifRecord } = await adminClient
      .from('notifications')
      .insert({ user_id: userId, type: 'coupon_alert', title, body, data: notifData })
      .select('id')
      .single();

    const notificationId = notifRecord?.id ?? null;

    // 发送推送给该用户所有订阅设备
    const userSubs = allSubs.filter((s: { user_id: string }) => s.user_id === userId);
    const payload = JSON.stringify({
      title,
      body,
      notificationId,
      type: 'coupon_alert',
      url: notificationId ? `/notifications/${notificationId}` : '/notifications',
    });

    await Promise.all(
      userSubs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          .catch(() => null),
      ),
    );

    results.push({ userId, notificationId, status: 'sent' });
  }

  return NextResponse.json({ ok: true, date: today, results });
}
