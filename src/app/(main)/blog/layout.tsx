import { Metadata } from 'next'
import { BlogListJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Blog - AI Product Photography Tips & Tutorials | BrandCam',
  description: 'Learn about AI product photography, e-commerce image optimization, and professional photography tips. Tutorials, case studies, and industry insights.',
  keywords: [
    'AI photography blog',
    'product photography tips',
    'e-commerce photography',
    'AI model photos tutorial',
    'BrandCam blog',
    'product image optimization',
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Blog - AI Product Photography Tips & Tutorials | BrandCam',
    description: 'Learn about AI product photography, e-commerce image optimization, and professional photography tips.',
    type: 'website',
    url: 'https://brandcam.agency/blog',
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <BlogListJsonLd />
      {children}
    </>
  )
}
