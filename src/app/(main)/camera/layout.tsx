import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'AI Camera - Smart Product Capture | Shoot and Transform',
  description: 'Capture product photos directly and transform them with AI. Real-time guidance for perfect shots, instant enhancement, and professional results.',
  keywords: ['AI camera', 'product capture', 'smart photography', 'mobile photography', 'instant photo enhancement', 'product shooting'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'AI Camera - Smart Product Capture',
    description: 'Capture product photos directly and transform them with AI. Professional results instantly.',
    type: 'website',
  },
}

export default function CameraLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="AI Camera" featureUrl="/camera" />
      {children}
    </>
  )
}
