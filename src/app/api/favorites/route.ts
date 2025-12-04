import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

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

    console.log('[Favorites] POST request:', { userId, generationId, imageIndex })

    if (!generationId || imageIndex === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 检查是否已收藏 - 使用 maybeSingle() 而不是 single()，避免无匹配时抛错
    const { data: existing, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('generation_id', generationId)
      .eq('image_index', imageIndex)
      .is('deleted_at', null)
      .maybeSingle()

    if (checkError) {
      console.error('[Favorites] Error checking existing:', checkError)
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: '已经收藏过了' },
        { status: 400 }
      )
    }

    // 添加收藏 - 不指定 id，让数据库自动生成 UUID
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        generation_id: generationId,
        image_index: imageIndex,
      })
      .select()
      .single()

    if (error) {
      console.error('[Favorites] Error creating favorite:', error.message, error.code, error.details)
      // 外键错误 - generation 不存在
      if (error.code === '23503') {
        return NextResponse.json(
          { success: false, error: '该图片记录不存在，请刷新后重试' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { success: false, error: `收藏失败: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('[Favorites] Favorite created:', data?.id)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Favorites] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '收藏失败' },
      { status: 500 }
    )
  }
}

