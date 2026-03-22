// hooks/usePushNotification.ts
'use client';
import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
    checkSubscription();
  }, []);

  async function checkSubscription() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setSubscribed(!!sub);
  }

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] ServiceWorker or PushManager not supported');
      return;
    }
    setLoading(true);
    try {
      console.log('[Push] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      setPermission(permission);
      console.log('[Push] Permission result:', permission);
      if (permission !== 'granted') return;

      console.log('[Push] Waiting for SW ready...');
      const reg = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready, subscribing to push...');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[Push] Subscription created:', JSON.stringify(sub.toJSON(), null, 2));

      const json = sub.toJSON();
      console.log('[Push] Saving subscription to server...');
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      const resData = await res.json();
      console.log('[Push] Server response:', res.status, resData);
      if (!res.ok) {
        console.error('[Push] Failed to save subscription:', resData);
      } else {
        setSubscribed(true);
        console.log('[Push] Subscription saved successfully!');
      }
    } catch (e) {
      console.error('[Push] subscribe() error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  return { permission, subscribed, loading, subscribe, unsubscribe };
}
