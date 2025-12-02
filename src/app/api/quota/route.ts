import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Get current user's quota
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // Get or create user quota
    const { data, error } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (error && error.code === 'PGRST116') {
      // No quota record found, create one
      const { data: newQuota, error: insertError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: user.id,
          user_email: user.email,
          total_quota: 30,
          used_count: 0,
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating quota:', insertError)
        return NextResponse.json({ error: 'Failed to create quota' }, { status: 500 })
      }
      
      return NextResponse.json({
        totalQuota: newQuota.total_quota,
        usedCount: newQuota.used_count,
        remainingQuota: newQuota.total_quota - newQuota.used_count,
      })
    }
    
    if (error) {
      console.error('Error fetching quota:', error)
      return NextResponse.json({ error: 'Failed to fetch quota' }, { status: 500 })
    }
    
    return NextResponse.json({
      totalQuota: data.total_quota,
      usedCount: data.used_count,
      remainingQuota: data.total_quota - data.used_count,
    })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Check quota before generation (and optionally increment)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { action, imageCount = 1 } = body
    
    // Get current quota
    let { data: quota, error } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // Create quota if not exists
    if (error && error.code === 'PGRST116') {
      const { data: newQuota, error: insertError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: user.id,
          user_email: user.email,
          total_quota: 30,
          used_count: 0,
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating quota:', insertError)
        return NextResponse.json({ error: 'Failed to create quota' }, { status: 500 })
      }
      quota = newQuota
    } else if (error) {
      console.error('Error fetching quota:', error)
      return NextResponse.json({ error: 'Failed to fetch quota' }, { status: 500 })
    }
    
    const remainingQuota = quota.total_quota - quota.used_count
    
    // Check if user has enough quota
    if (action === 'check') {
      return NextResponse.json({
        hasQuota: remainingQuota >= imageCount,
        totalQuota: quota.total_quota,
        usedCount: quota.used_count,
        remainingQuota,
      })
    }
    
    // Increment used count after successful generation
    if (action === 'increment') {
      if (remainingQuota < imageCount) {
        return NextResponse.json({
          error: 'Insufficient quota',
          hasQuota: false,
          totalQuota: quota.total_quota,
          usedCount: quota.used_count,
          remainingQuota,
        }, { status: 403 })
      }
      
      const { data: updatedQuota, error: updateError } = await supabase
        .from('user_quotas')
        .update({
          used_count: quota.used_count + imageCount,
        })
        .eq('user_id', user.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Error updating quota:', updateError)
        return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        totalQuota: updatedQuota.total_quota,
        usedCount: updatedQuota.used_count,
        remainingQuota: updatedQuota.total_quota - updatedQuota.used_count,
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Quota error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

