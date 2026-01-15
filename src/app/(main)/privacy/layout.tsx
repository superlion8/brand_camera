import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | BrandCam',
  description: 'Learn how BrandCam collects, uses, and protects your personal information. We are committed to safeguarding your privacy.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
