import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_QUOTA = 30

// POST - Reserve quota: 直接从 user_quotas.used_quota 扣除
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
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
    
    // 1. 先检查并扣除额度（原子操作）
    // 使用 RPC 或直接 update with check
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    let totalQuota = DEFAULT_QUOTA
    let currentUsed = 0
    
    if (quotaData) {
      totalQuota = quotaData.total_quota || DEFAULT_QUOTA
      currentUsed = quotaData.used_quota || 0
    }
    
    // 检查额度是否足够
    if (currentUsed + imageCount > totalQuota) {
      return NextResponse.json({ 
        error: 'Insufficient quota',
        totalQuota,
        usedCount: currentUsed,
        remainingQuota: totalQuota - currentUsed,
      }, { status: 403 })
    }
    
    // 扣除额度
    if (quotaData) {
      // 更新现有记录
      const { error: updateError } = await supabase
        .from('user_quotas')
        .update({ used_quota: currentUsed + imageCount })
        .eq('user_id', user.id)
      
      if (updateError) {
        console.error('[Quota Reserve] Error updating quota:', updateError)
        return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
      }
    } else {
      // 创建新记录
      const { error: insertError } = await supabase
        .from('user_quotas')
        .insert({
          user_id: user.id,
          user_email: user.email,
          total_quota: DEFAULT_QUOTA,
          used_quota: imageCount,
        })
      
      if (insertError) {
        console.error('[Quota Reserve] Error creating quota:', insertError)
        return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
      }
    }
    
    // 2. 创建 pending generation 记录
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
      // 如果创建失败，回滚额度
      console.error('[Quota Reserve] Error creating generation, rolling back:', error)
      await supabase
        .from('user_quotas')
        .update({ used_quota: currentUsed })
        .eq('user_id', user.id)
      
      return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
    }
    
    console.log('[Quota Reserve] Reserved', imageCount, 'images for task', taskId, 'used:', currentUsed + imageCount)
    
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

// DELETE - Release reserved quota (完全退款，用于任务完全取消)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  
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
    
    // 1. 查询要删除的记录，获取 total_images_count
    let query = supabase
      .from('generations')
      .select('total_images_count')
      .eq('user_id', user.id)
      .eq('status', 'pending')
    
    if (reservationId) {
      query = query.eq('id', reservationId)
    } else if (taskId) {
      query = query.eq('task_id', taskId)
    }
    
    const { data: genData } = await query.single()
    const refundCount = genData?.total_images_count || 0
    
    // 2. 删除 pending generation 记录
    let deleteQuery = supabase
      .from('generations')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')
    
    if (reservationId) {
      deleteQuery = deleteQuery.eq('id', reservationId)
    } else if (taskId) {
      deleteQuery = deleteQuery.eq('task_id', taskId)
    }
    
    const { error } = await deleteQuery
    
    if (error) {
      console.error('[Quota Release] Error:', error)
      return NextResponse.json({ error: 'Failed to release quota' }, { status: 500 })
    }
    
    // 3. 退还额度
    if (refundCount > 0) {
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('used_quota')
        .eq('user_id', user.id)
        .single()
      
      const currentUsed = quotaData?.used_quota || 0
      const newUsed = Math.max(0, currentUsed - refundCount)
      
      await supabase
        .from('user_quotas')
        .update({ used_quota: newUsed })
        .eq('user_id', user.id)
      
      console.log('[Quota Release] Refunded', refundCount, 'images, new used:', newUsed)
    }
    
    return NextResponse.json({ success: true, refundedCount: refundCount })
  } catch (error: any) {
    console.error('[Quota Release] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update quota after generation (部分退款，用于部分失败)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  
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
    
    // 1. 更新 generation 记录状态
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
    
    // 2. 如果有退款，退还额度
    if (refundCount && refundCount > 0) {
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('used_quota')
        .eq('user_id', user.id)
        .single()
      
      const currentUsed = quotaData?.used_quota || 0
      const newUsed = Math.max(0, currentUsed - refundCount)
      
      await supabase
        .from('user_quotas')
        .update({ used_quota: newUsed })
        .eq('user_id', user.id)
      
      console.log('[Quota Update] Refunded', refundCount, 'images, actual:', actualImageCount, 'new used:', newUsed)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Quota Update] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
