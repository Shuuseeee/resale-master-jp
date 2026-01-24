import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Resale Master JP - 转卖账务管理系统',
  description: '专为日本转卖业务设计的现代化账务管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Navigation />
        <div className="lg:pl-64">
          {children}
        </div>
      </body>
    </html>
  )
}
