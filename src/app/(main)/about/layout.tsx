import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us - BrandCam | AI Product Photography Platform',
  description: 'Learn about BrandCam\'s mission to democratize professional product photography with AI. Founded in 2024, we help e-commerce brands create stunning visuals.',
  keywords: ['about BrandCam', 'AI photography company', 'product photography platform', 'e-commerce photography'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'About Us - BrandCam',
    description: 'Learn about BrandCam\'s mission to democratize professional product photography with AI.',
    type: 'website',
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
