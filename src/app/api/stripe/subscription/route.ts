import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 验证用户登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    
    // 获取订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (!subscription || subscription.status === 'inactive') {
      return NextResponse.json({
        hasActiveSubscription: false,
        plan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        creditsPerPeriod: 0,
      })
    }
    
    return NextResponse.json({
      hasActiveSubscription: subscription.status === 'active',
      plan: subscription.plan_name,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      creditsPerPeriod: subscription.credits_per_period,
    })
    
  } catch (error: any) {
    console.error('[Stripe Subscription] Error:', error)
    return NextResponse.json(
      { error: error.message || '获取订阅信息失败' },
      { status: 500 }
    )
  }
}
