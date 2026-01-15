import { Metadata } from 'next'
import { FeaturePageBreadcrumb } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'AI Photo Editor - Smart Image Enhancement | Edit Photos with AI',
  description: 'Edit and enhance your photos with AI-powered tools. Remove backgrounds, adjust lighting, fix imperfections, and transform images effortlessly.',
  keywords: ['AI photo editor', 'image enhancement', 'photo editing', 'background removal', 'AI retouching', 'image editing tool', 'photo enhancement'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'AI Photo Editor - Smart Image Enhancement',
    description: 'Edit and enhance your photos with AI-powered tools. Transform images effortlessly.',
    type: 'website',
  },
}

export default function EditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <FeaturePageBreadcrumb featureName="AI Photo Editor" featureUrl="/edit" />
      {children}
    </>
  )
}
