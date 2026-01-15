'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
}

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Fashion Brand Owner',
    avatar: '👩‍💼',
    rating: 5,
    text: 'BrandCam has completely transformed how we create product photos. What used to take days with photographers now takes minutes. The AI model photos look incredibly professional.',
  },
  {
    name: 'Michael Park',
    role: 'E-commerce Entrepreneur',
    avatar: '👨‍💻',
    rating: 5,
    text: 'I was skeptical at first, but the results blew me away. My conversion rate increased by 40% after switching to BrandCam photos. Best investment for my Shopify store.',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Jewelry Designer',
    avatar: '👩‍🎨',
    rating: 5,
    text: 'The lifestyle shots are amazing! I can now show my jewelry in beautiful settings without expensive photoshoots. My Instagram engagement has doubled.',
  },
  {
    name: 'David Kim',
    role: 'Streetwear Brand',
    avatar: '🧑‍🎤',
    rating: 5,
    text: 'Finally, a tool that understands fashion photography. The AI models match our brand aesthetic perfectly. We use BrandCam for all our new product launches now.',
  },
  {
    name: 'Lisa Wang',
    role: 'Accessories Seller',
    avatar: '👩‍🦰',
    rating: 5,
    text: 'The speed is unbelievable. I uploaded 50 products and had professional photos for all of them within an hour. This would have cost me thousands with traditional photography.',
  },
  {
    name: 'James Thompson',
    role: 'Outdoor Gear Brand',
    avatar: '🧔',
    rating: 5,
    text: 'The scene generation feature is incredible. I can show my products in outdoor settings that would be impossible to shoot otherwise. Highly recommend!',
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-200'}`}
        />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.p variants={fadeInUp} className="text-orange-500 text-sm font-semibold tracking-wider uppercase mb-3">
            Testimonials
          </motion.p>
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            Loved by Brands Worldwide
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-zinc-500 max-w-xl mx-auto">
            See what our customers have to say about BrandCam.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 hover:shadow-lg hover:shadow-zinc-200/50 hover:border-zinc-200 transition-all duration-300"
            >
              <StarRating rating={testimonial.rating} />
              
              <p className="mt-4 text-zinc-600 leading-relaxed text-sm">
                "{testimonial.text}"
              </p>
              
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-lg">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{testimonial.name}</p>
                  <p className="text-zinc-500 text-xs">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
