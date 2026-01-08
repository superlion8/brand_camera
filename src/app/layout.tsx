import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StoreProvider } from '@/components/providers/StoreProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Brand Camera - AI-Powered Product Photography',
  description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds. No photographers, no studios, no waiting.',
  keywords: ['AI photography', 'product photography', 'e-commerce', 'model photos', 'brand style', 'AI image generation'],
  manifest: '/manifest.json',
  openGraph: {
    title: 'Brand Camera - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds.',
    type: 'website',
    siteName: 'Brand Camera',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Camera - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning images in seconds.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Brand Camera',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-primary">
        <AuthProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
