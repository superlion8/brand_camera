import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  calculateCreditsInfo, 
  consumeCredits, 
  refundCredits,
  createDefaultQuota,
  isToday,
  type UserQuotaRecord 
} from '@/lib/quota'

// POST - Reserve quota: 按优先级从各 credits 字段扣除
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
    
    // 1. 获取用户当前 quota
    let { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // 如果没有记录，创建一个
    if (!quotaData) {
      const defaultQuota = createDefaultQuota(user.id, user.email)
      const { data: created, error: createError } = await supabase
        .from('user_quotas')
        .insert(defaultQuota)
        .select()
        .single()
      
      if (createError) {
        console.error('[Quota Reserve] Error creating quota:', createError)
        return NextResponse.json({ error: 'Failed to create quota' }, { status: 500 })
      }
      quotaData = created
    }
    
    // 2. 计算可用余额并检查
    const credits = calculateCreditsInfo(quotaData as UserQuotaRecord)
    
    if (credits.available < imageCount) {
      return NextResponse.json({ 
        error: 'Insufficient quota',
        credits: {
          available: credits.available,
          required: imageCount,
        },
      }, { status: 403 })
    }
    
    // 3. 计算扣费后的新余额
    const newBalances = consumeCredits(quotaData as UserQuotaRecord, imageCount)
    
    if (!newBalances) {
      return NextResponse.json({ 
        error: 'Failed to calculate new balance',
      }, { status: 500 })
    }
    
    // 4. 更新数据库（原子操作）
    const updateData: any = {
      subscription_credits: newBalances.subscription_credits,
      signup_credits: newBalances.signup_credits,
      admin_give_credits: newBalances.admin_give_credits,
      purchased_credits: newBalances.purchased_credits,
      // 累加已用 credits
      used_credits: (quotaData.used_credits || 0) + imageCount,
    }
    
    // 只有当今天的每日奖励有效时才更新 daily_credits
    if (isToday(quotaData.daily_credits_date)) {
      updateData.daily_credits = newBalances.daily_credits
    }
    
    const { error: updateError } = await supabase
      .from('user_quotas')
      .update(updateData)
      .eq('user_id', user.id)
    
    if (updateError) {
      console.error('[Quota Reserve] Error updating quota:', updateError)
      return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
    }
    
    // 5. 创建 pending generation 记录
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
      
      // 回滚：把扣掉的 credits 加回去，同时减少 used_credits
      const rollbackData: any = {
        subscription_credits: quotaData.subscription_credits,
        signup_credits: quotaData.signup_credits,
        admin_give_credits: quotaData.admin_give_credits,
        purchased_credits: quotaData.purchased_credits,
        used_credits: quotaData.used_credits || 0,  // 恢复原值
      }
      if (isToday(quotaData.daily_credits_date)) {
        rollbackData.daily_credits = quotaData.daily_credits
      }
      
      await supabase
        .from('user_quotas')
        .update(rollbackData)
        .eq('user_id', user.id)
      
      return NextResponse.json({ error: 'Failed to reserve quota' }, { status: 500 })
    }
    
    const newCredits = calculateCreditsInfo({
      ...quotaData,
      ...updateData,
    } as UserQuotaRecord)
    
    console.log('[Quota Reserve] Reserved', imageCount, 'credits for task', taskId, 
      'remaining:', newCredits.available)
    
    return NextResponse.json({ 
      success: true, 
      reservationId: data.id,
      imageCount,
      credits: {
        available: newCredits.available,
      },
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
    
    // 3. 退还额度并减少 used_credits
    if (refundCount > 0) {
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (quotaData) {
        const newBalances = refundCredits(quotaData as UserQuotaRecord, refundCount)
        
        await supabase
          .from('user_quotas')
          .update({
            subscription_credits: newBalances.subscription_credits,
            signup_credits: newBalances.signup_credits,
            admin_give_credits: newBalances.admin_give_credits,
            purchased_credits: newBalances.purchased_credits,
            // daily_credits 不退还（因为可能已经过期）
            // 减少 used_credits（退款意味着没有实际使用）
            used_credits: Math.max(0, (quotaData.used_credits || 0) - refundCount),
          })
          .eq('user_id', user.id)
        
        console.log('[Quota Release] Refunded', refundCount, 'credits, reduced used_credits')
      }
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
    const { reservationId, taskId, actualImageCount, refundCount: explicitRefund } = body
    
    if (!reservationId && !taskId) {
      return NextResponse.json({ error: 'reservationId or taskId is required' }, { status: 400 })
    }
    
    // 0. 先查询原始预扣数量
    let selectQuery = supabase
      .from('generations')
      .select('total_images_count')
      .eq('user_id', user.id)
    
    if (reservationId) {
      selectQuery = selectQuery.eq('id', reservationId)
    } else if (taskId) {
      selectQuery = selectQuery.eq('task_id', taskId)
    }
    
    const { data: genData } = await selectQuery.single()
    const originalCount = genData?.total_images_count || 0
    
    // 1. 更新 generation 记录状态
    let updateQuery = supabase
      .from('generations')
      .update({ 
        total_images_count: actualImageCount,
        status: actualImageCount > 0 ? 'completed' : 'failed',
      })
      .eq('user_id', user.id)
    
    if (reservationId) {
      updateQuery = updateQuery.eq('id', reservationId)
    } else if (taskId) {
      updateQuery = updateQuery.eq('task_id', taskId)
    }
    
    const { error } = await updateQuery
    
    if (error) {
      console.error('[Quota Update] Error:', error)
      return NextResponse.json({ error: 'Failed to update quota' }, { status: 500 })
    }
    
    // 2. 计算退款数量（如果没有显式提供，则自动计算）
    const refundCount = explicitRefund ?? Math.max(0, originalCount - actualImageCount)
    
    if (refundCount > 0) {
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (quotaData) {
        const newBalances = refundCredits(quotaData as UserQuotaRecord, refundCount)
        
        await supabase
          .from('user_quotas')
          .update({
            subscription_credits: newBalances.subscription_credits,
            signup_credits: newBalances.signup_credits,
            admin_give_credits: newBalances.admin_give_credits,
            purchased_credits: newBalances.purchased_credits,
            // 部分退款时减少 used_credits
            used_credits: Math.max(0, (quotaData.used_credits || 0) - refundCount),
          })
          .eq('user_id', user.id)
        
        console.log('[Quota Update] Refunded', refundCount, 'credits (original:', originalCount, ', actual:', actualImageCount, '), reduced used_credits')
      }
    }
    
    return NextResponse.json({ success: true, refundedCount: refundCount })
  } catch (error: any) {
    console.error('[Quota Update] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
