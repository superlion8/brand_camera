import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 取消收藏
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const { id } = params

    const supabase = await createServiceClient()

    // 软删除（设置 deleted_at）
    const { error } = await supabase
      .from('favorites')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[Favorites] Error deleting favorite:', error)
      return NextResponse.json(
        { success: false, error: '取消收藏失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Favorites] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '取消收藏失败' },
      { status: 500 }
    )
  }
}

