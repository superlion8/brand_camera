'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Zap, Palette, Camera, Users, Play, Check } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 }
  }
}

// Feature data
const features = [
  {
    icon: <Camera className="w-5 h-5" />,
    title: 'AI Model Photo',
    description: 'Transform product photos with AI-generated models in any style.',
  },
  {
    icon: <Palette className="w-5 h-5" />,
    title: 'Clone Brand Style',
    description: 'Analyze and recreate competitor brand visual identity.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Custom Models',
    description: 'Create exclusive AI models matching your brand.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Instant Results',
    description: 'Professional photos in seconds, not days.',
  },
]

// Case studies
const cases = [
  { before: `${STORAGE_URL}/pro-studio-before.jpg?v=2`, after: `${STORAGE_URL}/pro-studio-after.png?v=2`, label: 'Pro Studio' },
  { before: `${STORAGE_URL}/lifestyle-before.png`, after: `${STORAGE_URL}/lifestyle-after.jpg`, label: 'LifeStyle' },
  { before: `${STORAGE_URL}/model-before.jpg`, after: `${STORAGE_URL}/model-after.png`, label: 'Buyer Show' },
]

// Pricing data
const subscriptionPlans = [
  {
    name: 'Basic',
    monthlyPrice: 29.99,
    yearlyPrice: 22.49,
    credits: 120,
    features: ['120 credits/month', 'All AI models', 'HD quality', 'Email support'],
  },
  {
    name: 'Pro',
    monthlyPrice: 59.99,
    yearlyPrice: 44.99,
    credits: 300,
    popular: true,
    features: ['300 credits/month', 'All AI models', 'HD quality', 'Priority support', 'Custom models'],
  },
  {
    name: 'Ultra',
    monthlyPrice: 149.99,
    yearlyPrice: 112.49,
    credits: 1000,
    features: ['1000 credits/month', 'All AI models', 'HD quality', 'Priority support', 'Custom models', 'API access'],
  },
]

const topUpOptions = [
  { credits: 100, price: 25 },
  { credits: 500, price: 120 },
  { credits: 1000, price: 160 },
]

// Pricing Section Component
function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  
  return (
    <section id="pricing" className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.p variants={fadeInUp} className="text-orange-500 text-sm font-semibold tracking-wider uppercase mb-3">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-zinc-500 max-w-xl mx-auto">
            Choose the plan that fits your needs. Cancel anytime.
          </motion.p>
          
          {/* Billing Toggle */}
          <motion.div variants={fadeInUp} className="mt-8 inline-flex items-center gap-3 p-1.5 bg-zinc-100 rounded-full">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly' 
                  ? 'bg-white text-zinc-900 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly' 
                  ? 'bg-white text-zinc-900 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Yearly
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">-25%</span>
            </button>
          </motion.div>
        </motion.div>
        
        {/* Subscription Plans */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mb-16"
        >
          {subscriptionPlans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative p-8 rounded-2xl ${
                plan.popular 
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' 
                  : 'bg-zinc-50 border border-zinc-200'
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-4">Most Popular</span>
                </>
              )}
              <h3 className={`text-lg font-semibold ${plan.popular ? '' : 'text-zinc-900'}`}>{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-4xl font-bold ${plan.popular ? '' : 'text-zinc-900'}`}>
                  ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                </span>
                <span className={plan.popular ? 'text-white/70' : 'text-zinc-500'}>/month</span>
              </div>
              {billingCycle === 'yearly' && (
                <p className={`mt-1 text-sm ${plan.popular ? 'text-white/70' : 'text-zinc-500'}`}>
                  Billed ${(plan.yearlyPrice * 12).toFixed(0)}/year
                </p>
              )}
              <p className={`mt-3 text-sm ${plan.popular ? 'text-white/80' : 'text-zinc-500'}`}>
                {plan.credits} credits per month
              </p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className={`flex items-center gap-2 text-sm ${plan.popular ? 'text-white/90' : 'text-zinc-600'}`}>
                    <Check className={`w-4 h-4 ${plan.popular ? 'text-white' : 'text-green-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link 
                href="/login" 
                className={`mt-8 block w-full py-3 text-center rounded-full font-medium transition-colors ${
                  plan.popular 
                    ? 'bg-white text-orange-600 hover:bg-white/90 shadow-lg' 
                    : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </motion.div>
        
        {/* Top Up Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h3 className="text-xl font-semibold text-zinc-900 mb-2">Need More Credits?</h3>
          <p className="text-zinc-500 mb-8">Top up anytime with our credit packs</p>
          
          <div className="inline-flex flex-wrap justify-center gap-4">
            {topUpOptions.map((option) => (
              <div 
                key={option.credits}
                className="px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-bold text-zinc-900">{option.credits}</div>
                <div className="text-sm text-zinc-500">credits</div>
                <div className="mt-2 text-lg font-semibold text-orange-500">${option.price}</div>
                <div className="text-xs text-zinc-400">${(option.price / option.credits).toFixed(2)}/credit</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// Before/After comparison component
function ComparisonCard({ before, after, label }: { before: string; after: string; label: string }) {
  return (
    <motion.div 
      variants={fadeInUp}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-100 shadow-lg shadow-zinc-200/50"
    >
      {/* Before image */}
      <Image
        src={before}
        alt={`${label} - Before`}
        fill
        className="object-cover transition-opacity duration-700 group-hover:opacity-0"
        unoptimized
      />
      {/* After image */}
      <Image
        src={after}
        alt={`${label} - After`}
        fill
        className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        unoptimized
      />
      {/* Gradient overlay */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
        <p className="text-xs font-medium text-white/70">Hover to reveal</p>
        <h3 className="text-base font-semibold text-white">{label}</h3>
      </div>
      {/* Corner indicators */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-zinc-700 shadow-sm">Before</div>
      <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500 rounded-full text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">After</div>
    </motion.div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const heroRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  })
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 80])

  // 登录用户自动跳转到 /app
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/app')
    }
  }, [user, isLoading, router])

  // 加载中或已登录时显示简单加载状态
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

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-50/80 backdrop-blur-xl border-b border-zinc-200/50">
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Brand Camera"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="text-xl font-bold tracking-tight text-zinc-900">Brand Camera</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
            <a href="#showcase" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Showcase</a>
            <a href="#pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Pricing</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/login"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/login"
              className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-24">
        {/* Background decorations */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-rose-200/20 rounded-full blur-[80px]" />
        
        <motion.div 
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200 shadow-sm mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-zinc-600">AI-Powered Product Photography</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
          >
            <span className="text-zinc-900">Transform Your</span>
            <br />
            <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 bg-clip-text text-transparent">
              Product Photos
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed"
          >
            Create stunning model photos, lifestyle shots, and professional product images in seconds. 
            No photographers, no studios, no waiting.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/login"
              className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-full flex items-center gap-2 shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
            >
              Start Creating Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="px-8 py-4 bg-white border border-zinc-200 rounded-full flex items-center gap-2 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all">
              <Play className="w-4 h-4 text-zinc-600" />
              <span className="text-zinc-700 font-medium">Watch Demo</span>
            </button>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 flex items-center justify-center gap-8 md:gap-16"
          >
            {[
              { value: '50K+', label: 'Photos Generated' },
              { value: '2.5s', label: 'Avg. Generation' },
              { value: '98%', label: 'Satisfaction' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-zinc-900">{stat.value}</div>
                <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
        
        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-zinc-300 flex items-start justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 bg-zinc-400 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.p variants={fadeInUp} className="text-orange-500 text-sm font-semibold tracking-wider uppercase mb-3">
              Capabilities
            </motion.p>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              Everything You Need
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-zinc-500 max-w-xl mx-auto">
              Professional product photography, reimagined with AI.
            </motion.p>
          </motion.div>
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group p-6 rounded-2xl bg-zinc-50 border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 hover:border-zinc-200 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold text-zinc-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="showcase" className="py-24 px-6 bg-gradient-to-b from-white via-orange-50/30 to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.p variants={fadeInUp} className="text-orange-500 text-sm font-semibold tracking-wider uppercase mb-3">
              Showcase
            </motion.p>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              See the Difference
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-zinc-500 max-w-xl mx-auto">
              Hover over each image to see the AI transformation.
            </motion.p>
          </motion.div>
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
            {cases.map((item, index) => (
              <ComparisonCard key={index} {...item} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-12 md:p-16 text-center overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/20 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Ready to Transform Your
                <br />
                <span className="bg-gradient-to-r from-orange-300 to-amber-300 bg-clip-text text-transparent">Product Photography?</span>
              </h2>
              <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
                Join thousands of brands creating stunning product photos with AI.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-white text-zinc-900 font-semibold rounded-full hover:bg-zinc-100 transition-colors shadow-xl"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Brand Camera"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-semibold text-zinc-900">Brand Camera</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Contact</a>
          </div>
          
          <p className="text-sm text-zinc-400">© 2025 Brand Camera. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
