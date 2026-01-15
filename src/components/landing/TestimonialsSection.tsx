'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Fashion Brand Owner',
    company: '@MUSE_Studio',
    text: 'BrandCam has completely transformed how we create product photos. What used to take days with photographers now takes minutes.',
    highlight: 'Save 90% time on photoshoots',
    gradient: 'from-rose-500 to-orange-400',
  },
  {
    name: 'Michael Park',
    role: 'Streetwear Brand Founder',
    company: '@URBANEDGE',
    text: 'I was skeptical at first, but the results blew me away. My conversion rate increased by 40% after switching to BrandCam.',
    highlight: '+40% conversion rate',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    name: 'Emily Liu',
    role: 'Women\'s Wear Designer',
    company: '@BLOOM_Atelier',
    text: 'The lifestyle shots are amazing! I can now show my clothes in beautiful settings without expensive photoshoots.',
    highlight: 'Instagram engagement 2x',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    name: 'David Kim',
    role: 'Menswear Brand',
    company: '@DAPPER_Seoul',
    text: 'Finally, a tool that understands fashion photography. The AI models match our brand aesthetic perfectly.',
    highlight: 'Perfect model matching',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Lisa Wang',
    role: 'E-commerce Seller',
    company: 'Tmall Top Seller',
    text: 'The speed is unbelievable. I uploaded 50 products and had professional photos for all of them within an hour.',
    highlight: '50 products in 1 hour',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    name: 'James Lee',
    role: 'Vintage Clothing Store',
    company: '@RETRO_Archive',
    text: 'The scene generation feature is incredible. I can show my vintage pieces in authentic retro settings. Highly recommend!',
    highlight: 'Authentic scene generation',
    gradient: 'from-pink-500 to-rose-500',
  },
]

function TestimonialCard({ 
  testimonial, 
  index 
}: { 
  testimonial: typeof testimonials[0]
  index: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="relative group"
    >
      <div className="
        relative h-full p-6 rounded-2xl overflow-hidden
        bg-white border border-zinc-100
        hover:border-zinc-200 hover:shadow-xl hover:shadow-zinc-200/50
        transition-all duration-500 ease-out
      ">
        {/* Gradient accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${testimonial.gradient}`} />
        
        {/* Quote icon */}
        <div className={`
          inline-flex items-center justify-center w-10 h-10 rounded-2xl mb-4
          bg-gradient-to-br ${testimonial.gradient} bg-opacity-10
        `}>
          <Quote className="w-5 h-5 text-white" />
        </div>

        {/* Highlight badge */}
        <div className={`
          inline-block px-3 py-1.5 rounded-full text-xs font-bold tracking-wide mb-4
          bg-gradient-to-r ${testimonial.gradient} text-white
        `}>
          {testimonial.highlight}
        </div>

        {/* Quote text */}
        <p className="text-zinc-700 leading-relaxed mb-6 text-sm">
          "{testimonial.text}"
        </p>

        {/* Author */}
        <div className="flex items-center gap-3 mt-auto">
          {/* Avatar with gradient ring */}
          <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.gradient} p-[2px]`}>
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-lg font-bold bg-gradient-to-br from-zinc-600 to-zinc-800 bg-clip-text text-transparent">
                {testimonial.name.charAt(0)}
              </span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">{testimonial.name}</p>
            <p className="text-sm text-zinc-500">{testimonial.role}</p>
            <p className={`text-xs font-medium bg-gradient-to-r ${testimonial.gradient} bg-clip-text text-transparent`}>
              {testimonial.company}
            </p>
          </div>
        </div>

        {/* Hover glow effect */}
        <div className={`
          absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100
          bg-gradient-to-r ${testimonial.gradient} blur-xl
          transition-opacity duration-500 -z-10
        `} style={{ transform: 'scale(0.95)' }} />
      </div>
    </motion.div>
  )
}

export function TestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="py-24 px-6 bg-gradient-to-b from-zinc-50 to-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 mb-6"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm font-semibold text-orange-700 tracking-wide">TESTIMONIALS</span>
          </motion.div>
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
            Loved by{' '}
            <span className="bg-gradient-to-r from-orange-500 via-rose-500 to-violet-500 bg-clip-text text-transparent">
              Fashion Brands
            </span>
            {' '}Worldwide
          </h2>
          
          <p className="text-zinc-500 max-w-xl mx-auto text-lg">
            Join thousands of fashion brands creating stunning product photos with AI
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} index={index} />
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-zinc-400"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span className="font-semibold">4.9/5</span>
            <span className="text-sm">average rating</span>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="font-semibold">10,000+</span>
            <span className="text-sm">photos generated daily</span>
          </div>
          <div className="h-6 w-px bg-zinc-200 hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            <span className="font-semibold">50+</span>
            <span className="text-sm">countries</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
