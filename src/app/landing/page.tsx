'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Sparkles, Zap, Palette, Camera, Users, Play } from 'lucide-react'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
}

// Feature data
const features = [
  {
    icon: <Camera className="w-6 h-6" />,
    title: 'AI Model Photo',
    description: 'Transform product photos with AI-generated models in any style, from pro studio to lifestyle shots.',
  },
  {
    icon: <Palette className="w-6 h-6" />,
    title: 'Clone Brand Style',
    description: 'Analyze competitor brands and recreate their visual identity for your products.',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Custom Models',
    description: 'Create exclusive AI models that match your brand aesthetic perfectly.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Instant Results',
    description: 'Generate professional product photos in seconds, not hours or days.',
  },
]

// Case studies
const cases = [
  { before: `${STORAGE_URL}/pro-studio-before.jpg?v=2`, after: `${STORAGE_URL}/pro-studio-after.png?v=2`, label: 'Pro Studio' },
  { before: `${STORAGE_URL}/lifestyle-before.png`, after: `${STORAGE_URL}/lifestyle-after.jpg`, label: 'LifeStyle' },
  { before: `${STORAGE_URL}/model-before.jpg`, after: `${STORAGE_URL}/model-after.png`, label: 'Buyer Show' },
]

// Before/After comparison component
function ComparisonCard({ before, after, label }: { before: string; after: string; label: string }) {
  return (
    <motion.div 
      variants={fadeInUp}
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-900"
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
      {/* Label */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-sm font-medium text-white/60">Hover to reveal</p>
        <h3 className="text-lg font-semibold text-white">{label}</h3>
      </div>
      {/* Corner indicators */}
      <div className="absolute top-4 left-4 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs text-white/80">Before</div>
      <div className="absolute top-4 right-4 px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">After</div>
    </motion.div>
  )
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  })
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 100])

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-50" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Brand Camera</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#showcase" className="text-sm text-white/60 hover:text-white transition-colors">Showcase</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/login"
              className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/login"
              className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-24">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[96px]" />
        
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">AI-Powered Product Photography</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            <span className="block">Transform Your</span>
            <span className="block mt-2 bg-gradient-to-r from-amber-200 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              Product Photos
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-8 text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            Create stunning model photos, lifestyle shots, and professional product images in seconds. 
            No photographers, no studios, no waiting.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/login"
              className="group px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold rounded-full flex items-center gap-2 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
            >
              Start Creating Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-full flex items-center gap-2 hover:bg-white/10 transition-colors">
              <Play className="w-4 h-4" />
              Watch Demo
            </button>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-20 flex items-center justify-center gap-12 md:gap-20"
          >
            {[
              { value: '50K+', label: 'Photos Generated' },
              { value: '2.5s', label: 'Avg. Generation' },
              { value: '98%', label: 'Satisfaction' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/40 mt-1">{stat.label}</div>
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
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 bg-white/40 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-20"
          >
            <motion.p variants={fadeInUp} className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4">
              Capabilities
            </motion.p>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold tracking-tight">
              Everything You Need
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-white/50 max-w-xl mx-auto">
              Professional product photography, reimagined with AI. From concept to final image in seconds.
            </motion.p>
          </motion.div>
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="showcase" className="py-32 px-6 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-20"
          >
            <motion.p variants={fadeInUp} className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4">
              Showcase
            </motion.p>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold tracking-tight">
              See the Difference
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-white/50 max-w-xl mx-auto">
              Hover over each image to see the AI transformation. Real results from real customers.
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

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-white/10 p-12 md:p-20 text-center overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/20 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                Ready to Transform Your
                <br />
                <span className="bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">Product Photography?</span>
              </h2>
              <p className="mt-6 text-white/50 max-w-lg mx-auto">
                Join thousands of brands creating stunning product photos with AI. Start free, no credit card required.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 mt-10 px-10 py-5 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-colors"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Brand Camera</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          
          <p className="text-sm text-white/30">© 2025 Brand Camera. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
