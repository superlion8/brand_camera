import { Metadata } from 'next'
import { FAQPageJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions | BrandCam',
  description: 'Find answers to common questions about BrandCam. Learn about AI photography, pricing, commercial usage, data security, and more.',
  keywords: ['FAQ', 'help', 'questions', 'AI photography help', 'BrandCam support', 'pricing questions'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'FAQ - Frequently Asked Questions | BrandCam',
    description: 'Find answers to common questions about BrandCam and AI photography.',
    type: 'website',
  },
}

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FAQPageJsonLd />
      {children}
    </>
  )
}
