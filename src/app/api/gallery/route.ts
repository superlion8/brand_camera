import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 分页大小
const PAGE_SIZE = 20

// 图库数据类型筛选
type GalleryType = 'all' | 'model' | 'product' | 'favorites'

// 判断是否是模特类型
function isModelType(taskType: string): boolean {
  const type = taskType?.toLowerCase() || ''
  return type === 'camera_model' || type === 'model' || type === 'camera' || type === 'model_studio' || type === 'edit' || type === 'editing'
}

// 判断是否是商品类型
function isProductType(taskType: string): boolean {
  const type = taskType?.toLowerCase() || ''
  return type === 'studio' || type === 'camera_product' || type === 'product' || type === 'product_studio'
}

export async function GET(request: NextRequest) {
  // 检查认证
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const type = (searchParams.get('type') || 'all') as GalleryType
    
    const supabase = createServiceClient()
    
    // 处理收藏筛选
    if (type === 'favorites') {
      // 查询收藏 - 注意表名是 generations（带 s）
      const { data: favorites, error: favError, count: favCount } = await supabase
        .from('favorites')
        .select('*, generations:generation_id(*)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (favError) {
        console.error('[Gallery] Error fetching favorites:', favError)
        return NextResponse.json({ success: false, error: '获取收藏失败' }, { status: 500 })
      }

      // 展开收藏的图片
      const items = favorites
        ?.filter(fav => fav.generations)
        .map(fav => {
          const gen = fav.generations
          const imageUrl = gen.output_image_urls?.[fav.image_index]
          if (!imageUrl) return null
          
          return {
            id: fav.id,
            generationId: gen.id,
            imageIndex: fav.image_index,
            imageUrl,
            type: gen.type,
            createdAt: fav.created_at,
            generation: {
              id: gen.id,
              type: gen.type,
              outputImageUrls: gen.output_image_urls,
              outputGenModes: gen.output_gen_modes,
              inputParams: gen.input_params,
              createdAt: gen.created_at,
            }
          }
        })
        .filter(item => item !== null) || []

      return NextResponse.json({
        success: true,
        data: {
          items,
          total: favCount || 0,
          page,
          pageSize: PAGE_SIZE,
          hasMore: (favCount || 0) > page * PAGE_SIZE,
        }
      })
    }

    // 查询 generations
    let query = supabase
      .from('generations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('output_image_urls', 'is', null)

    // 按类型筛选
    if (type === 'model') {
      query = query.or('type.eq.camera_model,type.eq.model,type.eq.camera,type.eq.model_studio,type.eq.edit,type.eq.editing')
    } else if (type === 'product') {
      query = query.or('type.eq.studio,type.eq.camera_product,type.eq.product,type.eq.product_studio')
    }

    const { data: generations, error: genError, count: genCount } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (genError) {
      console.error('[Gallery] Error fetching generations:', genError)
      return NextResponse.json({ success: false, error: '获取图片失败' }, { status: 500 })
    }

    // 展开所有图片
    const items = generations
      ?.flatMap(gen => {
        if (!gen.output_image_urls || !Array.isArray(gen.output_image_urls)) {
          return []
        }
        return gen.output_image_urls.map((url: string, index: number) => ({
          id: `${gen.id}-${index}`,
          generationId: gen.id,
          imageIndex: index,
          imageUrl: url,
          type: gen.type,
          createdAt: gen.created_at,
          generation: {
            id: gen.id,
            type: gen.type,
            outputImageUrls: gen.output_image_urls,
            outputGenModes: gen.output_gen_modes,
            inputParams: gen.input_params,
            createdAt: gen.created_at,
          }
        }))
      }) || []

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: genCount || 0,
        page,
        pageSize: PAGE_SIZE,
        hasMore: (genCount || 0) > page * PAGE_SIZE,
      }
    })

  } catch (error: any) {
    console.error('[Gallery] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '获取图库数据失败' },
      { status: 500 }
    )
  }
}

