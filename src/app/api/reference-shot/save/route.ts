import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id
  const userEmail = authResult.user.email
  
  try {
    const body = await request.json()
    const { 
      taskId, // 由 quota/reserve 创建的 pending 记录的 taskId
      imageUrls, 
      referenceImageUrl,
      inputParams 
    } = body
    
    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ success: false, error: '缺少图片 URL' }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // 如果有 taskId，先尝试更新已有的 pending 记录（由 quota/reserve 创建）
    if (taskId) {
      const { data: existingRecord } = await supabase
        .from('generations')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .single()
      
      if (existingRecord) {
        // 更新已有记录
        const { data, error } = await supabase
          .from('generations')
          .update({
            status: 'completed',
            output_image_urls: imageUrls,
            input_image_url: referenceImageUrl || null,
            input_params: inputParams || {},
            total_images_count: imageUrls.length,
          })
          .eq('id', existingRecord.id)
          .select()
          .single()
        
        if (error) {
          console.error('[ReferenceShot-Save] Update error:', error)
          return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 })
        }
        
        console.log('[ReferenceShot-Save] Updated existing generation:', data.id, 'with', imageUrls.length, 'images')
        
        return NextResponse.json({
          success: true,
          generationId: data.id,
        })
      }
    }
    
    // 没有找到已有记录，创建新记录
    const { data, error } = await supabase
      .from('generations')
      .insert({
        user_id: userId,
        user_email: userEmail,
        task_id: taskId || null,
        task_type: 'reference_shot',
        status: 'completed',
        output_image_urls: imageUrls,
        input_image_url: referenceImageUrl || null,
        input_params: inputParams || {},
        total_images_count: imageUrls.length,
      })
      .select()
      .single()
    
    if (error) {
      console.error('[ReferenceShot-Save] Insert error:', error)
      return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 })
    }
    
    console.log('[ReferenceShot-Save] Saved new generation:', data.id, 'with', imageUrls.length, 'images')
    
    return NextResponse.json({
      success: true,
      generationId: data.id,
    })
    
  } catch (error: any) {
    console.error('[ReferenceShot-Save] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '保存失败'
    }, { status: 500 })
  }
}

