// Service Worker - cache shell + Web Push handler
const CACHE_NAME = 'resale-v1';
const STATIC_ASSETS = ['/', '/dashboard', '/transactions'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, fallback to cache
// API routes, auth, and Supabase calls are never cached — always fresh
const NO_CACHE_PATTERNS = ['/api/', '/_next/data/', '/auth/'];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (NO_CACHE_PATTERNS.some((p) => url.pathname.startsWith(p))) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Web Push: show notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }
  let payload;
  try {
    payload = event.data.json();
    console.log('[SW] Push payload:', JSON.stringify(payload));
  } catch {
    payload = { title: '転売管理', body: event.data.text(), notificationId: null };
    console.log('[SW] Push payload (text fallback):', payload);
  }

  const { title, body, notificationId, type } = payload;
  const options = {
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: notificationId || type || 'default',
    renotify: true,
    data: { notificationId, url: notificationId ? `/notifications/${notificationId}` : '/notifications' },
    actions: [
      { action: 'open', title: '查看详情' },
      { action: 'dismiss', title: '忽略' },
    ],
  };

  console.log('[SW] Showing notification:', title, options);
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((e) => console.error('[SW] showNotification failed:', e))
  );
});

// Notification click: open detail page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
