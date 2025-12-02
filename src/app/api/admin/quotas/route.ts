import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
const DEFAULT_QUOTA = 30

// GET - Get all user quotas (admin only)
// Calculates used count from generations table
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // Get all generations grouped by user
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('user_id, user_email, output_image_urls, total_images_count, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    
    if (genError) {
      console.error('Error fetching generations:', genError)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }
    
    // Get custom quotas if any
    const { data: customQuotas } = await supabase
      .from('user_quotas')
      .select('user_id, user_email, total_quota, updated_at')
    
    const customQuotaMap = new Map(
      (customQuotas || []).map(q => [q.user_id, q])
    )
    
    // Calculate per-user stats
    const userStats = new Map<string, {
      userId: string
      userEmail: string
      usedCount: number
      totalQuota: number
      lastActivity: string
    }>()
    
    for (const gen of generations || []) {
      const userId = gen.user_id
      let imageCount = 0
      
      if (gen.total_images_count) {
        imageCount = gen.total_images_count
      } else if (gen.output_image_urls && Array.isArray(gen.output_image_urls)) {
        imageCount = gen.output_image_urls.length
      }
      
      if (!userStats.has(userId)) {
        const customQuota = customQuotaMap.get(userId)
        userStats.set(userId, {
          userId,
          userEmail: gen.user_email || customQuota?.user_email || userId,
          usedCount: 0,
          totalQuota: customQuota?.total_quota || DEFAULT_QUOTA,
          lastActivity: gen.created_at,
        })
      }
      
      const stats = userStats.get(userId)!
      stats.usedCount += imageCount
    }
    
    // Also add users with custom quotas but no generations
    for (const [userId, quota] of customQuotaMap) {
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId,
          userEmail: quota.user_email || userId,
          usedCount: 0,
          totalQuota: quota.total_quota,
          lastActivity: quota.updated_at,
        })
      }
    }
    
    // Format response
    const quotas = Array.from(userStats.values())
      .map(s => ({
        id: s.userId,
        userId: s.userId,
        userEmail: s.userEmail,
        totalQuota: s.totalQuota,
        usedCount: s.usedCount,
        remainingQuota: Math.max(0, s.totalQuota - s.usedCount),
        updatedAt: s.lastActivity,
      }))
      .sort((a, b) => b.usedCount - a.usedCount) // Sort by usage
    
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
  
  try {
    const body = await request.json()
    const { userId, totalQuota, userEmail } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    if (typeof totalQuota !== 'number') {
      return NextResponse.json({ error: 'totalQuota is required' }, { status: 400 })
    }
    
    // Upsert user_quotas (only stores total_quota limit, not used count)
    const { data, error } = await supabase
      .from('user_quotas')
      .upsert({
        user_id: userId,
        user_email: userEmail,
        total_quota: totalQuota,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error updating quota:', error)
      return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
    }
    
    // Get actual used count from generations
    const { data: generations } = await supabase
      .from('generations')
      .select('output_image_urls, total_images_count')
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    let usedCount = 0
    if (generations) {
      for (const gen of generations) {
        if (gen.total_images_count) {
          usedCount += gen.total_images_count
        } else if (gen.output_image_urls && Array.isArray(gen.output_image_urls)) {
          usedCount += gen.output_image_urls.length
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      quota: {
        id: data.id,
        userId: data.user_id,
        userEmail: data.user_email,
        totalQuota: data.total_quota,
        usedCount,
        remainingQuota: Math.max(0, data.total_quota - usedCount),
      }
    })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

