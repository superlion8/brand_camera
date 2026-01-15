import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reference Shot - AI Style Matching | Recreate Photo Styles',
  description: 'Upload a reference image and recreate its style with your product. AI analyzes composition, lighting, and mood to generate matching photos.',
  keywords: ['reference photography', 'style matching', 'AI photo recreation', 'composition matching', 'photo style transfer', 'visual reference'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Reference Shot - AI Style Matching',
    description: 'Upload a reference image and recreate its style with your product using AI.',
    type: 'website',
  },
}

export default function ReferenceShotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
