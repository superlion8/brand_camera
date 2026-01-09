import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 验证用户登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    
    // 获取用户的 Stripe Customer ID
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()
    
    if (!quotaData?.stripe_customer_id) {
      return NextResponse.json({ error: '未找到订阅信息' }, { status: 404 })
    }
    
    const { returnUrl } = await request.json().catch(() => ({}))
    
    // 创建 Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: quotaData.stripe_customer_id,
      return_url: returnUrl || `${request.headers.get('origin')}/settings`,
    })
    
    return NextResponse.json({ url: session.url })
    
  } catch (error: any) {
    console.error('[Stripe Portal] Error:', error)
    return NextResponse.json(
      { error: error.message || '创建管理页面失败' },
      { status: 500 }
    )
  }
}
