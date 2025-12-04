import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_QUOTA = 30

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
    return retry || { total_quota: DEFAULT_QUOTA, used_quota: 0 }
  }
  
  return created
}

// GET - Get current user's quota (直接从 user_quotas 表读取)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const quotaData = await getOrCreateUserQuota(supabase, user.id, user.email)
    
    const totalQuota = quotaData.total_quota || DEFAULT_QUOTA
    const usedCount = quotaData.used_quota || 0
    
    return NextResponse.json({
      totalQuota,
      usedCount,
      remainingQuota: Math.max(0, totalQuota - usedCount),
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
    
    const totalQuota = quotaData.total_quota || DEFAULT_QUOTA
    const usedCount = quotaData.used_quota || 0
    const remainingQuota = Math.max(0, totalQuota - usedCount)
    
    return NextResponse.json({
      hasQuota: remainingQuota >= imageCount,
      totalQuota,
      usedCount,
      remainingQuota,
    })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
