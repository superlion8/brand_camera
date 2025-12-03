import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Submit a new quota application
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { email, reason, feedback, currentQuota, usedCount } = body
    
    if (!email || !reason) {
      return NextResponse.json({ error: 'Email and reason are required' }, { status: 400 })
    }
    
    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('quota_applications')
      .insert({
        user_id: user?.id || null,
        email,
        reason,
        feedback: feedback || null,
        current_quota: currentQuota || 30,
        used_count: usedCount || 0,
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating application:', error)
      return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, application: data })
  } catch (error: any) {
    console.error('Quota application error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

