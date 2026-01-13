'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Rocket, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTranslation } from '@/stores/languageStore'

// 订阅套餐
const subscriptionPlans = [
  {
    id: 'basic',
    name: 'Basic',
    icon: <Zap className="w-5 h-5" />,
    monthlyPrice: 29.99,
    yearlyPrice: 22.49,
    credits: 120,
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY,
    features: ['120 credits/month', 'All AI models', 'HD quality', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: <Crown className="w-5 h-5" />,
    monthlyPrice: 59.99,
    yearlyPrice: 44.99,
    credits: 300,
    popular: true,
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
    features: ['300 credits/month', 'All AI models', 'HD quality', 'Priority support', 'Custom models'],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    icon: <Rocket className="w-5 h-5" />,
    monthlyPrice: 149.99,
    yearlyPrice: 112.49,
    credits: 1000,
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_YEARLY,
    features: ['1000 credits/month', 'All AI models', 'HD quality', 'Priority support', 'Custom models', 'API access'],
  },
]

// 充值包
const topUpOptions = [
  { 
    credits: 100, 
    price: 25,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_100,
  },
  { 
    credits: 500, 
    price: 120,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_500,
    popular: true,
  },
  { 
    credits: 1000, 
    price: 160,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_1000,
  },
]

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { t, language } = useTranslation()
  
  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      router.push('/login?redirect=/pricing')
      return
    }
    
    setLoadingPriceId(priceId)
    
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          locale: language, // 传递语言，让 Stripe Checkout 显示对应语言界面
          successUrl: `${window.location.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      })
      
      const data = await res.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No checkout URL returned')
        alert(data.error || '创建支付失败，请重试')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('创建支付失败，请重试')
    } finally {
      setLoadingPriceId(null)
    }
  }
  
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-zinc-900 mb-3">
            Choose Your Plan
          </h1>
          <p className="text-zinc-600 max-w-2xl mx-auto">
            Get more credits to generate professional photos for your brand.
            All plans include access to all AI models and HD quality exports.
          </p>
        </div>
        
        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-zinc-100 p-1 rounded-full inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Yearly
              <span className="ml-1.5 text-green-600 text-xs font-semibold">Save 25%</span>
            </button>
          </div>
        </div>
        
        {/* Subscription Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {subscriptionPlans.map((plan, index) => {
            const priceId = billingCycle === 'monthly' ? plan.priceIdMonthly : plan.priceIdYearly
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
            const isLoading = loadingPriceId === priceId
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl p-6 shadow-sm border-2 transition-all hover:shadow-md ${
                  plan.popular ? 'border-blue-500' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-lg ${plan.popular ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-600'}`}>
                    {plan.icon}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">{plan.name}</h3>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-zinc-900">${price}</span>
                  <span className="text-zinc-500">/{billingCycle === 'monthly' ? 'mo' : 'mo, billed yearly'}</span>
                </div>
                
                <div className="mb-6 pb-6 border-b border-zinc-100">
                  <div className="text-lg font-semibold text-zinc-900">
                    {plan.credits} credits/month
                  </div>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-600">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => priceId && handleSubscribe(priceId)}
                  disabled={isLoading || !priceId}
                  className={`w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Subscribe Now'
                  )}
                </button>
              </motion.div>
            )
          })}
        </div>
        
        {/* Top Up Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-zinc-900 text-center mb-2">
            Need More Credits?
          </h2>
          <p className="text-zinc-600 text-center mb-8">
            Purchase additional credits that never expire.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {topUpOptions.map((option, index) => {
              const isLoading = loadingPriceId === option.priceId
              
              return (
                <motion.div
                  key={option.credits}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`relative bg-white rounded-xl p-5 border-2 transition-all hover:shadow-md ${
                    option.popular ? 'border-amber-400' : 'border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {option.popular && (
                    <div className="absolute -top-2.5 right-4">
                      <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Best Value
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-zinc-900 mb-1">
                      {option.credits}
                    </div>
                    <div className="text-sm text-zinc-500 mb-4">credits</div>
                    <div className="text-2xl font-bold text-zinc-900 mb-4">
                      ${option.price}
                    </div>
                    <button
                      onClick={() => option.priceId && handleSubscribe(option.priceId)}
                      disabled={isLoading || !option.priceId}
                      className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'Buy Now'
                      )}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
        
        {/* FAQ or Additional Info */}
        <div className="text-center text-sm text-zinc-500">
          <p>
            All payments are processed securely by Stripe.
            Cancel your subscription anytime.
          </p>
        </div>
      </div>
    </div>
  )
}
