import { Metadata } from 'next'
import { LandingClient } from '@/components/landing'
import { LandingPageJsonLd } from '@/components/seo/JsonLd'

// Enhanced SEO metadata for landing page
export const metadata: Metadata = {
  title: 'BrandCam - AI-Powered Product Photography | Transform Your E-commerce Images',
  description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds. No photographers, no studios, no waiting. Start free today.',
  keywords: [
    'AI photography',
    'product photography',
    'e-commerce photography',
    'AI model photos',
    'virtual model',
    'lifestyle shots',
    'brand style',
    'AI image generation',
    'product photos',
    'fashion photography',
    'AI fashion model',
    'e-commerce images',
    'BrandCam',
  ],
  openGraph: {
    title: 'BrandCam - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds.',
    type: 'website',
    siteName: 'BrandCam',
    locale: 'en_US',
    url: 'https://brandcam.agency',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrandCam - AI-Powered Product Photography',
    description: 'Transform your product photos with AI. Create stunning images in seconds.',
  },
  alternates: {
    canonical: 'https://brandcam.agency',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// Server component - renders static shell, client handles auth redirect
export default function LandingPage() {
  return (
    <>
      <LandingPageJsonLd />
      <LandingClient />
    </>
  )
}
