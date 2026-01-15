'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 }
  }
}

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

// All 8 features with correct image paths from /app page
const cases = [
  // Section 1: Model Shot
  { before: `${STORAGE_URL}/pro-studio-before.jpg?v=2`, after: `${STORAGE_URL}/pro-studio-after.png?v=2`, label: 'Pro Studio', desc: 'AI Model Photography' },
  { before: `${STORAGE_URL}/lifestyle-before.png`, after: `${STORAGE_URL}/lifestyle-after.jpg`, label: 'Lifestyle', desc: 'Scene Generation' },
  { before: `${STORAGE_URL}/model-before.jpg`, after: `${STORAGE_URL}/model-after.png`, label: 'Buyer Show', desc: 'Customer Photos' },
  { before: `${STORAGE_URL}/social-before.jpg`, after: `${STORAGE_URL}/social-after.jpg`, label: 'Social Media', desc: 'Content Creation' },
  // Section 2: Custom Shot
  { before: `${STORAGE_URL}/group-shoot-before.png`, after: `${STORAGE_URL}/group-shoot-after.png`, label: 'Group Shot', desc: 'Multi-Angle Photos' },
  { before: `${STORAGE_URL}/reference-shot-before.png`, after: `${STORAGE_URL}/reference-shot-after.png`, label: 'Reference Shot', desc: 'Style Matching' },
  { before: `${STORAGE_URL}/product-before.jpg`, after: `${STORAGE_URL}/product-after.jpg`, label: 'Product Studio', desc: 'Clean Background' },
  { before: `${STORAGE_URL}/try-on-before.png`, after: `${STORAGE_URL}/try-on-after.png`, label: 'Virtual Try-On', desc: 'AI Fitting Room' },
]

function FlipCard({ 
  before, 
  after, 
  label, 
  desc,
  isDemo 
}: { 
  before: string
  after: string
  label: string
  desc: string
  isDemo?: boolean
}) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasSeenDemo, setHasSeenDemo] = useState(false)

  // Demo animation for first card - flip once automatically
  useEffect(() => {
    if (isDemo && !hasSeenDemo) {
      const timer = setTimeout(() => {
        setIsFlipped(true)
        setTimeout(() => {
          setIsFlipped(false)
          setHasSeenDemo(true)
        }, 1500)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isDemo, hasSeenDemo])

  return (
    <motion.div 
      variants={fadeInUp}
      className="relative aspect-[4/5] cursor-pointer group"
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      {/* Card container with 3D flip */}
      <div 
        className="relative w-full h-full transition-transform duration-700 ease-out"
        style={{ 
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* Front - Before */}
        <div 
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg shadow-zinc-200/50 bg-zinc-100"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Image
            src={before}
            alt={`${label} - Before`}
            fill
            className="object-cover"
            unoptimized
          />
          {/* Gradient overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
            <p className="text-xs font-medium text-white/70">{desc}</p>
            <h3 className="text-base font-semibold text-white">{label}</h3>
          </div>
          {/* Before badge */}
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-zinc-700 shadow-sm">
            Before
          </div>
          {/* Hover hint - pulsing ring */}
          {isDemo && !hasSeenDemo && (
            <motion.div 
              className="absolute inset-0 rounded-2xl ring-2 ring-orange-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Back - After */}
        <div 
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg shadow-orange-200/50 bg-zinc-100"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <Image
            src={after}
            alt={`${label} - After`}
            fill
            className="object-cover"
            unoptimized
          />
          {/* Gradient overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
            <p className="text-xs font-medium text-white/70">{desc}</p>
            <h3 className="text-base font-semibold text-white">{label}</h3>
          </div>
          {/* After badge */}
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-orange-500 rounded-full text-xs font-medium text-white shadow-sm">
            After ✨
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function ShowcaseSection() {
  return (
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
            Hover over each card to reveal the AI transformation.
          </motion.p>
        </motion.div>
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
        >
          {cases.map((item, index) => (
            <FlipCard key={index} {...item} isDemo={index === 0} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
