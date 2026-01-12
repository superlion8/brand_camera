import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  calculateCreditsInfo, 
  createDefaultQuota, 
  DEFAULT_SIGNUP_CREDITS,
  type UserQuotaRecord 
} from '@/lib/quota'

// 获取或创建用户额度记录
async function getOrCreateUserQuota(supabase: any, userId: string, userEmail?: string): Promise<UserQuotaRecord> {
  // 先尝试获取
  const { data: existing } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    return existing as UserQuotaRecord
  }
  
  // 不存在则创建
  const defaultQuota = createDefaultQuota(userId, userEmail)
  const { data: created, error } = await supabase
    .from('user_quotas')
    .insert(defaultQuota)
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
    return (retry as UserQuotaRecord) || defaultQuota as UserQuotaRecord
  }
  
  return created as UserQuotaRecord
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
    const credits = calculateCreditsInfo(quotaData)
    
    // 获取订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_name, status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .single()
    
    return NextResponse.json({
      // 向后兼容旧字段
      totalQuota: credits.available + (credits.dailyExpired ? quotaData.daily_credits || 0 : 0),
      usedCount: 0,  // 新系统不再使用 usedCount
      remainingQuota: credits.available,
      
      // 新字段：详细 credits 信息
      credits: {
        available: credits.available,
        daily: credits.daily,
        subscription: credits.subscription,
        signup: credits.signup,
        adminGive: credits.adminGive,
        purchased: credits.purchased,
        dailyExpired: credits.dailyExpired,
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
    const credits = calculateCreditsInfo(quotaData)
    
    return NextResponse.json({
      hasQuota: credits.available >= imageCount,
      // 向后兼容
      totalQuota: credits.available,
      usedCount: 0,
      remainingQuota: credits.available,
      // 新字段
      credits: {
        available: credits.available,
        daily: credits.daily,
        subscription: credits.subscription,
        signup: credits.signup,
        adminGive: credits.adminGive,
        purchased: credits.purchased,
      },
    })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
