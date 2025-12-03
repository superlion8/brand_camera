import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Reserve quota by creating a pending generation record
// This immediately deducts quota when task starts
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { taskId, imageCount, taskType } = body
    
    if (!taskId || !imageCount) {
      return NextResponse.json({ error: 'taskId and imageCount are required' }, { status: 400 })
    }
    
    // Create a pending generation record to reserve quota
    const { data, error } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        user_email: user.email,
        task_id: taskId,
        task_type: taskType || 'model_studio',
        status: 'pending',
        total_images_count: imageCount,
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Quota Reserve] Error:', error)
      return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
    }
    
    console.log('[Quota Reserve] Reserved', imageCount, 'images for task', taskId)
    
    return NextResponse.json({ 
      success: true, 
      reservationId: data.id,
      imageCount,
    })
  } catch (error: any) {
    console.error('[Quota Reserve] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Release reserved quota (refund)
// Call this when generation fails
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('id')
    const taskId = searchParams.get('taskId')
    
    if (!reservationId && !taskId) {
      return NextResponse.json({ error: 'id or taskId is required' }, { status: 400 })
    }
    
    // Delete the pending generation record to release quota
    let query = supabase
      .from('generations')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')
    
    if (reservationId) {
      query = query.eq('id', reservationId)
    } else if (taskId) {
      query = query.eq('task_id', taskId)
    }
    
    const { error } = await query
    
    if (error) {
      console.error('[Quota Release] Error:', error)
      return NextResponse.json({ error: 'Failed to release quota' }, { status: 500 })
    }
    
    console.log('[Quota Release] Released quota for', reservationId || taskId)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Quota Release] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update reserved quota with actual results
// Call this when generation completes (partial success or full success)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { reservationId, taskId, actualImageCount, refundCount } = body
    
    if (!reservationId && !taskId) {
      return NextResponse.json({ error: 'reservationId or taskId is required' }, { status: 400 })
    }
    
    // If we need to refund some images
    if (refundCount && refundCount > 0) {
      // Update the total_images_count to reflect actual generated images
      let query = supabase
        .from('generations')
        .update({ 
          total_images_count: actualImageCount,
          status: actualImageCount > 0 ? 'completed' : 'failed',
        })
        .eq('user_id', user.id)
      
      if (reservationId) {
        query = query.eq('id', reservationId)
      } else if (taskId) {
        query = query.eq('task_id', taskId)
      }
      
      const { error } = await query
      
      if (error) {
        console.error('[Quota Update] Error:', error)
        return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
      }
      
      console.log('[Quota Update] Refunded', refundCount, 'images, actual:', actualImageCount)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Quota Update] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

