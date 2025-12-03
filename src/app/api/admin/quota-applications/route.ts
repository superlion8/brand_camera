import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Admin emails from environment variable
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// GET - Get all quota applications (admin only)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    
    let query = supabase
      .from('quota_applications')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.limit(100)
    
    if (error) {
      console.error('Error fetching applications:', error)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }
    
    // Count pending applications
    const { count: pendingCount } = await supabase
      .from('quota_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    
    return NextResponse.json({ 
      applications: data,
      pendingCount: pendingCount || 0,
    })
  } catch (error: any) {
    console.error('Admin applications error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update application status (admin only)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { applicationId, status, adminNotes, newQuota } = body
    
    if (!applicationId || !status) {
      return NextResponse.json({ error: 'applicationId and status are required' }, { status: 400 })
    }
    
    // Update application status
    const { data: application, error: appError } = await supabase
      .from('quota_applications')
      .update({
        status,
        admin_notes: adminNotes || null,
      })
      .eq('id', applicationId)
      .select()
      .single()
    
    if (appError) {
      console.error('Error updating application:', appError)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }
    
    // If approved and newQuota is specified, update user's quota
    if (status === 'approved' && newQuota && application.user_id) {
      const { error: quotaError } = await supabase
        .from('user_quotas')
        .upsert({
          user_id: application.user_id,
          user_email: application.email,
          total_quota: newQuota,
        }, {
          onConflict: 'user_id'
        })
      
      if (quotaError) {
        console.error('Error updating quota:', quotaError)
        // Don't fail the whole request, just log the error
      }
    }
    
    return NextResponse.json({ success: true, application })
  } catch (error: any) {
    console.error('Admin applications error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

