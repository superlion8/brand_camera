import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
// 注意：类型判断函数已集中到 @/lib/taskTypes，如需使用请 import
// import { isModelType, isProductType, isModelRelatedType } from '@/lib/taskTypes'

export const dynamic = 'force-dynamic'

// 分页大小
const PAGE_SIZE = 20

// 图库数据类型筛选
type GalleryType = 'all' | 'model' | 'custom' | 'favorites'

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
            generationId: gen.id, // 数据库 UUID，用于收藏 API
            imageIndex: fav.image_index,
            imageUrl,
            type: gen.task_type,
            createdAt: fav.created_at,
            generation: {
              id: gen.task_id || gen.id, // 显示用 task_id，兼容旧数据
              dbId: gen.id, // 数据库 UUID，用于收藏
              type: gen.task_type,
              outputImageUrls: gen.output_image_urls,
              outputGenModes: gen.output_gen_modes,
              outputModelTypes: gen.output_model_types,
              inputImageUrl: gen.input_image_url,
              inputImage2Url: gen.input_image2_url,
              modelImageUrl: gen.model_image_url,
              backgroundImageUrl: gen.background_image_url,
              params: gen.input_params,
              prompts: gen.prompts,
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

    // 查询 generations - 注意数据库字段是 task_type 不是 type
    let query = supabase
      .from('generations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('output_image_urls', 'is', null)

    // 按类型筛选 - 使用 task_type 字段
    const subType = searchParams.get('subType') || ''
    
    // model 包含：买家秀(camera/camera_model/model/model_studio)、专业棚拍(pro_studio)、创建专属模特(create_model)
    // custom 包含：组图(group_shoot)、参考图(reference_shot)、商品(product_studio)
    // 注意：edit/editing 是通用编辑，只在"全部"分类中显示
    if (type === 'model') {
      if (subType === 'buyer') {
        // 只显示买家秀：camera, camera_model, model, model_studio
        query = query.or('task_type.eq.camera_model,task_type.eq.model,task_type.eq.camera,task_type.eq.model_studio')
      } else if (subType === 'prostudio') {
        // 只显示专业棚拍
        query = query.or('task_type.eq.pro_studio,task_type.eq.prostudio')
      } else if (subType === 'create_model') {
        // 只显示创建专属模特
        query = query.or('task_type.eq.create_model')
      } else {
        // 全部模特：买家秀 + 专业棚拍 + 创建专属模特
        query = query.or('task_type.eq.camera_model,task_type.eq.model,task_type.eq.camera,task_type.eq.model_studio,task_type.eq.pro_studio,task_type.eq.prostudio,task_type.eq.create_model')
      }
    } else if (type === 'custom') {
      // 定制拍摄分类
      if (subType === 'group') {
        // 只显示组图
        query = query.or('task_type.eq.group_shoot')
      } else if (subType === 'reference') {
        // 只显示参考图
        query = query.or('task_type.eq.reference_shot')
      } else if (subType === 'product') {
        // 只显示商品
        query = query.or('task_type.eq.studio,task_type.eq.camera_product,task_type.eq.product,task_type.eq.product_studio')
      } else {
        // 全部定制拍摄：组图 + 参考图 + 商品
        query = query.or('task_type.eq.group_shoot,task_type.eq.reference_shot,task_type.eq.studio,task_type.eq.camera_product,task_type.eq.product,task_type.eq.product_studio')
      }
    }

    const { data: generations, error: genError, count: genCount } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (genError) {
      console.error('[Gallery] Error fetching generations:', genError)
      return NextResponse.json({ success: false, error: '获取图片失败' }, { status: 500 })
    }

    // 展开所有图片 - 注意数据库字段是 task_type
    const items = generations
      ?.flatMap(gen => {
        if (!gen.output_image_urls || !Array.isArray(gen.output_image_urls)) {
          return []
        }
        return gen.output_image_urls.map((url: string, index: number) => ({
          id: `${gen.id}-${index}`,
          generationId: gen.id, // 数据库 UUID，用于收藏 API
          imageIndex: index,
          imageUrl: url,
          type: gen.task_type,
          createdAt: gen.created_at,
          generation: {
            id: gen.task_id || gen.id, // 显示用 task_id，兼容旧数据
            dbId: gen.id, // 数据库 UUID，用于收藏
            type: gen.task_type,
            outputImageUrls: gen.output_image_urls,
            outputGenModes: gen.output_gen_modes,
            outputModelTypes: gen.output_model_types,
            inputImageUrl: gen.input_image_url,
            inputImage2Url: gen.input_image2_url,
            modelImageUrl: gen.model_image_url,
            backgroundImageUrl: gen.background_image_url,
            params: gen.input_params,
            prompts: gen.prompts,
            createdAt: gen.created_at,
          }
        }))
      }) || []

    // 第一页时，查询 pending 状态的任务（生成中但还没有结果的）
    // 只显示最近 5 分钟内创建的，超过 5 分钟的认为已超时
    let pendingTasks: any[] = []
    if (page === 1 && type === 'all') {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data: pendingGens } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .gte('created_at', fiveMinutesAgo) // 只获取 5 分钟内的
        .order('created_at', { ascending: false })
        .limit(10)

      pendingTasks = (pendingGens || []).map(gen => ({
        id: gen.task_id || gen.id,
        dbId: gen.id,
        type: gen.task_type,
        status: 'pending',
        totalImages: gen.total_images_count || 4,
        createdAt: gen.created_at,
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        pendingTasks, // 返回 pending 状态的任务
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

