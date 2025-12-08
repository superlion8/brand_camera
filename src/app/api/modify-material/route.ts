import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractImage } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage } from '@/lib/supabase/generationService'

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

// 类别中文到英文映射
const CATEGORY_MAP: Record<string, string> = {
  '内衬': 'inner layer/undershirt',
  '上衣': 'top/shirt',
  '裤子': 'pants/trousers',
  '帽子': 'hat/cap',
  '鞋子': 'shoes/footwear'
}

// 构建单个商品的修改指令
function buildItemInstruction(target: {
  category: string
  params: {
    shape: string
    fit: string
    visual_fabric_vibe: string
    fiber_composition: string
    visual_luster: string
    weave_structure: string
  }
}): string {
  const { category, params } = target
  const categoryLabel = CATEGORY_MAP[category] || category
  
  return `请调整图中模特穿的【${category}/${categoryLabel}】：整体廓形改为${params.shape}，合身度改为${params.fit}，视觉呈现${params.visual_fabric_vibe}的效果。材质改为${params.fiber_composition}，具有${params.visual_luster}光泽，结构为${params.weave_structure}。`
}

// 构建完整的修改 prompt
function buildModifyPrompt(targets: Array<{
  category: string
  params: {
    shape: string
    fit: string
    visual_fabric_vibe: string
    fiber_composition: string
    visual_luster: string
    weave_structure: string
  }
}>): string {
  const prefix = `作为高级修图师，请对提供的图片进行局部调整。保持图片的构图、背景、模特姿态以及未提及的商品完全不变。仅针对以下指令进行修改：\n\n`
  
  const instructions = targets.map(t => buildItemInstruction(t)).join('\n\n')
  
  const suffix = `\n\n确保修改后的衣物与模特身体自然贴合，光影关系与原图环境光保持一致。高保真输出。`
  
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
      targets,         // 要修改的商品列表
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

    // 验证 targets 格式
    for (const target of targets) {
      if (!target.category || !target.params) {
        return NextResponse.json(
          { success: false, error: '修改参数格式错误' },
          { status: 400 }
        )
      }
      const requiredParams = ['shape', 'fit', 'visual_fabric_vibe', 'fiber_composition', 'visual_luster', 'weave_structure']
      for (const param of requiredParams) {
        if (!target.params[param]) {
          return NextResponse.json(
            { success: false, error: `缺少参数: ${param}` },
            { status: 400 }
          )
        }
      }
    }

    const label = '[Modify Material]'
    console.log(`${label} Starting modification with ${targets.length} targets`)

    // 转换图片
    const outputImageData = await ensureBase64Data(outputImage)
    if (!outputImageData) {
      return NextResponse.json(
        { success: false, error: '图片格式无效' },
        { status: 400 }
      )
    }

    // 构建 prompt
    const prompt = buildModifyPrompt(targets)
    console.log(`${label} Generated prompt:`, prompt.substring(0, 200) + '...')

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

