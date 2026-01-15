'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

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

export function PricingSection() {
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
