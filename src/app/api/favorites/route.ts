import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generateId } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// 添加收藏
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const body = await request.json()
    const { generationId, imageIndex } = body

    if (!generationId || imageIndex === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 检查是否已收藏
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('generation_id', generationId)
      .eq('image_index', imageIndex)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: '已经收藏过了' },
        { status: 400 }
      )
    }

    // 添加收藏
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        id: generateId(),
        user_id: userId,
        generation_id: generationId,
        image_index: imageIndex,
      })
      .select()
      .single()

    if (error) {
      console.error('[Favorites] Error creating favorite:', error)
      return NextResponse.json(
        { success: false, error: '收藏失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Favorites] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '收藏失败' },
      { status: 500 }
    )
  }
}

