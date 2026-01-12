import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  calculateCreditsInfo, 
  createDefaultQuota,
  getTodayDateString,
  DAILY_REWARD_CREDITS,
  DEFAULT_SIGNUP_CREDITS,
  type UserQuotaRecord 
} from '@/lib/quota'

// POST - 领取每日登录奖励
// 每日奖励当天有效，次日自动清零
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const today = getTodayDateString()
    
    // 1. 获取用户额度信息
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // 2. 检查是否已领取今日奖励
    if (quotaData?.daily_credits_date === today) {
      // 今天已经领取过了
      const credits = calculateCreditsInfo(quotaData as UserQuotaRecord)
      return NextResponse.json({
        success: true,
        credited: false,
        message: 'Already claimed today',
        credits: {
          available: credits.available,
          daily: credits.daily,
          subscription: credits.subscription,
          signup: credits.signup,
          adminGive: credits.adminGive,
          purchased: credits.purchased,
        },
      })
    }
    
    // 3. 发放奖励（直接覆盖，不累加）
    if (quotaData) {
      // 更新现有记录：设置 daily_credits 和 daily_credits_date
      // 注意：这会清零昨天未使用的 daily_credits
      const { error: updateError } = await supabase
        .from('user_quotas')
        .update({
          daily_credits: DAILY_REWARD_CREDITS,
          daily_credits_date: today,
        })
        .eq('user_id', user.id)
      
      if (updateError) {
        console.error('[Daily Reward] Error updating quota:', updateError)
        return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 })
      }
      
      // 计算更新后的余额
      const newQuotaData = {
        ...quotaData,
        daily_credits: DAILY_REWARD_CREDITS,
        daily_credits_date: today,
      } as UserQuotaRecord
      const credits = calculateCreditsInfo(newQuotaData)
      
      console.log('[Daily Reward] User', user.email, 'claimed', DAILY_REWARD_CREDITS, 
        'daily credits, available:', credits.available)
      
      return NextResponse.json({
        success: true,
        credited: true,
        creditsAdded: DAILY_REWARD_CREDITS,
        credits: {
          available: credits.available,
          daily: credits.daily,
          subscription: credits.subscription,
          signup: credits.signup,
          adminGive: credits.adminGive,
          purchased: credits.purchased,
        },
      })
    } else {
      // 新用户：创建记录（注册赠送 + 每日奖励）
      const newQuota = {
        ...createDefaultQuota(user.id, user.email),
        daily_credits: DAILY_REWARD_CREDITS,
        daily_credits_date: today,
      }
      
      const { error: insertError } = await supabase
        .from('user_quotas')
        .insert(newQuota)
      
      if (insertError) {
        console.error('[Daily Reward] Error creating quota:', insertError)
        return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 })
      }
      
      const credits = calculateCreditsInfo(newQuota as UserQuotaRecord)
      
      console.log('[Daily Reward] New user', user.email, 'initialized with', 
        DEFAULT_SIGNUP_CREDITS, 'signup +', DAILY_REWARD_CREDITS, 'daily credits')
      
      return NextResponse.json({
        success: true,
        credited: true,
        creditsAdded: DAILY_REWARD_CREDITS,
        isNewUser: true,
        credits: {
          available: credits.available,
          daily: credits.daily,
          subscription: credits.subscription,
          signup: credits.signup,
          adminGive: credits.adminGive,
          purchased: credits.purchased,
        },
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
    const today = getTodayDateString()
    
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('daily_credits_date, daily_credits')
      .eq('user_id', user.id)
      .single()
    
    const alreadyClaimed = quotaData?.daily_credits_date === today
    const expiredCredits = quotaData?.daily_credits_date && 
                          quotaData.daily_credits_date !== today && 
                          (quotaData.daily_credits || 0) > 0
    
    return NextResponse.json({
      canClaim: !alreadyClaimed,
      alreadyClaimed,
      rewardAmount: DAILY_REWARD_CREDITS,
      // 如果有过期的每日 credits，提示用户
      expiredCredits: expiredCredits ? quotaData.daily_credits : 0,
    })
  } catch (error: any) {
    console.error('[Daily Reward] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
