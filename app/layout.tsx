import type { Metadata, Viewport } from 'next'
import './globals.css'
import './themes.css'
import Navigation from '@/components/Navigation'
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
    startupImage: '/icons/icon-512.png',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1b1b26',
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
              var storageKey = 'snutils-theme';
              var theme;
              try {
                theme = window.localStorage.getItem(storageKey);
              } catch (e) {}

              if (theme !== 'light' && theme !== 'dark') {
                theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              }

              document.documentElement.setAttribute('data-theme', theme);
              document.documentElement.classList.toggle('dark', theme === 'dark');
              if (document.body) {
                document.body.setAttribute('data-theme', theme);
              }

              // 配色主题（data-palette 轴）— headerColors 是 lib/themes.ts 注册表的
              // 零依赖精简副本（本脚本先于 paint 执行，不能 import），新增主题需同步。
              var palette;
              try {
                palette = window.localStorage.getItem('snutils-palette');
              } catch (e) {}
              if (palette && palette !== 'emerald') {
                document.documentElement.setAttribute('data-palette', palette);
              }
              var headerColors = { horizon: '#354a5f' };
              var meta = document.querySelector('meta[name="theme-color"]');
              if (meta) {
                meta.setAttribute('content', headerColors[palette] || '#1b1b26');
              }
            })();
          `}
        </Script>
        <ClientProviders>
          <div className="lg:flex lg:min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
            <Navigation />
            <div className="flex-1 min-w-0 mobile-bottom-pad lg:pt-[63px] lg:pb-0">
              {children}
            </div>
          </div>
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
