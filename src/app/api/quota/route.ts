import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_QUOTA = 30

// GET - Get current user's quota (count from generations table)
// Includes pending/processing tasks to deduct quota upfront
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // Count total images from generations table
    // Include pending, processing, and completed tasks (deduct quota when task starts)
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('output_image_urls, total_images_count, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing', 'completed'])
    
    if (genError) {
      console.error('Error fetching generations:', genError)
      return NextResponse.json({ error: 'Failed to fetch quota' }, { status: 500 })
    }
    
    // Calculate total images
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
    
    // Check if user has custom quota in user_quotas table
    let totalQuota = DEFAULT_QUOTA
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('total_quota')
      .eq('user_id', user.id)
      .single()
    
    if (quotaData?.total_quota) {
      totalQuota = quotaData.total_quota
    }
    
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
// Includes pending/processing tasks to deduct quota upfront
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
    
    // Only support 'check' action now (increment is handled automatically when generation is saved)
    if (action !== 'check') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
    // Count total images from generations table
    // Include pending, processing, and completed tasks
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('output_image_urls, total_images_count, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing', 'completed'])
    
    if (genError) {
      console.error('Error fetching generations:', genError)
      return NextResponse.json({ error: 'Failed to check quota' }, { status: 500 })
    }
    
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
    
    // Check custom quota
    let totalQuota = DEFAULT_QUOTA
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('total_quota')
      .eq('user_id', user.id)
      .single()
    
    if (quotaData?.total_quota) {
      totalQuota = quotaData.total_quota
    }
    
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

