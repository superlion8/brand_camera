import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { stripBase64Prefix } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'

export const maxDuration = 300 // 5 minutes (Pro plan) - includes image upload

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

// Light type descriptions
const LIGHT_TYPE_DESC: Record<string, string> = {
  'Softbox': 'soft, diffused studio softbox lighting with gentle shadows',
  'Sunlight': 'natural sunlight with warm tones and natural shadows',
  'Dramatic': 'dramatic high-contrast lighting with deep shadows and highlights',
  'Neon': 'vibrant neon lighting with colorful reflections and glow effects',
}

// Build studio prompt
function buildStudioPrompt(
  lightType: string,
  lightDirection: string,
  bgColor: string
): string {
  const lightDesc = LIGHT_TYPE_DESC[lightType] || 'professional studio lighting'
  
  let prompt = `Transform this product into a professional studio photography shot.

Setup:
- Lighting: ${lightDesc}
- Light Direction: coming from ${lightDirection}
- Background: clean gradient background with ${bgColor} as the primary color tone

Requirements:
- Professional e-commerce quality product photography
- Smooth gradient background using the specified color
- Precise shadows and reflections based on lighting direction
- Maintain 100% accuracy of product details, colors, and proportions
- High-end commercial photography aesthetic

Negatives: distorted product, wrong colors, added elements, removed details, amateur lighting, harsh shadows, busy background, cluttered scene.`

  return prompt
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
      lightType = 'Softbox',
      lightDirection = 'front-top',
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
    const label = `Studio ${index + 1}`
    
    const productImageData = stripBase64Prefix(productImage)
    
    if (!productImageData || productImageData.length < 100) {
      return NextResponse.json({ success: false, error: '商品图片格式无效' }, { status: 400 })
    }
    
    // Build prompt
    const prompt = buildStudioPrompt(lightType, lightDirection, lightColor)
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
    
    if (taskId) {
      const uploaded = await uploadImageToStorage(base64Image, userId, `studio_${index}`)
      if (uploaded) {
        uploadedUrl = uploaded
        console.log(`[${label}] Uploaded to storage`)
        
        // 写入数据库
        const dbSuccess = await appendImageToGeneration({
          taskId,
          userId,
          imageIndex: index,
          imageUrl: uploaded,
          modelType: result.model,
          genMode: 'extended', // Studio 总是 extended 模式
          prompt: prompt,
          taskType: 'product_studio',
          inputParams: inputParams || { lightType, lightDirection, lightColor, aspectRatio },
        })
        
        if (dbSuccess) {
          console.log(`[${label}] Saved to database`)
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
    })
    
  } catch (error: any) {
    console.error('[Studio] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}

