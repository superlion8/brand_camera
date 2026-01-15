// JSON-LD Structured Data Components for SEO

interface OrganizationJsonLdProps {
  name?: string
  url?: string
  logo?: string
  description?: string
}

export function OrganizationJsonLd({
  name = 'Brand Camera',
  url = 'https://brandcam.agency',
  logo = 'https://brandcam.agency/logo.png',
  description = 'AI-powered product photography platform for e-commerce brands',
}: OrganizationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo,
    description,
    sameAs: [
      // Add social media URLs when available
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface WebApplicationJsonLdProps {
  name?: string
  url?: string
  description?: string
  applicationCategory?: string
  operatingSystem?: string
}

export function WebApplicationJsonLd({
  name = 'Brand Camera',
  url = 'https://brandcam.agency',
  description = 'Transform your product photos with AI. Create stunning model photos, lifestyle shots, and professional product images in seconds.',
  applicationCategory = 'PhotographyApplication',
  operatingSystem = 'Web',
}: WebApplicationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    description,
    applicationCategory,
    operatingSystem,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier available with credits',
    },
    featureList: [
      'AI Model Photos',
      'Lifestyle Shots',
      'Product Studio',
      'Brand Style Cloning',
      'Custom AI Models',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface SoftwareApplicationJsonLdProps {
  name?: string
  description?: string
  url?: string
}

export function SoftwareApplicationJsonLd({
  name = 'Brand Camera',
  description = 'AI-powered product photography platform',
  url = 'https://brandcam.agency',
}: SoftwareApplicationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '149.99',
      priceCurrency: 'USD',
      offerCount: '4',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1000',
      bestRating: '5',
      worstRating: '1',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// Combined component for landing page
export function LandingPageJsonLd() {
  return (
    <>
      <OrganizationJsonLd />
      <WebApplicationJsonLd />
    </>
  )
}
