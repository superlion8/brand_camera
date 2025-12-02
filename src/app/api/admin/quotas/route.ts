import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  
  try {
    const { data: quotas, error } = await supabase
      .from('user_quotas')
      .select('*')
      .order('updated_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching quotas:', error)
      return NextResponse.json({ error: 'Failed to fetch quotas' }, { status: 500 })
    }
    
    // Format response
    const formattedQuotas = quotas?.map(q => ({
      id: q.id,
      userId: q.user_id,
      userEmail: q.user_email || q.user_id,
      totalQuota: q.total_quota,
      usedCount: q.used_count,
      remainingQuota: q.total_quota - q.used_count,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    }))
    
    return NextResponse.json({ quotas: formattedQuotas })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update user quota (admin only)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { userId, totalQuota, usedCount } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    const updateData: Record<string, any> = {}
    if (typeof totalQuota === 'number') {
      updateData.total_quota = totalQuota
    }
    if (typeof usedCount === 'number') {
      updateData.used_count = usedCount
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('user_quotas')
      .update(updateData)
      .eq('user_id', userId)
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
        usedCount: data.used_count,
        remainingQuota: data.total_quota - data.used_count,
      }
    })
  } catch (error: any) {
    console.error('Admin quotas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

