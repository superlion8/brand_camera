import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_QUOTA = 100  // 免费用户默认额度

// 获取或创建用户额度记录
async function getOrCreateUserQuota(supabase: any, userId: string, userEmail?: string) {
  // 先尝试获取
  const { data: existing } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    return existing
  }
  
  // 不存在则创建
  const { data: created, error } = await supabase
    .from('user_quotas')
    .insert({
      user_id: userId,
      user_email: userEmail,
      total_quota: DEFAULT_QUOTA,
      used_quota: 0,
      subscription_credits: 0,
      purchased_credits: 0,
    })
    .select()
    .single()
  
  if (error) {
    console.error('[Quota] Error creating user quota:', error)
    // 可能是并发创建，再尝试获取一次
    const { data: retry } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single()
    return retry || { 
      total_quota: DEFAULT_QUOTA, 
      used_quota: 0,
      subscription_credits: 0,
      purchased_credits: 0,
    }
  }
  
  return created
}

// 计算可用 credits
function calculateAvailableCredits(quotaData: any): {
  totalCredits: number
  usedCredits: number
  availableCredits: number
  subscriptionCredits: number
  purchasedCredits: number
  freeCredits: number
} {
  // 订阅 credits（每月重置）
  const subscriptionCredits = quotaData.subscription_credits || 0
  // 购买的 credits（永久）
  const purchasedCredits = quotaData.purchased_credits || 0
  // 免费 credits（向后兼容旧用户）
  const freeCredits = quotaData.total_quota || DEFAULT_QUOTA
  
  // 已使用
  const usedCredits = quotaData.used_quota || 0
  
  // 总可用 = 订阅 + 购买 + 免费 - 已使用
  // 注意：对于有订阅的用户，免费额度不叠加
  const hasSubscription = subscriptionCredits > 0
  const totalCredits = hasSubscription 
    ? subscriptionCredits + purchasedCredits
    : freeCredits + purchasedCredits
  
  const availableCredits = Math.max(0, totalCredits - usedCredits)
  
  return {
    totalCredits,
    usedCredits,
    availableCredits,
    subscriptionCredits,
    purchasedCredits,
    freeCredits: hasSubscription ? 0 : freeCredits,
  }
}

// GET - Get current user's quota
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const quotaData = await getOrCreateUserQuota(supabase, user.id, user.email)
    const credits = calculateAvailableCredits(quotaData)
    
    // 获取订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_name, status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .single()
    
    return NextResponse.json({
      // 向后兼容
      totalQuota: credits.totalCredits,
      usedCount: credits.usedCredits,
      remainingQuota: credits.availableCredits,
      
      // 新字段：详细 credits 信息
      credits: {
        total: credits.totalCredits,
        used: credits.usedCredits,
        available: credits.availableCredits,
        subscription: credits.subscriptionCredits,
        purchased: credits.purchasedCredits,
        free: credits.freeCredits,
      },
      
      // 订阅信息
      subscription: subscription?.status === 'active' ? {
        plan: subscription.plan_name,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
    })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Check quota before generation
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { action, imageCount = 1 } = body
    
    if (action !== 'check') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
    const quotaData = await getOrCreateUserQuota(supabase, user.id, user.email)
    const credits = calculateAvailableCredits(quotaData)
    
    return NextResponse.json({
      hasQuota: credits.availableCredits >= imageCount,
      // 向后兼容
      totalQuota: credits.totalCredits,
      usedCount: credits.usedCredits,
      remainingQuota: credits.availableCredits,
      // 新字段
      credits: {
        total: credits.totalCredits,
        used: credits.usedCredits,
        available: credits.availableCredits,
      },
    })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
