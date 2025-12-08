import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 180 // 3 minutes for product images

// 将 URL 转换为 base64（服务端版本，带重试）
async function urlToBase64(url: string, maxRetries = 2): Promise<string> {
  const cleanUrl = url.trim()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[urlToBase64] Attempt ${attempt}/${maxRetries}, Fetching:`, cleanUrl.substring(0, 100) + '...')
      const response = await fetch(cleanUrl, {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        console.error(`[urlToBase64] HTTP Error (attempt ${attempt}):`, response.status, response.statusText, 'URL:', cleanUrl)
        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
        continue
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      console.log('[urlToBase64] Success, base64 length:', buffer.toString('base64').length)
      return buffer.toString('base64')
    } catch (error: any) {
      console.error(`[urlToBase64] Error (attempt ${attempt}):`, error.message, 'URL:', cleanUrl.substring(0, 100))
      if (attempt === maxRetries) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw new Error('Failed to fetch image after all retries')
}

// 确保图片数据是 base64 格式（支持 URL 和 base64 输入）
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return await urlToBase64(image)
  }
  return stripBase64Prefix(image)
}

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Retry config
const PRIMARY_RETRY_COUNT = 0       // Pro 失败直接降级，不重试
const PRIMARY_RETRY_DELAY_MS = 0
const BATCH_DELAY_MS = 1500

interface ImageResult {
  image: string
  model: 'pro' | 'flash'
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || ''
  return msg.includes('429') || 
         msg.includes('rate') || 
         msg.includes('quota') ||
         msg.includes('exhausted') ||
         msg.includes('resource')
}

async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  for (let attempt = 0; attempt <= PRIMARY_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${label}] Retry ${attempt}/${PRIMARY_RETRY_COUNT} after ${PRIMARY_RETRY_DELAY_MS}ms wait...`)
        await delay(PRIMARY_RETRY_DELAY_MS * attempt)
      }
      
      console.log(`[${label}] Trying ${PRIMARY_IMAGE_MODEL}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}...`)
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
        console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} succeeded in ${Date.now() - startTime}ms`)
        return { image: result, model: 'pro' }
      }
      throw new Error('No image in response')
    } catch (primaryError: any) {
      console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} failed: ${primaryError?.message || primaryError}`)
      
      if (!isRateLimitError(primaryError)) {
        break
      }
      
      if (attempt === PRIMARY_RETRY_COUNT) {
        console.log(`[${label}] Exhausted ${PRIMARY_RETRY_COUNT} retries, trying fallback...`)
      }
    }
  }
  
  try {
    console.log(`[${label}] Trying fallback ${FALLBACK_IMAGE_MODEL}...`)
    const fallbackResponse = await client.models.generateContent({
      model: FALLBACK_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const fallbackResult = extractImage(fallbackResponse)
    if (fallbackResult) {
      console.log(`[${label}] ${FALLBACK_IMAGE_MODEL} succeeded`)
      return { image: fallbackResult, model: 'flash' }
    }
    throw new Error('No image in fallback response')
  } catch (fallbackError: any) {
    console.error(`[${label}] ${FALLBACK_IMAGE_MODEL} also failed:`, fallbackError?.message || fallbackError)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Check authentication (supports Cookie and Bearer token)
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  try {
    const body = await request.json()
    const { productImage, productImage2 } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // 所有图片都支持 URL 格式（后端转换），减少前端请求体大小
    const productImageData = await ensureBase64Data(productImage)
    const productImage2Data = await ensureBase64Data(productImage2)
    
    if (!productImageData || productImageData.length < 100) {
      return NextResponse.json({ 
        success: false, 
        error: '商品图片格式无效' 
      }, { status: 400 })
    }
    
    const results: string[] = []
    const modelTypes: ('pro' | 'flash')[] = []
    
    // Generate product image 1
    console.log('[Product] Generating image 1...')
    const parts1: any[] = [
      { text: PRODUCT_PROMPT },
      { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
    ]
    if (productImage2Data) {
      parts1.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
    }
    
    const product1 = await generateImageWithFallback(client, parts1, 'Product 1')
    if (product1) {
      results.push(`data:image/png;base64,${product1.image}`)
      modelTypes.push(product1.model)
    }
    
    await delay(BATCH_DELAY_MS)
    
    // Generate product image 2
    console.log('[Product] Generating image 2...')
    const parts2: any[] = [
      { text: PRODUCT_PROMPT },
      { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
    ]
    if (productImage2Data) {
      parts2.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
    }
    
    const product2 = await generateImageWithFallback(client, parts2, 'Product 2')
    if (product2) {
      results.push(`data:image/png;base64,${product2.image}`)
      modelTypes.push(product2.model)
    }
    
    const duration = Date.now() - startTime
    console.log(`[Product] Completed: ${results.length}/2 images in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      images: results,
      modelTypes,
      stats: {
        total: 2,
        successful: results.length,
        duration,
      }
    })
    
  } catch (error: any) {
    console.error('[Product] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}

