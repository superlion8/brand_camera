import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Social Media Photos - AI Content Generator | Instagram & TikTok Ready',
  description: 'Create scroll-stopping social media content with AI. Generate Instagram, TikTok, and Pinterest-ready product photos that drive engagement.',
  keywords: ['social media photos', 'Instagram content', 'TikTok photos', 'content generator', 'social media marketing', 'product content', 'influencer photos'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Social Media Photos - AI Content Generator',
    description: 'Create scroll-stopping social media content with AI. Instagram & TikTok ready.',
    type: 'website',
  },
}

export default function SocialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
