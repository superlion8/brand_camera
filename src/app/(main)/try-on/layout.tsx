import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Virtual Try-On - AI Fashion Preview | See Clothes on Models',
  description: 'Try clothes on virtual models with AI. See how garments look on different body types before purchasing or listing. Perfect for fashion e-commerce.',
  keywords: ['virtual try-on', 'AI fashion', 'clothes preview', 'fashion technology', 'online fitting', 'virtual fitting room', 'e-commerce fashion'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Virtual Try-On - AI Fashion Preview',
    description: 'Try clothes on virtual models with AI. See how garments look before purchasing.',
    type: 'website',
  },
}

export default function TryOnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="Virtual Try-On" featureUrl="/try-on" />
      {children}
    </>
  )
}
