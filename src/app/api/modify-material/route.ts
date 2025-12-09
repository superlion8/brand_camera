import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractImage } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage, appendImageToGeneration } from '@/lib/supabase/generationService'

export const maxDuration = 300 // 5 minutes timeout

// 图片生成模型
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// 将 URL 转换为 base64（服务端版本）
async function urlToBase64(url: string): Promise<string> {
  try {
    const cleanUrl = url.trim()
    console.log('[urlToBase64] Fetching:', cleanUrl.substring(0, 100) + '...')
    const response = await fetch(cleanUrl)
    if (!response.ok) {
      console.error('[urlToBase64] HTTP Error:', response.status, response.statusText)
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error: any) {
    console.error('[urlToBase64] Error:', error.message)
    throw error
  }
}

// 确保图片数据是 base64 格式
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return await urlToBase64(image)
  } else if (image.startsWith('data:')) {
    return image.replace(/^data:image\/\w+;base64,/, '')
  }
  return image
}

// 类别中英文映射
const CATEGORY_MAP: Record<string, string> = {
  '内衬': 'inner layer',
  '上衣': 'top',
  '裤子': 'pants',
  '裙子': 'skirt',
  '帽子': 'hat',
  '鞋子': 'shoes',
  // English categories (pass through)
  'Innerwear': 'inner layer',
  'Top': 'top',
  'Pants': 'pants',
  'Skirt': 'skirt',
  'Hat': 'hat',
  'Shoes': 'shoes',
  // Korean categories
  '이너웨어': 'inner layer',
  '상의': 'top',
  '바지': 'pants',
  '스커트': 'skirt',
  '모자': 'hat',
  '신발': 'shoes',
}

// V2 新版参数结构
interface ModifyTarget {
  category: string
  params: {
    silhouette: string        // 版型廓形
    fit_tightness: string     // 松紧度
    length: string            // 【新增】长度
    waist_line?: string       // 【新增】腰线（裤子/裙子）
    material_category: string // 【核心】面料大类
    stiffness_drape: string   // 软硬度
    surface_texture: string   // 【核心】表面肌理
    visual_luster: string     // 光泽
  }
}

// 构建单个商品的修改指令 - V2 新版更自然的语法
function buildItemInstruction(target: ModifyTarget): string {
  const { category, params } = target
  const categoryEn = CATEGORY_MAP[category] || category
  
  // 构建长度描述（如果有）
  const lengthPart = params.length ? `${params.length}款式` : '原长度款式'
  
  // 构建腰线描述（裤子/裙子适用）
  const waistPart = params.waist_line && 
    (category.includes('裤') || category.includes('裙') || 
     category.toLowerCase().includes('pants') || category.toLowerCase().includes('skirt')) 
    ? `，腰线为${params.waist_line}` : ''
  
  return `请重绘图中模特穿的【${category}/${categoryEn}】：
1. [版型结构]：将其修改为${params.silhouette}廓形的${lengthPart}${waistPart}，整体松紧度调整为${params.fit_tightness}。
2. [面料材质]：材质改为${params.material_category}面料。
3. [质感细节]：面料表现出${params.stiffness_drape}的物理质感，表面具有${params.surface_texture}的肌理细节，并呈现${params.visual_luster}。`
}

// 构建完整的修改 prompt - V2 新版
function buildModifyPrompt(targets: ModifyTarget[], hasReferenceImages: boolean = false): string {
  const prefix = `作为高级修图师，请对提供的图片进行局部调整。保持图片的构图、背景、模特姿态以及未提及的商品完全不变。仅针对以下指令进行修改：\n\n`
  
  const instructions = targets.map(t => buildItemInstruction(t)).join('\n\n')
  
  let suffix = `\n\n确保修改后的衣物与模特身体自然贴合（尤其是腰部和关节处），面料的垂坠感符合重力学，光影关系与原图环境光保持一致。高保真输出。`
  
  // 如果有参考图，添加说明
  if (hasReferenceImages) {
    suffix += `\n\n重要：后面附带的图片是原始商品参考图，请确保修改后的服装在颜色、图案、LOGO等视觉特征上与原始商品保持完全一致，仅改变版型和材质属性。`
  }
  
  return prefix + instructions + suffix
}

// 生成图片（带 fallback）
async function generateWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string
): Promise<{ image: string; model: 'pro' | 'flash' } | null> {
  // Primary model
  try {
    console.log(`[${label}] Trying ${PRIMARY_IMAGE_MODEL}...`)
    const response = await client.models.generateContent({
      model: PRIMARY_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    if (result) {
      console.log(`[${label}] Success with primary model`)
      return { image: result, model: 'pro' }
    }
  } catch (err: any) {
    console.error(`[${label}] Primary failed: ${err?.message}`)
  }
  
  // Fallback model
  try {
    console.log(`[${label}] Trying ${FALLBACK_IMAGE_MODEL}...`)
    const response = await client.models.generateContent({
      model: FALLBACK_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    if (result) {
      console.log(`[${label}] Success with fallback`)
      return { image: result, model: 'flash' }
    }
  } catch (err: any) {
    console.error(`[${label}] Fallback failed: ${err?.message}`)
  }
  
  return null
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // 验证用户身份
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  const userId = authResult.user.id

  try {
    const body = await request.json()
    const { 
      outputImage,     // 要修改的生成图（Output 大图）
      referenceImages, // 原始商品图（可选，作为参考）
      targets,         // 要修改的商品列表 (V2 新格式)
      taskId,          // 任务ID（用于保存到数据库）
      index = 0,       // 图片索引
    } = body

    if (!outputImage) {
      return NextResponse.json(
        { success: false, error: '缺少要修改的图片' },
        { status: 400 }
      )
    }

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少修改参数' },
        { status: 400 }
      )
    }

    // 验证 targets 格式 (V2)
    const requiredParams = ['silhouette', 'fit_tightness', 'length', 'material_category', 'stiffness_drape', 'surface_texture', 'visual_luster']
    for (const target of targets) {
      if (!target.category || !target.params) {
        return NextResponse.json(
          { success: false, error: '修改参数格式错误' },
          { status: 400 }
        )
      }
      for (const param of requiredParams) {
        if (!target.params[param]) {
          return NextResponse.json(
            { success: false, error: `缺少参数: ${param}` },
            { status: 400 }
          )
        }
      }
    }

    const label = `[ModifyMaterial-${index + 1}]`
    console.log(`${label} Starting modification with ${targets.length} targets, taskId: ${taskId || 'none'}`)

    // 转换图片
    const outputImageData = await ensureBase64Data(outputImage)
    if (!outputImageData) {
      return NextResponse.json(
        { success: false, error: '图片格式无效' },
        { status: 400 }
      )
    }

    // 构建 prompt（传递是否有参考图的标志）
    const hasRefs = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0
    const prompt = buildModifyPrompt(targets as ModifyTarget[], hasRefs)
    console.log(`${label} Generated prompt:`, prompt.substring(0, 300) + '...')

    // 构建 parts
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: outputImageData } },
    ]

    // 如果有参考图，添加到 parts
    if (referenceImages && Array.isArray(referenceImages)) {
      for (const refImage of referenceImages) {
        const refData = await ensureBase64Data(refImage)
        if (refData) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: refData } })
        }
      }
      console.log(`${label} Added ${referenceImages.length} reference images`)
    }

    // 调用模型生成
    const client = getGenAIClient()
    const result = await generateWithFallback(client, parts, label)

    const duration = Date.now() - startTime

    if (!result) {
      console.log(`${label} Failed in ${duration}ms`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'RESOURCE_BUSY',
          duration 
        },
        { status: 503 }
      )
    }

    console.log(`${label} Generated in ${duration}ms, uploading...`)

    // 上传到 Storage
    const base64Image = `data:image/png;base64,${result.image}`
    const uploadedUrl = await uploadImageToStorage(base64Image, userId, 'modified')

    if (!uploadedUrl) {
      return NextResponse.json(
        { success: false, error: '上传失败' },
        { status: 500 }
      )
    }

    console.log(`${label} Uploaded successfully`)

    // 保存到数据库（如果有 taskId）
    if (taskId) {
      try {
        const inputParams = {
          type: 'modify_material',
          outputImage,
          targets,
          referenceImages,
        }
        
        await appendImageToGeneration({
          taskId,
          userId,
          imageIndex: index,
          imageUrl: uploadedUrl,
          inputImageUrl: outputImage, // 原始大图作为 input
          inputParams,
          modelType: result.model === 'pro' ? 'pro' : 'flash',
          genMode: 'simple',
          taskType: 'edit',
        })
        console.log(`${label} Saved to database`)
      } catch (dbError: any) {
        console.error(`${label} Failed to save to database:`, dbError.message)
        // 不阻塞返回，图片已生成成功
      }
    }

    return NextResponse.json({
      success: true,
      image: uploadedUrl,
      modelType: result.model,
      prompt,
      duration
    })

  } catch (error: any) {
    console.error('[Modify Material] Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '修改失败'
      },
      { status: 500 }
    )
  }
}
