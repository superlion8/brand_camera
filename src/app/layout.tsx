import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StoreProvider } from '@/components/providers/StoreProvider'

export const metadata: Metadata = {
  title: '品牌相机 - Brand Camera',
  description: '为品牌主理人打造的AI产品摄影工具',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '品牌相机',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0D0D0D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-primary">
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
