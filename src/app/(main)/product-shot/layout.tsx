import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Product Studio - AI Product Photography | E-commerce Ready Images',
  description: 'Generate professional product photos instantly with AI. Clean backgrounds, perfect lighting, and e-commerce ready images. No photography skills required.',
  keywords: ['product photography', 'e-commerce photos', 'product images', 'AI product shot', 'white background', 'product listing photos', 'amazon photos'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Product Studio - AI Product Photography',
    description: 'Generate professional product photos instantly with AI. E-commerce ready images in seconds.',
    type: 'website',
  },
}

export default function ProductShotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="Product Studio" featureUrl="/product-shot" />
      {children}
    </>
  )
}
