import type { Metadata, Viewport } from 'next'
import './globals.css'
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
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0d9488',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ClientProviders>
          <div className="lg:flex lg:min-h-screen">
            <Navigation />
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>
        </ClientProviders>
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>
      </body>
    </html>
  )
}
