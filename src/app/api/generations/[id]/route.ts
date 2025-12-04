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

    const supabase = createServiceClient()

    // 判断 id 是 UUID 还是 task_id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    // 软删除（设置 deleted_at）- 支持 id 或 task_id
    let query = supabase
      .from('generations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (isUUID) {
      query = query.eq('id', id)
    } else {
      query = query.eq('task_id', id)
    }

    const { error } = await query

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

