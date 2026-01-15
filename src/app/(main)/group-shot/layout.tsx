import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Group Shot - AI Multi-Model Photography | Create Group Photos',
  description: 'Create professional group photos with multiple AI models. Perfect for showcasing collections, team photos, or multi-product displays. No coordination needed.',
  keywords: ['group photography', 'multi-model photos', 'AI group shot', 'collection photos', 'team photos', 'multiple models', 'fashion group'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Group Shot - AI Multi-Model Photography',
    description: 'Create professional group photos with multiple AI models. Perfect for collections.',
    type: 'website',
  },
}

export default function GroupShotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="Group Shot" featureUrl="/group-shot" />
      {children}
    </>
  )
}
