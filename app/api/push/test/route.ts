// app/api/push/test/route.ts
// DEBUG ONLY: sends a test push to all subscriptions for the logged-in user
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  // Fetch subscriptions for this user
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No subscriptions found for this user', userId: user.id });
  }

  // Create a test notification record
  const { data: notifRecord } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'coupon_alert',
      title: '🔔 テスト通知',
      body: 'プッシュ通知のテストです',
      data: {
        target_date: new Date().toISOString().split('T')[0],
        total_count: 2,
        starting: [
          { platform: 'Yahoo', name: 'テストクーポン', discount_str: '500円OFF', condition_str: '3000円以上', expiry_date: new Date().toISOString().split('T')[0], coupon_code: 'TEST123' }
        ],
        expiring: {
          '1': [
            { platform: '楽天', name: '明日到期テスト', discount_str: '10% OFF', condition_str: '無門槛', expiry_date: new Date(Date.now() + 86400000).toISOString().split('T')[0] }
          ]
        },
        weather: { weather: '晴れ', current: '18', high: '22', low: '12', precip: '10%', wind: '南風 2m/s(1级)' }
      },
    })
    .select('id')
    .single();

  const notificationId = notifRecord?.id ?? null;

  // Send push to all subscriptions
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPrivateKey || !vapidPublicKey) {
    return NextResponse.json({
      error: 'VAPID keys not configured on server',
      hint: 'Add VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY to environment variables',
      subscriptionCount: subs.length,
      notificationId,
    }, { status: 500 });
  }

  // DEBUG: confirm which key the server is actually using
  const keyPreview = vapidPublicKey.slice(0, 20) + '...' + vapidPublicKey.slice(-10);

  const webpushModule = await import('web-push');
  const webpush = webpushModule.default ?? webpushModule;
  webpush.setVapidDetails('mailto:syuletyoucryjp@gmail.com', vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({ title: '🔔 テスト通知', body: 'プッシュ通知のテストです', notificationId, type: 'coupon_alert' });

  const results = await Promise.all(subs.map(async (sub) => {
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

  return NextResponse.json({ ok: true, notificationId, keyPreview, results });
}
