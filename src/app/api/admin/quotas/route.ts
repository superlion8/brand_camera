import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
const DEFAULT_QUOTA = 30

// GET - Get all user quotas (admin only)
// 直接从 user_quotas 表读取，速度更快
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
      .order('used_quota', { ascending: false })
    
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
    
    // Format response
    const quotas = (quotasData || []).map(q => ({
      id: q.user_id,
      userId: q.user_id,
      userEmail: q.user_email || q.user_id,
      totalQuota: q.total_quota || DEFAULT_QUOTA,
      usedCount: q.used_quota || 0,
      remainingQuota: Math.max(0, (q.total_quota || DEFAULT_QUOTA) - (q.used_quota || 0)),
      updatedAt: lastActivityMap.get(q.user_id) || q.updated_at,
    }))
    
    return NextResponse.json({ quotas })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update user's total quota limit (admin only)
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
    const { userId, totalQuota, userEmail } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    if (typeof totalQuota !== 'number') {
      return NextResponse.json({ error: 'totalQuota is required' }, { status: 400 })
    }
    
    // 先获取当前的 used_quota
    const { data: existingQuota } = await adminClient
      .from('user_quotas')
      .select('used_quota')
      .eq('user_id', userId)
      .single()
    
    const currentUsed = existingQuota?.used_quota || 0
    
    // Upsert user_quotas
    const { data, error } = await adminClient
      .from('user_quotas')
      .upsert({
        user_id: userId,
        user_email: userEmail,
        total_quota: totalQuota,
        used_quota: currentUsed, // 保留现有的 used_quota
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error updating quota:', error)
      return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      quota: {
        id: data.id,
        userId: data.user_id,
        userEmail: data.user_email,
        totalQuota: data.total_quota,
        usedCount: data.used_quota || 0,
        remainingQuota: Math.max(0, data.total_quota - (data.used_quota || 0)),
      }
    })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
