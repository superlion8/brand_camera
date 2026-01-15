import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Buyer Show - AI Customer Photos | Generate Authentic Reviews',
  description: 'Create authentic-looking customer photos with AI. Generate diverse buyer show images for product reviews and social proof. Build trust instantly.',
  keywords: ['buyer show', 'customer photos', 'product reviews', 'social proof', 'authentic photos', 'review images', 'user generated content'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Buyer Show - AI Customer Photos',
    description: 'Create authentic-looking customer photos with AI. Build social proof instantly.',
    type: 'website',
  },
}

export default function BuyerShowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="Buyer Show" featureUrl="/buyer-show" />
      {children}
    </>
  )
}
