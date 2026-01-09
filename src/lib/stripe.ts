/**
 * Stripe 客户端配置
 */
import Stripe from 'stripe'

// Lazy-loaded Stripe 客户端（避免 build 时因缺少 API key 报错）
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover' as any,
      typescript: true,
    })
  }
  return stripeInstance
}

// 向后兼容：导出 stripe getter
export const stripe = {
  get checkout() { return getStripe().checkout },
  get customers() { return getStripe().customers },
  get subscriptions() { return getStripe().subscriptions },
  get prices() { return getStripe().prices },
  get webhooks() { return getStripe().webhooks },
}

// 价格配置 - 使用 getter 避免 build 时报错
export const STRIPE_PRICES = {
  // 订阅 - 月付
  get BASIC_MONTHLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY || '' },
  get PRO_MONTHLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '' },
  get ULTRA_MONTHLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_MONTHLY || '' },
  
  // 订阅 - 年付
  get BASIC_YEARLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY || '' },
  get PRO_YEARLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '' },
  get ULTRA_YEARLY() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTRA_YEARLY || '' },
  
  // 充值包
  get CREDITS_100() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_100 || '' },
  get CREDITS_500() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_500 || '' },
  get CREDITS_1000() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_1000 || '' },
} as const

// 获取价格对应的 credits 数量
export function getCreditsForPrice(priceId: string): number {
  const mapping: Record<string, number> = {
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
  return mapping[priceId] || 0
}

// 获取价格对应的套餐名
export function getPlanForPrice(priceId: string): string | null {
  const mapping: Record<string, string> = {
    [STRIPE_PRICES.BASIC_MONTHLY]: 'basic',
    [STRIPE_PRICES.BASIC_YEARLY]: 'basic',
    [STRIPE_PRICES.PRO_MONTHLY]: 'pro',
    [STRIPE_PRICES.PRO_YEARLY]: 'pro',
    [STRIPE_PRICES.ULTRA_MONTHLY]: 'ultra',
    [STRIPE_PRICES.ULTRA_YEARLY]: 'ultra',
  }
  return mapping[priceId] || null
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
