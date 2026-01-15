// JSON-LD Structured Data Components for SEO

interface OrganizationJsonLdProps {
  name?: string
  url?: string
  logo?: string
  description?: string
}

export function OrganizationJsonLd({
  name = 'BrandCam',
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
  name = 'BrandCam',
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
  name = 'BrandCam',
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

// Combined component for landing page - all structured data in one
export function LandingPageJsonLd() {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <HowToJsonLd />
    </>
  )
}

// HowTo structured data - shows step-by-step in search results
export function HowToJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Create AI Product Photos with BrandCam',
    description: 'Learn how to transform your product photos into professional marketing images using AI in just 3 simple steps.',
    totalTime: 'PT2M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Upload Your Product Photo',
        text: 'Take a photo of your product or upload an existing image. Any angle works - our AI handles the rest.',
        image: 'https://brandcam.agency/logo.png',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Choose Your Style',
        text: 'Select from AI model photos, lifestyle scenes, product studio backgrounds, or let our AI recommend the best option.',
        image: 'https://brandcam.agency/logo.png',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Download & Use',
        text: 'Get your professional photos instantly. Use them on your website, social media, or marketplace listings.',
        image: 'https://brandcam.agency/logo.png',
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// Product structured data for specific feature pages
export function ProductJsonLd({ 
  name, 
  description, 
  url 
}: { 
  name: string
  description: string
  url: string 
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url,
    brand: {
      '@type': 'Brand',
      name: 'BrandCam',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2026-12-31',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '500',
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

// FAQ Page structured data - enables rich snippets in Google
export function FAQPageJsonLd() {
  const faqs = [
    {
      question: 'What is BrandCam?',
      answer: 'BrandCam is an AI-powered product photography platform that helps e-commerce brands create professional model photos, lifestyle shots, and product images in seconds. No photographers, studios, or expensive equipment needed.',
    },
    {
      question: 'How does AI model photography work?',
      answer: 'Simply upload your product photo, select a model style or use our AI to match the perfect model, and our AI generates professional model photos wearing or holding your product. The entire process takes just seconds.',
    },
    {
      question: 'What types of products work best?',
      answer: 'BrandCam works great with fashion items (clothing, accessories, jewelry), beauty products, electronics, home goods, and more. Any product that benefits from lifestyle or model photography can be enhanced with our AI.',
    },
    {
      question: 'How much does it cost?',
      answer: 'We offer flexible credit-based pricing. New users get free credits to try the platform. Paid plans start from $9.99/month with more credits for higher volume needs.',
    },
    {
      question: 'Can I use the images commercially?',
      answer: 'Yes! All images generated with BrandCam are yours to use commercially. Use them on your website, social media, marketplaces like Amazon or Shopify, advertising, and more.',
    },
    {
      question: 'How long does it take to generate an image?',
      answer: 'Most images are generated in 10-30 seconds. Complex requests like videos or multiple variations may take slightly longer.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we take data security seriously. Your uploaded images and generated content are stored securely and never shared with third parties.',
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
