/**
 * Stripe 客户端配置
 */
import Stripe from 'stripe'

// 服务端 Stripe 客户端
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
  typescript: true,
})

// 价格配置
export const STRIPE_PRICES = {
  // 订阅 - 月付
  BASIC_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY!,
  PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
  ULTRA_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_MONTHLY!,
  
  // 订阅 - 年付
  BASIC_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY!,
  PRO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY!,
  ULTRA_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_YEARLY!,
  
  // 充值包
  CREDITS_100: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_100!,
  CREDITS_500: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_500!,
  CREDITS_1000: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_1000!,
} as const

// 价格 ID 到 credits 的映射
export const PRICE_TO_CREDITS: Record<string, number> = {
  // 订阅
  [STRIPE_PRICES.BASIC_MONTHLY]: 120,
  [STRIPE_PRICES.BASIC_YEARLY]: 120,
  [STRIPE_PRICES.PRO_MONTHLY]: 300,
  [STRIPE_PRICES.PRO_YEARLY]: 300,
  [STRIPE_PRICES.ULTRA_MONTHLY]: 1000,
  [STRIPE_PRICES.ULTRA_YEARLY]: 1000,
  
  // 充值包
  [STRIPE_PRICES.CREDITS_100]: 100,
  [STRIPE_PRICES.CREDITS_500]: 500,
  [STRIPE_PRICES.CREDITS_1000]: 1000,
}

// 价格 ID 到套餐名的映射
export const PRICE_TO_PLAN: Record<string, string> = {
  [STRIPE_PRICES.BASIC_MONTHLY]: 'basic',
  [STRIPE_PRICES.BASIC_YEARLY]: 'basic',
  [STRIPE_PRICES.PRO_MONTHLY]: 'pro',
  [STRIPE_PRICES.PRO_YEARLY]: 'pro',
  [STRIPE_PRICES.ULTRA_MONTHLY]: 'ultra',
  [STRIPE_PRICES.ULTRA_YEARLY]: 'ultra',
}

// 判断是否是订阅价格
export function isSubscriptionPrice(priceId: string): boolean {
  return [
    STRIPE_PRICES.BASIC_MONTHLY,
    STRIPE_PRICES.BASIC_YEARLY,
    STRIPE_PRICES.PRO_MONTHLY,
    STRIPE_PRICES.PRO_YEARLY,
    STRIPE_PRICES.ULTRA_MONTHLY,
    STRIPE_PRICES.ULTRA_YEARLY,
  ].includes(priceId)
}

// 获取 credits 数量
export function getCreditsForPrice(priceId: string): number {
  return PRICE_TO_CREDITS[priceId] || 0
}

// 获取套餐名
export function getPlanForPrice(priceId: string): string | null {
  return PRICE_TO_PLAN[priceId] || null
}
