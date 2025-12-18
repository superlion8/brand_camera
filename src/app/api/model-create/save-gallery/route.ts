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
      imageUrls, 
      prompts, 
      inputImageUrl,
      inputParams 
    } = body
    
    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ success: false, error: '缺少图片 URL' }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // Create generation record
    const { data, error } = await supabase
      .from('generations')
      .insert({
        user_id: userId,
        user_email: userEmail,
        task_type: 'create_model',
        status: 'completed',
        output_image_urls: imageUrls,
        prompts: prompts || [],
        input_image_url: inputImageUrl || null,
        input_params: inputParams || {},
        total_images_count: imageUrls.length,
      })
      .select()
      .single()
    
    if (error) {
      console.error('[SaveGallery] Insert error:', error)
      return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 })
    }
    
    console.log('[SaveGallery] Saved generation:', data.id, 'with', imageUrls.length, 'images')
    
    return NextResponse.json({
      success: true,
      generationId: data.id,
    })
    
  } catch (error: any) {
    console.error('[SaveGallery] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '保存失败'
    }, { status: 500 })
  }
}

