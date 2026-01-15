import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Pro Studio - AI Model Photography | Professional Product Shoots',
  description: 'Create professional model photos with AI. Upload your product and get studio-quality images with virtual models in seconds. Perfect for e-commerce and fashion brands.',
  keywords: ['AI model photography', 'virtual model', 'product photography', 'studio photos', 'e-commerce photography', 'fashion photography', 'AI fashion model'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Pro Studio - AI Model Photography',
    description: 'Create professional model photos with AI. Studio-quality images with virtual models in seconds.',
    type: 'website',
  },
}

export default function ProStudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="Pro Studio" featureUrl="/pro-studio" />
      {children}
    </>
  )
}
