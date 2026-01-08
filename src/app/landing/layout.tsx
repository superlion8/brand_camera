import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand Camera - AI-Powered Product Photography',
  description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds. No photographers, no studios, no waiting.',
  keywords: ['AI photography', 'product photography', 'e-commerce', 'model photos', 'brand style', 'AI image generation'],
  openGraph: {
    title: 'Brand Camera - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds.',
    type: 'website',
    siteName: 'Brand Camera',
    images: [
      {
        url: 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Brand Camera - AI Product Photography',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Camera - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning images in seconds.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
