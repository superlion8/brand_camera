import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getCreditsForPrice, getPlanForPrice, isSubscriptionPrice } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'

// App Router 使用 request.text() 自动获取原始 body，无需额外配置

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  
  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }
  
  let event: Stripe.Event
  
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  const supabase = createServiceClient()
  
  console.log('[Webhook] Received event:', event.type)
  
  try {
    switch (event.type) {
      // ========== Checkout 完成 ==========
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }
      
      // ========== 订阅创建 ==========
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(supabase, subscription)
        break
      }
      
      // ========== 订阅更新 ==========
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }
      
      // ========== 订阅取消/删除 ==========
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }
      
      // ========== 发票支付成功（订阅续费）==========
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(supabase, invoice)
        break
      }
      
      // ========== 发票支付失败 ==========
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(supabase, invoice)
        break
      }
      
      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }
    
    return NextResponse.json({ received: true })
    
  } catch (error: any) {
    console.error('[Webhook] Error processing event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ========== 处理函数 ==========

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  console.log('[Webhook] Checkout completed:', session.id)
  
  const userId = session.metadata?.user_id
  const priceId = session.metadata?.price_id
  const customerId = session.customer as string
  
  if (!userId) {
    console.error('[Webhook] Missing user_id in session metadata')
    return
  }
  
  // 记录支付
  await supabase.from('payments').insert({
    user_id: userId,
    stripe_checkout_session_id: session.id,
    stripe_customer_id: customerId,
    stripe_payment_intent_id: session.payment_intent as string,
    amount: session.amount_total || 0,
    currency: session.currency || 'usd',
    status: 'succeeded',
    payment_type: session.mode === 'subscription' ? 'subscription' : 'one_time',
    plan_name: priceId ? getPlanForPrice(priceId) : null,
    price_id: priceId,
    credits_purchased: priceId ? getCreditsForPrice(priceId) : 0,
  })
  
  // 如果是一次性支付（充值包），立即增加 credits
  if (session.mode === 'payment' && priceId) {
    const credits = getCreditsForPrice(priceId)
    if (credits > 0) {
      // 增加购买的 credits
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('purchased_credits')
        .eq('user_id', userId)
        .single()
      
      const currentCredits = quotaData?.purchased_credits || 0
      
      await supabase
        .from('user_quotas')
        .upsert({
          user_id: userId,
          purchased_credits: currentCredits + credits,
          stripe_customer_id: customerId,
        }, {
          onConflict: 'user_id',
        })
      
      console.log(`[Webhook] Added ${credits} purchased credits to user ${userId}`)
    }
  }
  
  // 订阅的 credits 在 invoice.paid 事件中处理
}

async function handleSubscriptionCreated(supabase: any, subscription: Stripe.Subscription) {
  console.log('[Webhook] Subscription created:', subscription.id)
  
  const userId = subscription.metadata?.user_id
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  
  if (!userId) {
    // 尝试从 customer 获取 user_id
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single()
    
    if (!quotaData?.user_id) {
      console.error('[Webhook] Cannot find user for subscription:', subscription.id)
      return
    }
  }
  
  const finalUserId = userId || (await getUserIdFromCustomer(supabase, customerId))
  if (!finalUserId) return
  
  const credits = priceId ? getCreditsForPrice(priceId) : 0
  const planName = priceId ? getPlanForPrice(priceId) : null
  
  // 创建或更新订阅记录
  // 使用 as any 绕过 Stripe SDK 类型问题（实际 API 返回这些字段）
  const subData = subscription as any
  await supabase.from('subscriptions').upsert({
    user_id: finalUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    plan_name: planName,
    credits_per_period: credits,
    current_period_start: subData.current_period_start 
      ? new Date(subData.current_period_start * 1000).toISOString() 
      : null,
    current_period_end: subData.current_period_end 
      ? new Date(subData.current_period_end * 1000).toISOString() 
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  }, {
    onConflict: 'user_id',
  })
  
  // 同时更新 user_quotas 的 subscription_credits（不重置 used_quota，保留老用户的使用记录）
  if (subscription.status === 'active' && credits > 0) {
    await supabase
      .from('user_quotas')
      .upsert({
        user_id: finalUserId,
        subscription_credits: credits,
        credits_reset_at: new Date().toISOString(),
        stripe_customer_id: customerId,
      }, {
        onConflict: 'user_id',
      })
    
    console.log(`[Webhook] Set subscription_credits to ${credits} for user ${finalUserId}`)
  }
  
  console.log(`[Webhook] Subscription ${subscription.id} created for user ${finalUserId}`)
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  console.log('[Webhook] Subscription updated:', subscription.id, 'status:', subscription.status)
  
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  const userId = await getUserIdFromCustomer(supabase, customerId)
  
  if (!userId) {
    console.error('[Webhook] Cannot find user for subscription update:', subscription.id)
    return
  }
  
  const credits = priceId ? getCreditsForPrice(priceId) : 0
  const planName = priceId ? getPlanForPrice(priceId) : null
  const subData = subscription as any
  
  // 更新订阅记录
  await supabase
    .from('subscriptions')
    .update({
      stripe_price_id: priceId,
      status: subscription.status,
      plan_name: planName,
      credits_per_period: credits,
      current_period_start: subData.current_period_start 
        ? new Date(subData.current_period_start * 1000).toISOString() 
        : null,
      current_period_end: subData.current_period_end 
        ? new Date(subData.current_period_end * 1000).toISOString() 
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subData.canceled_at 
        ? new Date(subData.canceled_at * 1000).toISOString() 
        : null,
    })
    .eq('stripe_subscription_id', subscription.id)
  
  // 如果订阅升级/降级，更新 subscription_credits
  if (subscription.status === 'active') {
    await supabase
      .from('user_quotas')
      .update({
        subscription_credits: credits,
      })
      .eq('user_id', userId)
  }
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  console.log('[Webhook] Subscription deleted:', subscription.id)
  
  const customerId = subscription.customer as string
  const userId = await getUserIdFromCustomer(supabase, customerId)
  
  if (!userId) {
    console.error('[Webhook] Cannot find user for subscription deletion:', subscription.id)
    return
  }
  
  // 更新订阅状态为 inactive
  await supabase
    .from('subscriptions')
    .update({
      status: 'inactive',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
  
  // 注意：取消订阅时不清零 subscription_credits
  // 已给的 credits 让用户继续使用直到用完
  // 只有下个月续费时才会重新设置 subscription_credits
  
  console.log(`[Webhook] Subscription ${subscription.id} deleted for user ${userId}, credits retained`)
}

async function handleInvoicePaid(supabase: any, invoice: Stripe.Invoice) {
  const invoiceData = invoice as any
  
  // 只处理订阅相关的发票
  if (!invoiceData.subscription) return
  
  console.log('[Webhook] Invoice paid:', invoice.id, 'subscription:', invoiceData.subscription)
  
  const customerId = invoiceData.customer as string
  const userId = await getUserIdFromCustomer(supabase, customerId)
  
  if (!userId) {
    console.error('[Webhook] Cannot find user for invoice:', invoice.id)
    return
  }
  
  // 获取订阅信息
  const { data: subData } = await supabase
    .from('subscriptions')
    .select('credits_per_period')
    .eq('stripe_subscription_id', invoiceData.subscription)
    .single()
  
  const credits = subData?.credits_per_period || 0
  
  if (credits > 0) {
    // 重置订阅 credits（每月/每年续费时）
    await supabase
      .from('user_quotas')
      .update({
        subscription_credits: credits,
        credits_reset_at: new Date().toISOString(),
        // 重置使用量（只重置订阅部分）
        used_quota: 0,
      })
      .eq('user_id', userId)
    
    console.log(`[Webhook] Reset subscription credits to ${credits} for user ${userId}`)
  }
  
  // 记录续费支付
  const priceId = invoiceData.lines?.data?.[0]?.price?.id
  await supabase.from('payments').insert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: customerId,
    stripe_payment_intent_id: invoiceData.payment_intent as string,
    amount: invoiceData.amount_paid || 0,
    currency: invoiceData.currency || 'usd',
    status: 'succeeded',
    payment_type: 'subscription',
    plan_name: priceId ? getPlanForPrice(priceId) : null,
    price_id: priceId,
    credits_purchased: credits,
  })
}

async function handleInvoicePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const invoiceData = invoice as any
  
  if (!invoiceData.subscription) return
  
  console.log('[Webhook] Invoice payment failed:', invoice.id)
  
  const customerId = invoiceData.customer as string
  const userId = await getUserIdFromCustomer(supabase, customerId)
  
  if (!userId) return
  
  // 更新订阅状态
  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
    })
    .eq('stripe_subscription_id', invoiceData.subscription)
  
  // 这里可以发送通知邮件等
}

// ========== 工具函数 ==========

async function getUserIdFromCustomer(supabase: any, customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_quotas')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()
  
  return data?.user_id || null
}
