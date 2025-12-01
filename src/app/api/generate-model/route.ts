import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'

export const maxDuration = 240 // 4 minutes for model images (includes instruction generation)

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'
const VLM_MODEL = 'gemini-3-pro-preview'

// Retry config
const PRIMARY_RETRY_COUNT = 2
const PRIMARY_RETRY_DELAY_MS = 3000
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

async function generateInstructions(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  productImage2Data: string | null,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  modelStyle?: string,
  index?: number
): Promise<string | null> {
  try {
    const label = index !== undefined ? `Instructions ${index + 1}` : 'Instructions'
    console.log(`[${label}] Generating...`)
    
    const instructPrompt = buildInstructPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
      hasProduct2: !!productImage2Data,
    })
    
    const parts: any[] = [{ text: instructPrompt }]
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImageData } })
    
    if (productImage2Data) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
    }
    if (modelImageData) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
    }
    if (backgroundImageData) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
    }
    if (vibeImageData) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: vibeImageData } })
    }
    
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{ role: 'user', parts }],
      config: { safetySettings },
    })
    
    const instructions = extractText(response)
    console.log(`[${label}] Generated:`, instructions?.substring(0, 100) + '...')
    return instructions
  } catch (error: any) {
    console.error('[Instructions] Error:', error?.message || error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { productImage, productImage2, modelImage, modelStyle, modelGender, backgroundImage, vibeImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    const productImageData = stripBase64Prefix(productImage)
    const productImage2Data = productImage2 ? stripBase64Prefix(productImage2) : null
    const modelImageData = modelImage ? stripBase64Prefix(modelImage) : null
    const backgroundImageData = backgroundImage ? stripBase64Prefix(backgroundImage) : null
    const vibeImageData = vibeImage ? stripBase64Prefix(vibeImage) : null
    
    if (!productImageData || productImageData.length < 100) {
      return NextResponse.json({ 
        success: false, 
        error: '商品图片格式无效' 
      }, { status: 400 })
    }
    
    const results: string[] = []
    const modelTypes: ('pro' | 'flash')[] = []
    
    // === MODEL IMAGE 1 ===
    console.log('[Model] Generating instructions for image 1...')
    const instructPrompt1 = await generateInstructions(
      client, productImageData, productImage2Data, modelImageData, 
      backgroundImageData, vibeImageData, modelStyle, 0
    )
    
    await delay(BATCH_DELAY_MS)
    
    // Build model prompt 1
    const modelPrompt1 = buildModelPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      modelGender,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
      instructPrompt: instructPrompt1 || undefined,
      hasProduct2: !!productImage2Data,
    })
    
    const parts1: any[] = []
    if (modelImageData) {
      parts1.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
    }
    parts1.push({ text: modelPrompt1 })
    parts1.push({ inlineData: { mimeType: 'image/jpeg', data: productImageData } })
    if (productImage2Data) {
      parts1.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
    }
    if (backgroundImageData) {
      parts1.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
    }
    if (vibeImageData) {
      parts1.push({ inlineData: { mimeType: 'image/jpeg', data: vibeImageData } })
    }
    
    console.log('[Model] Generating image 1...')
    const model1 = await generateImageWithFallback(client, parts1, 'Model 1')
    if (model1) {
      results.push(`data:image/png;base64,${model1.image}`)
      modelTypes.push(model1.model)
    }
    
    await delay(BATCH_DELAY_MS)
    
    // === MODEL IMAGE 2 ===
    console.log('[Model] Generating instructions for image 2...')
    const instructPrompt2 = await generateInstructions(
      client, productImageData, productImage2Data, modelImageData,
      backgroundImageData, vibeImageData, modelStyle, 1
    )
    
    await delay(BATCH_DELAY_MS)
    
    // Build model prompt 2
    const modelPrompt2 = buildModelPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      modelGender,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
      instructPrompt: instructPrompt2 || undefined,
      hasProduct2: !!productImage2Data,
    })
    
    const parts2: any[] = []
    if (modelImageData) {
      parts2.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
    }
    parts2.push({ text: modelPrompt2 })
    parts2.push({ inlineData: { mimeType: 'image/jpeg', data: productImageData } })
    if (productImage2Data) {
      parts2.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
    }
    if (backgroundImageData) {
      parts2.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
    }
    if (vibeImageData) {
      parts2.push({ inlineData: { mimeType: 'image/jpeg', data: vibeImageData } })
    }
    
    console.log('[Model] Generating image 2...')
    const model2 = await generateImageWithFallback(client, parts2, 'Model 2')
    if (model2) {
      results.push(`data:image/png;base64,${model2.image}`)
      modelTypes.push(model2.model)
    }
    
    const duration = Date.now() - startTime
    console.log(`[Model] Completed: ${results.length}/2 images in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      images: results,
      modelTypes,
      stats: {
        total: 2,
        successful: results.length,
        duration,
        hasInstructions: !!(instructPrompt1 || instructPrompt2),
      }
    })
    
  } catch (error: any) {
    console.error('[Model] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '生成失败' 
    }, { status: 500 })
  }
}

