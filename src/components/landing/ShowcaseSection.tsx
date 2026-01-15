'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

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

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

const cases = [
  { before: `${STORAGE_URL}/pro-studio-before.jpg?v=2`, after: `${STORAGE_URL}/pro-studio-after.png?v=2`, label: 'Pro Studio' },
  { before: `${STORAGE_URL}/lifestyle-before.png`, after: `${STORAGE_URL}/lifestyle-after.jpg`, label: 'LifeStyle' },
  { before: `${STORAGE_URL}/model-before.jpg`, after: `${STORAGE_URL}/model-after.png`, label: 'Buyer Show' },
]

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
  )
}
