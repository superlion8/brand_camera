'use client'

import { motion } from 'framer-motion'
import { Upload, Sparkles, Download } from 'lucide-react'

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 }
  }
}

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload Your Product',
    description: 'Simply upload a photo of your product. Any angle works - our AI handles the rest.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'AI Magic Happens',
    description: 'Our AI analyzes your product and generates professional photos with models, scenes, or clean backgrounds.',
  },
  {
    icon: Download,
    step: '03',
    title: 'Download & Use',
    description: 'Get your images instantly. Use them on your website, social media, or marketplace listings.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-white to-orange-50/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.p variants={fadeInUp} className="text-orange-500 text-sm font-semibold tracking-wider uppercase mb-3">
            Simple Process
          </motion.p>
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            How It Works
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-zinc-500 max-w-xl mx-auto">
            Create professional product photos in three simple steps.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8 md:gap-12"
        >
          {steps.map((item, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="relative text-center"
            >
              {/* Connector line for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-orange-200 to-orange-100" />
              )}
              
              {/* Step number */}
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                  <item.icon className="w-10 h-10 text-orange-500" />
                </div>
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center shadow-lg">
                  {item.step}
                </span>
              </div>

              <h3 className="text-xl font-semibold text-zinc-900 mb-3">{item.title}</h3>
              <p className="text-zinc-500 leading-relaxed max-w-xs mx-auto">{item.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
