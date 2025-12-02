import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 180 // 3 minutes per single image

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'
const VLM_MODEL = 'gemini-3-pro-preview'

// Retry config
const PRIMARY_RETRY_COUNT = 2
const PRIMARY_RETRY_DELAY_MS = 3000

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

async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
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

async function generateInstructions(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  productImage2Data: string | null,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  modelStyle?: string
): Promise<string | null> {
  try {
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
    
    return extractText(response)
  } catch (err: any) {
    console.error('[Instructions] Error:', err?.message)
    return null
  }
}

// Simple prompt for model generation (简单版)
const SIMPLE_MODEL_PROMPT = `请为{{product}}生成一个模特实拍图，环境参考{{background}}，模特参考{{model}}，但不能长得和图一完全一样，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格`

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Check authentication
  const authResult = await requireAuth()
  if ('response' in authResult) {
    return authResult.response
  }
  
  try {
    const body = await request.json()
    const { 
      type, // 'product' | 'model'
      index, // 0 or 1
      productImage, 
      productImage2, 
      modelImage, 
      modelStyle, 
      modelGender, 
      backgroundImage, 
      vibeImage,
      simpleMode, // New: use simple prompt for model generation
    } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    if (!type || (type !== 'product' && type !== 'model')) {
      return NextResponse.json({ success: false, error: '无效的生成类型' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const label = `${type === 'product' ? 'Product' : 'Model'} ${(index || 0) + 1}${simpleMode ? ' (Simple)' : ''}`
    
    const productImageData = stripBase64Prefix(productImage)
    const productImage2Data = productImage2 ? stripBase64Prefix(productImage2) : null
    const modelImageData = modelImage ? stripBase64Prefix(modelImage) : null
    const backgroundImageData = backgroundImage ? stripBase64Prefix(backgroundImage) : null
    const vibeImageData = vibeImage ? stripBase64Prefix(vibeImage) : null
    
    if (!productImageData || productImageData.length < 100) {
      return NextResponse.json({ success: false, error: '商品图片格式无效' }, { status: 400 })
    }
    
    let result: ImageResult | null = null
    let usedPrompt: string = ''
    let generationMode: 'extended' | 'simple' = 'extended'
    
    if (type === 'product') {
      // Generate product image
      console.log(`[${label}] Generating product image...`)
      usedPrompt = PRODUCT_PROMPT
      const parts: any[] = [
        { text: PRODUCT_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
      ]
      if (productImage2Data) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
      }
      
      result = await generateImageWithFallback(client, parts, label)
      
    } else if (simpleMode && modelImageData && backgroundImageData) {
      // Simple mode: Direct prompt with model and background reference (简单版)
      console.log(`[${label}] Generating with simple prompt...`)
      generationMode = 'simple'
      usedPrompt = SIMPLE_MODEL_PROMPT
      
      const parts: any[] = [
        { text: SIMPLE_MODEL_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } }, // {{product}}
        { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } }, // {{model}}
      ]
      
      result = await generateImageWithFallback(client, parts, label)
      
    } else {
      // Extended mode: Generate model image with instructions (扩展版)
      console.log(`[${label}] Generating instructions...`)
      const instructPrompt = await generateInstructions(
        client, productImageData, productImage2Data, modelImageData,
        backgroundImageData, vibeImageData, modelStyle
      )
      
      const modelPrompt = buildModelPrompt({
        hasModel: !!modelImageData,
        modelStyle,
        modelGender,
        hasBackground: !!backgroundImageData,
        hasVibe: !!vibeImageData,
        instructPrompt: instructPrompt || undefined,
        hasProduct2: !!productImage2Data,
      })
      
      // Save the full prompt used
      usedPrompt = modelPrompt
      if (instructPrompt) {
        usedPrompt = `[Photography Instructions]\n${instructPrompt}\n\n[Image Generation Prompt]\n${modelPrompt}`
      }
      
      const parts: any[] = []
      if (modelImageData) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
      }
      parts.push({ text: modelPrompt })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImageData } })
      if (productImage2Data) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
      }
      if (backgroundImageData) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
      }
      if (vibeImageData) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: vibeImageData } })
      }
      
      console.log(`[${label}] Generating model image...`)
      result = await generateImageWithFallback(client, parts, label)
    }
    
    const duration = Date.now() - startTime
    
    if (!result) {
      console.log(`[${label}] Failed in ${duration}ms`)
      return NextResponse.json({ 
        success: false, 
        error: '生成失败',
        type,
        index,
        duration,
      }, { status: 500 })
    }
    
    console.log(`[${label}] Completed in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      type,
      index,
      image: `data:image/png;base64,${result.image}`,
      modelType: result.model,
      generationMode, // 'extended' or 'simple'
      prompt: usedPrompt,
      duration,
    })
    
  } catch (error: any) {
    console.error('[Single] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '生成失败' 
    }, { status: 500 })
  }
}

