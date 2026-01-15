'use client'

import { motion } from 'framer-motion'
import { Camera, Palette, Users, Zap } from 'lucide-react'

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

export function FeaturesSection() {
  return (
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
  )
}
