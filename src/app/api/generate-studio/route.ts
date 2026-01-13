import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'
import { imageToBase64 } from '@/lib/presets/serverPresets'

export const maxDuration = 300 // 5 minutes (Pro plan) - includes image upload

// 确保图片数据是 base64 格式（支持 URL 和 base64 输入）
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  return await imageToBase64(image)
}

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Retry config - Pro 失败直接降级，不重试
const PRIMARY_RETRY_COUNT = 0
const PRIMARY_RETRY_DELAY_MS = 0

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || ''
  return msg.includes('429') || 
         msg.includes('rate') || 
         msg.includes('quota') ||
         msg.includes('exhausted') ||
         msg.includes('resource')
}

interface ImageResult {
  image: string
  model: 'pro' | 'flash'
}

// Light type descriptions (Chinese for prompt)
const LIGHT_TYPE_DESC_CN: Record<string, string> = {
  'Softbox': '柔光箱',
  'Sunlight': '自然光',
  'Dramatic': '戏剧光',
  'Neon': '霓虹光',
}

// Light direction descriptions (Chinese for prompt)
const LIGHT_DIR_DESC_CN: Record<string, string> = {
  'top-left': '左上方',
  'top': '正上方',
  'top-right': '右上方',
  'left': '左侧',
  'front': '正面',
  'right': '右侧',
  'bottom-left': '左下方',
  'bottom': '正下方',
  'bottom-right': '右下方',
}

// Build studio prompt based on photo type
function buildStudioPrompt(
  photoType: 'flatlay' | 'hanging',
  lightType: string,
  lightDirection: string,
  bgColor: string
): string {
  const lightTypeDesc = LIGHT_TYPE_DESC_CN[lightType] || lightType
  const lightDirDesc = LIGHT_DIR_DESC_CN[lightDirection] || lightDirection
  
  if (photoType === 'hanging') {
    // 挂拍图 prompt - 衣架悬挂展示
    return `一张电商服装详情页用的专业挂拍照片，主体是图中的主要商品，挂在简约银色衣架上，用木质衣架撑起，正面平整展开，画面极简，高级买手店陈列风格，自然柔和室内光线，衣服细节清晰，有轻微自然阴影，高分辨率，无模特，无多余物体，无文字无水印。

背景放在${bgColor}的背景上，光源使用${lightTypeDesc}类型，光源从${lightDirDesc}方向。`
  }
  
  // 平铺图 prompt (flatlay) - 俯拍平铺展示
  return `一张电商详情页用的专业平铺俯拍照片（flat lay），拍摄视角为正上方俯视，主体是图中的主要商品平整铺放在${bgColor}的背景上。

画面极简干净，商品居中平铺展示，完全展开无褶皱，四周留白适当。

光源使用${lightTypeDesc}类型，光源从${lightDirDesc}方向照射，产生轻微柔和阴影，增加立体感。

真实质感，高分辨率，Instagram风格，适合电商详情页和社交媒体展示，无文字无水印。

如果图中有人物要去掉图中的人物，其他和商品不相关的元素也都要去掉。`
}

async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  aspectRatio: string | undefined,
  label: string
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  for (let attempt = 0; attempt <= PRIMARY_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${label}] Retry ${attempt}/${PRIMARY_RETRY_COUNT}...`)
        await delay(PRIMARY_RETRY_DELAY_MS * attempt)
      }
      
      console.log(`[${label}] Trying ${PRIMARY_IMAGE_MODEL}...`)
      
      const config: any = {
        responseModalities: ['IMAGE'],
        safetySettings,
      }
      
      // Add aspect ratio if specified
      if (aspectRatio && aspectRatio !== 'original') {
        config.aspectRatio = aspectRatio
      }
      
      const response = await client.models.generateContent({
        model: PRIMARY_IMAGE_MODEL,
        contents: [{ role: 'user', parts }],
        config,
      })
      
      const result = extractImage(response)
      if (result) {
        console.log(`[${label}] Success with ${PRIMARY_IMAGE_MODEL} in ${Date.now() - startTime}ms`)
        return { image: result, model: 'pro' }
      }
      throw new Error('No image in response')
    } catch (err: any) {
      console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} failed: ${err?.message}`)
      if (!isRateLimitError(err) || attempt === PRIMARY_RETRY_COUNT) break
    }
  }
  
  // Fallback
  try {
    console.log(`[${label}] Trying fallback ${FALLBACK_IMAGE_MODEL}...`)
    
    const config: any = {
      responseModalities: ['IMAGE'],
      safetySettings,
    }
    
    if (aspectRatio && aspectRatio !== 'original') {
      config.aspectRatio = aspectRatio
    }
    
    const response = await client.models.generateContent({
      model: FALLBACK_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config,
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
  
  // Check authentication (supports Cookie and Bearer token)
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  const userId = authResult.user.id
  
  try {
    const body = await request.json()
    const { 
      productImage, 
      photoType = 'flatlay', // 'flatlay' 平铺图 or 'hanging' 挂拍图
      lightType = 'Softbox',
      lightDirection = 'front',
      lightColor = '#FFFFFF',
      aspectRatio = 'original',
      index = 0,
      taskId, // 任务 ID，用于数据库写入
      inputParams, // 生成参数
    } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const label = `Studio ${index + 1} (${photoType})`
    
    // 支持 URL 和 base64 格式
    const productImageData = await ensureBase64Data(productImage)
    
    if (!productImageData || productImageData.length < 100) {
      return NextResponse.json({ success: false, error: '商品图片格式无效' }, { status: 400 })
    }
    
    // Build prompt based on photo type
    const prompt = buildStudioPrompt(photoType, lightType, lightDirection, lightColor)
    console.log(`[${label}] Prompt:`, prompt.substring(0, 200) + '...')
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
    ]
    
    const result = await generateImageWithFallback(client, parts, aspectRatio, label)
    
    const duration = Date.now() - startTime
    
    if (!result) {
      console.log(`[${label}] Failed in ${duration}ms`)
      
      // 标记图片失败
      if (taskId) {
        await markImageFailed({
          taskId,
          userId,
          imageIndex: index,
          error: 'RESOURCE_BUSY',
        })
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY',
        index,
        duration,
      }, { status: 503 })
    }
    
    console.log(`[${label}] Generated in ${duration}ms, uploading to storage...`)
    
    // 上传图片到 Storage
    const base64Image = `data:image/png;base64,${result.image}`
    let uploadedUrl = base64Image
    let saveResult: { success: boolean; dbId?: string } | undefined
    
    if (taskId) {
      const uploaded = await uploadImageToStorage(base64Image, userId, `studio_${index}`)
      if (uploaded) {
        uploadedUrl = uploaded
        console.log(`[${label}] Uploaded to storage`)
        
        // 写入数据库，获取 dbId
        saveResult = await appendImageToGeneration({
          taskId,
          userId,
          imageIndex: index,
          imageUrl: uploaded,
          modelType: result.model,
          genMode: 'extended', // Studio 总是 extended 模式
          prompt: prompt,
          taskType: 'product_studio',
          inputParams: inputParams || { photoType, lightType, lightDirection, lightColor, aspectRatio },
        })
        
        if (saveResult.success) {
          console.log(`[${label}] Saved to database, dbId: ${saveResult.dbId}`)
        } else {
          console.warn(`[${label}] Failed to save to database`)
        }
      } else {
        console.warn(`[${label}] Upload failed, returning base64`)
      }
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`[${label}] Completed in ${totalDuration}ms`)
    
    return NextResponse.json({
      success: true,
      index,
      image: uploadedUrl,
      modelType: result.model,
      prompt: prompt,
      duration: totalDuration,
      savedToDb: !!taskId,
      ...(saveResult?.dbId ? { dbId: saveResult.dbId } : {}), // 返回数据库 UUID 用于收藏
    })
    
  } catch (error: any) {
    console.error('[Studio] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}

