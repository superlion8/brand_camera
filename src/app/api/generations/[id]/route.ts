import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 删除 generation
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
      .from('generations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[Generations] Error deleting generation:', error)
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Generations] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '删除失败' },
      { status: 500 }
    )
  }
}

