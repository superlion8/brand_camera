import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { 
  calculateCreditsInfo, 
  DEFAULT_SIGNUP_CREDITS,
  type UserQuotaRecord 
} from '@/lib/quota'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// GET - Get all user quotas (admin only)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use service role client to bypass RLS
  let adminClient
  try {
    adminClient = createServiceClient()
  } catch (error) {
    console.error('[Admin] Service client error:', error)
    adminClient = supabase
  }
  
  try {
    // 直接从 user_quotas 表读取
    const { data: quotasData, error: quotaError } = await adminClient
      .from('user_quotas')
      .select('*')
      .order('updated_at', { ascending: false })
    
    if (quotaError) {
      console.error('Error fetching quotas:', quotaError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }
    
    // 获取最近活动时间
    const userIds = (quotasData || []).map(q => q.user_id)
    const { data: lastActivities } = await adminClient
      .from('generations')
      .select('user_id, created_at')
      .in('user_id', userIds.length > 0 ? userIds : ['none'])
      .order('created_at', { ascending: false })
    
    // 构建最近活动时间 map
    const lastActivityMap = new Map<string, string>()
    for (const gen of lastActivities || []) {
      if (!lastActivityMap.has(gen.user_id)) {
        lastActivityMap.set(gen.user_id, gen.created_at)
      }
    }
    
    // 获取 auth.users 的真实标识（email 或 phone）
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    const userIdentityMap = new Map<string, string>()
    for (const authUser of authUsers?.users || []) {
      const phone = authUser.phone
      const email = authUser.email
      const identity = phone || email || authUser.id
      userIdentityMap.set(authUser.id, identity)
    }
    
    // Format response
    const quotas = (quotasData || []).map(q => {
      const credits = calculateCreditsInfo(q as UserQuotaRecord)
      return {
        id: q.user_id,
        userId: q.user_id,
        userEmail: userIdentityMap.get(q.user_id) || q.user_email || q.user_id,
        // 新的 credits 详情
        credits: {
          available: credits.available,
          daily: credits.daily,
          subscription: credits.subscription,
          signup: credits.signup,
          adminGive: credits.adminGive,
          purchased: credits.purchased,
          dailyExpired: credits.dailyExpired,
        },
        // 向后兼容：直接读取 used_credits 字段
        totalQuota: credits.available + (q.used_credits || 0),
        usedCount: q.used_credits || 0,
        remainingQuota: credits.available,
        updatedAt: lastActivityMap.get(q.user_id) || q.updated_at,
      }
    })
    
    return NextResponse.json({ quotas })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update user's quota (admin only)
// 支持更新各种类型的 credits
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use service role client to bypass RLS
  let adminClient
  try {
    adminClient = createServiceClient()
  } catch (error) {
    console.error('[Admin] Service client error:', error)
    adminClient = supabase
  }
  
  try {
    const body = await request.json()
    const { 
      userId, 
      userEmail,
      // 新字段
      signupCredits,
      adminGiveCredits,
      purchasedCredits,
      subscriptionCredits,
      // 向后兼容
      totalQuota,
    } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    // 构建更新对象
    const updateData: any = {}
    
    if (userEmail !== undefined) {
      updateData.user_email = userEmail
    }
    
    // 优先使用新字段
    if (signupCredits !== undefined) {
      updateData.signup_credits = signupCredits
    }
    if (adminGiveCredits !== undefined) {
      updateData.admin_give_credits = adminGiveCredits
    }
    if (purchasedCredits !== undefined) {
      updateData.purchased_credits = purchasedCredits
    }
    if (subscriptionCredits !== undefined) {
      updateData.subscription_credits = subscriptionCredits
    }
    
    // 向后兼容：如果只传了 totalQuota，转换为 admin_give_credits
    // 这样 admin 通过旧接口加的 credits 会记录到 admin_give_credits
    if (totalQuota !== undefined && signupCredits === undefined && adminGiveCredits === undefined && purchasedCredits === undefined) {
      // 获取当前数据
      const { data: existing } = await adminClient
        .from('user_quotas')
        .select('signup_credits, admin_give_credits, purchased_credits, subscription_credits')
        .eq('user_id', userId)
        .single()
      
      const currentSignup = existing?.signup_credits ?? DEFAULT_SIGNUP_CREDITS
      const currentAdminGive = existing?.admin_give_credits ?? 0
      const currentPurchased = existing?.purchased_credits ?? 0
      const currentSubscription = existing?.subscription_credits ?? 0
      const currentTotal = currentSignup + currentAdminGive + currentPurchased + currentSubscription
      
      // 计算需要增加的 credits，记录到 admin_give_credits
      const toAdd = Math.max(0, totalQuota - currentTotal)
      if (toAdd > 0) {
        updateData.admin_give_credits = currentAdminGive + toAdd
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    
    // Upsert user_quotas
    const { data, error } = await adminClient
      .from('user_quotas')
      .upsert({
        user_id: userId,
        ...updateData,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error updating quota:', error)
      return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
    }
    
    const credits = calculateCreditsInfo(data as UserQuotaRecord)
    
    return NextResponse.json({
      success: true,
      quota: {
        id: data.user_id,
        userId: data.user_id,
        userEmail: data.user_email,
        credits: {
          available: credits.available,
          daily: credits.daily,
          subscription: credits.subscription,
          signup: credits.signup,
          adminGive: credits.adminGive,
          purchased: credits.purchased,
        },
        // 向后兼容
        totalQuota: credits.available,
        usedCount: 0,
        remainingQuota: credits.available,
      }
    })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
