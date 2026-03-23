// app/api/push/test/route.ts
// DEBUG ONLY: sends a test push with real coupon + weather data
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getTokyoWeather } from '@/lib/weather';

function formatDiscount(c: any): string {
  const v = c.discount_value ?? 0;
  const vStr = Number.isInteger(v) ? String(v) : String(v);
  if (c.discount_type === 'percentage') return `${vStr}% OFF`;
  if (c.discount_type === 'point_multiply') return `${vStr}倍`;
  if (c.discount_type === 'cashback') return `${vStr}円還元`;
  return `减 ${vStr} 円`;
}

function formatCondition(c: any): string {
  const min = c.min_purchase_amount ?? 0;
  return min > 0 ? `满 ${Number.isInteger(min) ? min : min} 円可用` : '无门槛';
}

function serializeCoupon(c: any) {
  return {
    platform: c.platform ?? '通用',
    name: c.name ?? '未命名',
    discount_str: formatDiscount(c),
    condition_str: formatCondition(c),
    coupon_code: c.coupon_code ?? null,
    expiry_date: (c.expiry_date ?? '').split('T')[0],
    is_online_only: c.is_online_only ?? false,
    is_offline_only: c.is_offline_only ?? false,
  };
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No subscriptions found', userId: user.id });
  }

  const today = new Date().toISOString().split('T')[0];
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  // Fetch real coupon data in parallel with weather
  const [{ data: expiringRaw }, { data: startingRaw }, weatherInfo] = await Promise.all([
    supabase
      .from('coupons')
      .select('id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used,is_online_only,is_offline_only,notes')
      .eq('user_id', user.id)
      .eq('is_used', false)
      .lte('expiry_date', in3days)
      .gte('expiry_date', today)
      .order('expiry_date', { ascending: true }),
    supabase
      .from('coupons')
      .select('id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used,is_online_only,is_offline_only,notes')
      .eq('user_id', user.id)
      .eq('is_used', false)
      .eq('start_date', today)
      .order('expiry_date', { ascending: true }),
    getTokyoWeather(),
  ]);

  const starting = (startingRaw ?? []).map(serializeCoupon);

  // Group expiring by days remaining
  const expiring: Record<string, ReturnType<typeof serializeCoupon>[]> = {};
  for (const c of (expiringRaw ?? [])) {
    const diff = Math.ceil((new Date(c.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
    const key = String(diff);
    if (!expiring[key]) expiring[key] = [];
    expiring[key].push(serializeCoupon(c));
  }

  const totalCount = starting.length + (expiringRaw?.length ?? 0);

  // Build coupon summary for the body
  let body = '今日无需关注的优惠券，安心做自己吧';
  if (totalCount > 0) {
    const parts: string[] = [];
    if (starting.length > 0) parts.push(`${starting.length}张今日生效`);
    for (const [days, items] of Object.entries(expiring).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const d = Number(days);
      if (items.length === 0) continue;
      if (d === 0) parts.push(`${items.length}张今日到期`);
      else if (d === 1) parts.push(`${items.length}张明日到期`);
      else parts.push(`${items.length}张${d}天后到期`);
    }
    body = parts.join('、');
  }

  // Build weather summary for the title
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
    weather: weatherInfo ? {
      weather: weatherInfo.weather,
      current: weatherInfo.current,
      high: weatherInfo.high,
      low: weatherInfo.low,
      precip: weatherInfo.precip,
      wind: weatherInfo.wind,
      dress_morning: weatherInfo.dress_morning,
      dress_daytime: weatherInfo.dress_daytime,
      dress_evening: weatherInfo.dress_evening,
    } : undefined,
  };

  const { data: notifRecord } = await supabase
    .from('notifications')
    .insert({ user_id: user.id, type: 'coupon_alert', title, body, data: notifData })
    .select('id')
    .single();

  const notificationId = notifRecord?.id ?? null;

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPrivateKey || !vapidPublicKey) {
    return NextResponse.json({ error: 'VAPID keys not configured', notificationId }, { status: 500 });
  }

  const webpushModule = await import('web-push');
  const webpush = webpushModule.default ?? webpushModule;
  webpush.setVapidDetails('mailto:syuletyoucryjp@gmail.com', vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({ 
    title, 
    body, 
    notificationId, 
    type: 'coupon_alert',
    url: notificationId ? `/notifications/${notificationId}` : '/notifications'
  });

  const results = await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      return { endpoint: sub.endpoint.slice(-20), status: 'sent' };
    } catch (e: any) {
      return { endpoint: sub.endpoint.slice(-20), status: 'failed', error: e?.message, statusCode: e?.statusCode ?? null };
    }
  }));

  // 清除服务端的路由缓存，确保前端重新拉取时能获取到最新的通知数据
  // 建议根据你的实际情况，将 '/' 替换为对应的通知页路径（例如 '/notifications'）
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, notificationId, title, body, totalCount, results });
}
