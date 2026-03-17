import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import { ClientProviders } from '@/components/ClientProviders'

export const metadata: Metadata = {
  title: '转卖账务管理系统',
  description: '专为日本转卖业务设计的现代化账务管理系统',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
          <Navigation />
          <div className="lg:pl-64">
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  )
}
