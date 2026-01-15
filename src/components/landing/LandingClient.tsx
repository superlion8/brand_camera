'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/providers/AuthProvider'
import { LandingHeader } from './LandingHeader'
import { HeroSection } from './HeroSection'

// Lazy load below-fold sections to reduce TBT
const FeaturesSection = dynamic(() => import('./FeaturesSection').then(mod => ({ default: mod.FeaturesSection })), { ssr: true })
const HowItWorksSection = dynamic(() => import('./HowItWorksSection').then(mod => ({ default: mod.HowItWorksSection })), { ssr: true })
const ShowcaseSection = dynamic(() => import('./ShowcaseSection').then(mod => ({ default: mod.ShowcaseSection })), { ssr: true })
const TestimonialsSection = dynamic(() => import('./TestimonialsSection').then(mod => ({ default: mod.TestimonialsSection })), { ssr: true })
const PricingSection = dynamic(() => import('./PricingSection').then(mod => ({ default: mod.PricingSection })), { ssr: true })
const CTASection = dynamic(() => import('./CTASection').then(mod => ({ default: mod.CTASection })), { ssr: true })
const Footer = dynamic(() => import('./Footer').then(mod => ({ default: mod.Footer })), { ssr: true })

export function LandingClient() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Redirect logged-in users to /app
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/app')
    }
  }, [user, isLoading, router])

  // Show loading state while checking auth or redirecting
  if (isLoading || user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 overflow-x-hidden">
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.4]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e4e4e7' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <LandingHeader />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ShowcaseSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
