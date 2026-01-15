import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | BrandCam - AI Product Photography',
  description: 'Sign in to BrandCam to create stunning AI-powered product photos. Use email, phone, or Google to access your account.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Sign In | BrandCam',
    description: 'Sign in to create stunning AI-powered product photos.',
    type: 'website',
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
