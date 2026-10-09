import type { Metadata, Viewport } from 'next'
import './fluent-tokens.css'
import './globals.css'
import AppShell from '@/components/shell/AppShell'
import { ClientProviders } from '@/components/ClientProviders'
import Script from 'next/script'

export const metadata: Metadata = {
  title: '账务管理',
  description: '日本業務账务管理システム',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '账务管理',
    startupImage: '/icons/app-icon-512.png',
  },
  // 图标由 scripts/generate-icons.py 从 assets/branding/app-icon.png 生成
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F7F9FC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              // 偏好：light / dark / system（未保存过也按 system）。逻辑与 lib/theme-mode.ts 一致，改动需同步。
              var preference;
              try {
                preference = window.localStorage.getItem('snutils-theme');
                // 旧版配色主题的存储键已不再使用
                window.localStorage.removeItem('snutils-palette');
              } catch (e) {}

              var theme = preference === 'light' || preference === 'dark'
                ? preference
                : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

              document.documentElement.setAttribute('data-theme', theme);

              // 桌面左导航展开 / 折叠：有手动记录用记录，否则 ≤1365px 自动折叠（与 lib/nav-mode.ts 一致，改动需同步）
              var nav;
              try {
                nav = window.localStorage.getItem('snutils-nav');
              } catch (e) {}
              if (nav !== 'expanded' && nav !== 'collapsed') {
                nav = window.matchMedia && window.matchMedia('(max-width: 1365px)').matches ? 'collapsed' : 'expanded';
              }
              document.documentElement.setAttribute('data-nav', nav);

              // theme-color：Loop 实测（lib/theme-mode.ts 的 THEME_COLORS 副本）
              var meta = document.querySelector('meta[name="theme-color"]');
              if (meta) {
                meta.setAttribute('content', theme === 'dark' ? '#1E2022' : '#F7F9FC');
              }
            })();
          `}
        </Script>
        <ClientProviders>
          <AppShell>{children}</AppShell>
        </ClientProviders>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').then(function (reg) {
                // If a waiting SW already exists (from a previous visit), trigger update
                if (reg.waiting) {
                  window.dispatchEvent(new CustomEvent('sw-update-available'));
                }
                // Listen for new SW installing
                reg.addEventListener('updatefound', function () {
                  var newWorker = reg.installing;
                  if (newWorker) {
                    newWorker.addEventListener('statechange', function () {
                      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        window.dispatchEvent(new CustomEvent('sw-update-available'));
                      }
                    });
                  }
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
