import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | BrandCam',
  description: 'Read the terms and conditions for using BrandCam AI product photography service. Understand your rights and responsibilities.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
