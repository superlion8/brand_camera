import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * 根据 taskId 获取生成记录
 * GET /api/generations?taskId=xxx
 */
export async function GET(request: NextRequest) {
  // 检查认证
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    
    if (!taskId) {
      return NextResponse.json({ success: false, error: '缺少 taskId 参数' }, { status: 400 })
    }
    
    const supabase = createServiceClient()
    
    // 根据 task_id 查询生成记录
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // 没有找到记录
        return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 })
      }
      console.error('[Generations] Error fetching generation:', error)
      return NextResponse.json({ success: false, error: '获取任务失败' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        taskId: data.task_id,
        taskType: data.task_type,
        status: data.status,
        output_image_urls: data.output_image_urls,
        output_gen_modes: data.output_gen_modes,
        output_model_types: data.output_model_types,
        input_image_url: data.input_image_url,
        input_image2_url: data.input_image2_url,
        model_image_url: data.model_image_url,
        background_image_url: data.background_image_url,
        input_params: data.input_params,
        prompts: data.prompts,
        created_at: data.created_at,
      }
    })
  } catch (error: any) {
    console.error('[Generations] Unexpected error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}

