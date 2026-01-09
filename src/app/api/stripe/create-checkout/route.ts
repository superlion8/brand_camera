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
    
    const { priceId, successUrl, cancelUrl } = await request.json()
    
    if (!priceId) {
      return NextResponse.json({ error: '缺少价格 ID' }, { status: 400 })
    }
    
    // 获取或创建 Stripe Customer
    let customerId: string | undefined
    
    // 先查询是否已有 Stripe Customer ID
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()
    
    if (quotaData?.stripe_customer_id) {
      customerId = quotaData.stripe_customer_id
    } else {
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
    const session = await getStripe().checkout.sessions.create({
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
      metadata: {
        user_id: user.id,
        price_id: priceId,
      },
      // 订阅相关配置
      ...(isSubscription && {
        subscription_data: {
          metadata: {
            user_id: user.id,
          },
        },
      }),
      // 一次性支付相关配置
      ...(!isSubscription && {
        payment_intent_data: {
          metadata: {
            user_id: user.id,
            price_id: priceId,
          },
        },
      }),
      // 允许促销码
      allow_promotion_codes: true,
    })
    
    return NextResponse.json({ url: session.url })
    
  } catch (error: any) {
    console.error('[Stripe] Create checkout error:', error)
    return NextResponse.json(
      { error: error.message || '创建支付失败' },
      { status: 500 }
    )
  }
}
