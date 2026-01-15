import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing | BrandCam - AI Product Photography Plans',
  description: 'Choose the perfect plan for your AI product photography needs. From Basic to Ultra, get credits for stunning model photos, lifestyle shots, and more. Cancel anytime.',
  keywords: ['pricing', 'subscription', 'credits', 'AI photography plans', 'e-commerce photography pricing'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Pricing | BrandCam',
    description: 'Choose the perfect plan for AI-powered product photography. Simple, transparent pricing.',
    type: 'website',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
