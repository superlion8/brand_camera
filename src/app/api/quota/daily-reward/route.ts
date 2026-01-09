import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 每日登录奖励 credits 数量
const DAILY_REWARD_CREDITS = 5

// 检查是否是同一天 (UTC)
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  )
}

// POST - 领取每日登录奖励
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const now = new Date()
    
    // 1. 获取用户额度信息
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // 2. 检查是否已领取今日奖励
    if (quotaData?.last_daily_reward_at) {
      const lastRewardDate = new Date(quotaData.last_daily_reward_at)
      if (isSameDay(lastRewardDate, now)) {
        // 今天已经领取过了
        return NextResponse.json({
          success: true,
          credited: false,
          message: 'Already claimed today',
          totalQuota: quotaData.total_quota,
          usedQuota: quotaData.used_quota,
          remainingQuota: quotaData.total_quota - quotaData.used_quota,
        })
      }
    }
    
    // 3. 发放奖励
    if (quotaData) {
      // 更新现有记录：增加 total_quota 并更新领取时间
      const newTotalQuota = (quotaData.total_quota || 10) + DAILY_REWARD_CREDITS
      
      const { error: updateError } = await supabase
        .from('user_quotas')
        .update({
          total_quota: newTotalQuota,
          last_daily_reward_at: now.toISOString(),
        })
        .eq('user_id', user.id)
      
      if (updateError) {
        console.error('[Daily Reward] Error updating quota:', updateError)
        return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 })
      }
      
      console.log('[Daily Reward] User', user.email, 'claimed', DAILY_REWARD_CREDITS, 'credits, new total:', newTotalQuota)
      
      return NextResponse.json({
        success: true,
        credited: true,
        creditsAdded: DAILY_REWARD_CREDITS,
        totalQuota: newTotalQuota,
        usedQuota: quotaData.used_quota || 0,
        remainingQuota: newTotalQuota - (quotaData.used_quota || 0),
      })
    } else {
      // 新用户：创建记录 (10 注册赠送 + 5 每日奖励 = 15)
      const initialQuota = 10 + DAILY_REWARD_CREDITS
      
      const { error: insertError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: user.id,
          user_email: user.email,
          total_quota: initialQuota,
          used_quota: 0,
          last_daily_reward_at: now.toISOString(),
        })
      
      if (insertError) {
        console.error('[Daily Reward] Error creating quota:', insertError)
        return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 })
      }
      
      console.log('[Daily Reward] New user', user.email, 'initialized with', initialQuota, 'credits')
      
      return NextResponse.json({
        success: true,
        credited: true,
        creditsAdded: DAILY_REWARD_CREDITS,
        isNewUser: true,
        totalQuota: initialQuota,
        usedQuota: 0,
        remainingQuota: initialQuota,
      })
    }
  } catch (error: any) {
    console.error('[Daily Reward] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - 检查今日是否已领取（不发放）
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const now = new Date()
    
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('last_daily_reward_at')
      .eq('user_id', user.id)
      .single()
    
    let canClaim = true
    
    if (quotaData?.last_daily_reward_at) {
      const lastRewardDate = new Date(quotaData.last_daily_reward_at)
      canClaim = !isSameDay(lastRewardDate, now)
    }
    
    return NextResponse.json({
      canClaim,
      rewardAmount: DAILY_REWARD_CREDITS,
    })
  } catch (error: any) {
    console.error('[Daily Reward] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
