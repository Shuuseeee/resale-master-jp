// app/api/push/test/route.ts
// DEBUG ONLY: sends a test push with real coupon data
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function formatDiscount(c: any): string {
  if (c.discount_type === 'percentage') return `${c.discount_value}%OFF`;
  if (c.discount_type === 'point_multiply') return `${c.discount_value}倍`;
  if (c.discount_type === 'fixed_amount') return `${c.discount_value}円OFF`;
  if (c.discount_type === 'cashback') return `${c.discount_value}円還元`;
  return `${c.discount_value}`;
}

function formatCondition(c: any): string {
  if (c.min_purchase_amount > 0) return `${c.min_purchase_amount}円以上`;
  return '条件なし';
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

  // Fetch subscriptions
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No subscriptions found', userId: user.id });
  }

  // Fetch real coupon data
  const today = new Date().toISOString().split('T')[0];
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const { data: coupons } = await supabase
    .from('coupons')
    .select('id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used')
    .eq('user_id', user.id)
    .eq('is_used', false)
    .lte('expiry_date', in3days)
    .gte('expiry_date', today)
    .order('expiry_date', { ascending: true });

  const { data: startingCoupons } = await supabase
    .from('coupons')
    .select('id,name,platform,discount_type,discount_value,min_purchase_amount,expiry_date,start_date,coupon_code,is_used')
    .eq('user_id', user.id)
    .eq('is_used', false)
    .eq('start_date', today)
    .order('expiry_date', { ascending: true });

  const allCoupons = coupons ?? [];
  const starting = (startingCoupons ?? []).map((c: any) => ({
    platform: c.platform ?? '',
    name: c.name,
    discount_str: formatDiscount(c),
    condition_str: formatCondition(c),
    expiry_date: c.expiry_date,
    coupon_code: c.coupon_code ?? '',
  }));

  // Group expiring by days remaining
  const expiring: Record<string, any[]> = {};
  for (const c of allCoupons) {
    const diff = Math.ceil((new Date(c.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
    const key = String(diff);
    if (!expiring[key]) expiring[key] = [];
    expiring[key].push({
      platform: c.platform ?? '',
      name: c.name,
      discount_str: formatDiscount(c),
      condition_str: formatCondition(c),
      expiry_date: c.expiry_date,
    });
  }

  const totalCount = starting.length + allCoupons.length;
  const title = totalCount > 0 ? `🎫 本日のクーポン情報 (${totalCount}件)` : '🔔 クーポン通知';
  const body = totalCount > 0
    ? `今日開始${starting.length}件・期限間近${allCoupons.length}件`
    : 'アクティブなクーポンはありません';

  // Save notification record
  const { data: notifRecord } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'coupon_alert',
      title,
      body,
      data: { target_date: today, total_count: totalCount, starting, expiring },
    })
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

  const payload = JSON.stringify({ title, body, notificationId, type: 'coupon_alert' });

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

  return NextResponse.json({ ok: true, notificationId, totalCount, starting: starting.length, expiring: Object.keys(expiring).length, results });
}
