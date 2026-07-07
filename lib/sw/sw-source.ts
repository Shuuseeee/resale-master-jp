// Service Worker — Workbox precaching + runtime strategies + Web Push
//
// This is the SOURCE file compiled by workbox-webpack-plugin (InjectManifest).
// The generated output is written to public/sw.js and served as the SW entry point.
//
// Architecture:
//   1. Precache all webpack-generated assets (self.__WB_MANIFEST)
//   2. Runtime caching routes with differentiated strategies per resource type
//   3. Web Push event handlers (preserved from the original hand-written SW)
//   4. Update lifecycle: skipWaiting + clientsClaim + client notification

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// ---------------------------------------------------------------------------
// Type declarations for the SW global scope + Workbox injection point
// ---------------------------------------------------------------------------
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// ---------------------------------------------------------------------------
// 1. Precache all webpack-generated assets (injected at build time)
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST)

// ---------------------------------------------------------------------------
// 2. Runtime caching routes
// ---------------------------------------------------------------------------

// 2a. Fonts — self-hosted TTF, CacheFirst, 60 days, max 10 entries
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
      }),
    ],
  })
)

// 2b. Next.js static assets — content-hashed JS/CSS chunks, CacheFirst, 30 days
registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: 'next-static-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// 2c. Icons — PWA icons, CacheFirst, 30 days, max 20 entries
registerRoute(
  ({ url }) => url.pathname.startsWith('/icons/'),
  new CacheFirst({
    cacheName: 'icons-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// 2d. API routes — NetworkOnly (financial data must be fresh; React Query manages client cache)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
)

// 2e. Auth routes — NetworkOnly (auth state must be server-verified)
registerRoute(
  ({ url }) => url.pathname.startsWith('/auth/'),
  new NetworkOnly()
)

// 2f. Next.js RSC data — NetworkFirst, short TTL (5 min), max 100 entries
registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/data/'),
  new NetworkFirst({
    cacheName: 'next-data-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
)

// 2g. HTML navigation requests — NetworkFirst so users get fresh pages,
//     with offline fallback. 1 hour max age, 50 entries.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  })
)

// ---------------------------------------------------------------------------
// 3. Update lifecycle
// ---------------------------------------------------------------------------

// Immediately activate new SW (skip the "waiting" phase)
self.addEventListener('install', () => {
  self.skipWaiting()
})

// When activated, claim all clients so the new SW controls all open tabs,
// then notify each client so the UI can prompt the user to refresh.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'SW_UPDATED' })
        }
      })
    )
  )
})

// Allow clients to trigger skipWaiting via message
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ---------------------------------------------------------------------------
// 4. Web Push handlers (preserved from original public/sw.js)
// ---------------------------------------------------------------------------

// 4a. Push event — show notification with action buttons
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event)
  if (!event.data) {
    console.warn('[SW] Push event has no data')
    return
  }

  let payload: {
    title?: string
    body?: string
    notificationId?: string | null
    type?: string
    [key: string]: unknown
  }

  try {
    payload = event.data.json()
    console.log('[SW] Push payload:', JSON.stringify(payload))
  } catch {
    payload = {
      title: '転売管理',
      body: event.data.text(),
      notificationId: null,
    }
    console.log('[SW] Push payload (text fallback):', payload)
  }

  const { title, body, notificationId, type } = payload
  const options: NotificationOptions = {
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: notificationId || type || 'default',
    renotify: true,
    data: {
      notificationId,
      url: notificationId ? `/notifications/${notificationId}` : '/notifications',
    },
    actions: [
      { action: 'open', title: '查看详情' },
      { action: 'dismiss', title: '忽略' },
    ],
  }

  console.log('[SW] Showing notification:', title, options)
  event.waitUntil(
    self.registration
      .showNotification(title || '転売管理', options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((e) => console.error('[SW] showNotification failed:', e))
  )
})

// 4b. Notification click — open detail page or focus existing window
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const targetUrl: string = event.notification.data?.url || '/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
