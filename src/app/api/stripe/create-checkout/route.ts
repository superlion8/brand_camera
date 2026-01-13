import { NextRequest, NextResponse } from 'next/server'
import { getStripe, isSubscriptionPrice } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 验证用户登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    
    const { priceId, successUrl, cancelUrl, currency, locale } = await request.json()
    
    if (!priceId) {
      return NextResponse.json({ error: '缺少价格 ID' }, { status: 400 })
    }
    
    // 货币映射（根据语言自动选择）
    const currencyMap: Record<string, string> = {
      zh: 'cny',
      ko: 'krw',
      en: 'usd',
    }
    const selectedCurrency = currency || currencyMap[locale] || 'usd'
    
    // Stripe Checkout 语言映射
    const localeMap: Record<string, string> = {
      zh: 'zh',
      ko: 'ko',
      en: 'en',
    }
    const checkoutLocale = localeMap[locale] || 'auto'
    
    // 获取或创建 Stripe Customer
    let customerId: string | undefined
    
    // 先查询是否已有 Stripe Customer ID
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()
    
    if (quotaData?.stripe_customer_id) {
      // 验证 customer 是否在当前 Stripe 环境中存在
      try {
        await getStripe().customers.retrieve(quotaData.stripe_customer_id)
        customerId = quotaData.stripe_customer_id
      } catch (err: any) {
        // Customer 不存在（可能是切换了 test/live 模式），需要创建新的
        console.log('[Stripe] Customer not found, creating new one:', err.message)
        customerId = undefined
      }
    }
    
    if (!customerId) {
      // 创建新的 Stripe Customer
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
      
      // 保存 Customer ID 到数据库
      await supabase
        .from('user_quotas')
        .upsert({
          user_id: user.id,
          user_email: user.email,
          stripe_customer_id: customerId,
        }, {
          onConflict: 'user_id',
        })
    }
    
    // 判断是订阅还是一次性支付
    const isSubscription = isSubscriptionPrice(priceId)
    
    // 创建 Checkout Session
    const sessionConfig: any = {
      customer: customerId,
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${request.headers.get('origin')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get('origin')}/pricing`,
      locale: checkoutLocale, // Stripe Checkout 界面语言
      metadata: {
        user_id: user.id,
        price_id: priceId,
        currency: selectedCurrency,
      },
      // 允许促销码
      allow_promotion_codes: true,
    }
    
    // 订阅相关配置
    if (isSubscription) {
      sessionConfig.subscription_data = {
        metadata: {
          user_id: user.id,
        },
      }
    } else {
      // 一次性支付：可以指定货币（需要 price 支持该货币，或使用 price_data）
      sessionConfig.payment_intent_data = {
        metadata: {
          user_id: user.id,
          price_id: priceId,
        },
      }
    }
    
    const session = await getStripe().checkout.sessions.create(sessionConfig)
    
    return NextResponse.json({ url: session.url })
    
  } catch (error: any) {
    console.error('[Stripe] Create checkout error:', error)
    return NextResponse.json(
      { error: error.message || '创建支付失败' },
      { status: 500 }
    )
  }
}
