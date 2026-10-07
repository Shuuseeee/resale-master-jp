// Service Worker — Workbox precaching + runtime strategies
//
// This is the SOURCE file compiled by workbox-webpack-plugin (InjectManifest).
// The generated output is written to public/sw.js and served as the SW entry point.
//
// Architecture:
//   1. Precache all webpack-generated assets (self.__WB_MANIFEST)
//   2. Runtime caching routes with differentiated strategies per resource type
//   3. Update lifecycle: skipWaiting + clientsClaim + client notification

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
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

// 2g. HTML navigation requests — NetworkFirst so users get fresh pages when online;
//     offline (or network slower than the timeout) falls back to the last visited copy,
//     which is what makes the cached transactions list openable offline.
//     30 days (was 1 hour: any longer offline period made every page unopenable).
//     Pages cache only what the user has visited while online; it is cleared on each new
//     SW version (see activate) so a stale HTML never pairs with chunks from another build.
const PAGES_CACHE = 'pages-cache'
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: PAGES_CACHE,
    // Poor-signal case: don't make the user wait out the browser's long default timeout
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// 2h. Offline navigation fallback (runs only when the route handler above threw, i.e. network
//     failed AND there is no cached copy of that page).
//     - '/' is a server redirect (never cached) and is the PWA start_url: send offline launches to
//       the transactions list, the page that works offline.
//     - anything else: a small explanatory page instead of the browser's offline error.
//     No colors are hardcoded on purpose: system colors follow light/dark automatically.
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>离线中</title>
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Hiragino Sans","PingFang SC",sans-serif;background:Canvas;color:CanvasText}
main{max-width:22rem;padding:2rem 1.5rem;text-align:center}
h1{font-size:1.25rem;margin:0 0 .5rem}
p{margin:0 0 1.25rem;opacity:.7;font-size:.9rem}
a,button{display:inline-block;margin:.25rem;padding:.6rem 1.1rem;border-radius:.6rem;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:.9rem;text-decoration:none;cursor:pointer}
</style></head><body><main>
<h1>当前处于离线状态</h1>
<p>这个页面还没有缓存。联网访问过的页面才能离线查看。</p>
<a href="/transactions">查看交易列表</a><button onclick="location.reload()">重试</button>
</main></body></html>`

setCatchHandler(async ({ request, url }) => {
  if (request.mode === 'navigate') {
    if (url.pathname === '/') return Response.redirect('/transactions', 302)
    return new Response(OFFLINE_FALLBACK_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return Response.error()
})

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
    // Drop cached HTML from the previous build: offline, an old page would load chunk URLs that
    // no longer match this build's precache. It refills as the user browses online.
    caches.delete(PAGES_CACHE).then(() => self.clients.claim()).then(() =>
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
