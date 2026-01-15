import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lifestyle Shot - AI Scene Generator | Product in Real Environments',
  description: 'Transform product photos into stunning lifestyle scenes with AI. Place your products in beautiful real-world environments automatically. Ideal for social media and marketing.',
  keywords: ['lifestyle photography', 'scene generator', 'product scenes', 'AI photography', 'marketing photos', 'social media images', 'product placement'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Lifestyle Shot - AI Scene Generator',
    description: 'Transform product photos into stunning lifestyle scenes with AI. Beautiful real-world environments.',
    type: 'website',
  },
}

export default function LifestyleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
