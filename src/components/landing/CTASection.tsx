'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
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
  )
}
