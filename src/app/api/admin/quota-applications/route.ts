import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  
  // Use service role client to bypass RLS for admin queries
  let adminClient
  try {
    adminClient = createServiceClient()
  } catch (error) {
    console.error('[Admin] Service client error:', error)
    // Fallback to regular client if service key not configured
    adminClient = supabase
  }
  
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    
    let query = adminClient
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
    const { count: pendingCount } = await adminClient
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
  
  // Use service role client to bypass RLS for admin operations
  let adminClient
  try {
    adminClient = createServiceClient()
  } catch (error) {
    console.error('[Admin] Service client error:', error)
    adminClient = supabase
  }
  
  try {
    const body = await request.json()
    console.log('[Quota Applications PUT] Request body:', body)
    
    const { applicationId, status, adminNotes, newQuota } = body
    
    if (!applicationId || !status) {
      return NextResponse.json({ error: 'applicationId and status are required' }, { status: 400 })
    }
    
    // Update application status
    const { data: application, error: appError } = await adminClient
      .from('quota_applications')
      .update({
        status,
        admin_notes: adminNotes || null,
      })
      .eq('id', applicationId)
      .select()
      .single()
    
    if (appError) {
      console.error('[Quota Applications PUT] Error updating application:', appError)
      return NextResponse.json({ 
        error: 'Failed to update application', 
        details: appError.message,
        code: appError.code 
      }, { status: 500 })
    }
    
    console.log('[Quota Applications PUT] Updated application:', application)
    
    // If approved and newQuota is specified, update user's quota
    // Also support updating quota by email if user_id is not available
    if (status === 'approved' && newQuota) {
      if (application.user_id) {
        const { error: quotaError } = await adminClient
          .from('user_quotas')
          .upsert({
            user_id: application.user_id,
            user_email: application.email,
            total_quota: newQuota,
          }, {
            onConflict: 'user_id'
          })
        
        if (quotaError) {
          console.error('[Quota Applications PUT] Error updating quota by user_id:', quotaError)
        } else {
          console.log('[Quota Applications PUT] Updated quota for user_id:', application.user_id)
        }
      } else {
        // Try to find user by email and update quota
        const { data: userData } = await adminClient.auth.admin.listUsers()
        const targetUser = userData?.users?.find(u => u.email?.toLowerCase() === application.email?.toLowerCase())
        
        if (targetUser) {
          const { error: quotaError } = await adminClient
            .from('user_quotas')
            .upsert({
              user_id: targetUser.id,
              user_email: application.email,
              total_quota: newQuota,
            }, {
              onConflict: 'user_id'
            })
          
          if (quotaError) {
            console.error('[Quota Applications PUT] Error updating quota by email:', quotaError)
          } else {
            console.log('[Quota Applications PUT] Updated quota for email:', application.email)
          }
        } else {
          console.log('[Quota Applications PUT] User not found for email:', application.email)
        }
      }
    }
    
    return NextResponse.json({ success: true, application })
  } catch (error: any) {
    console.error('[Quota Applications PUT] Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

