import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { buildEditPrompt, EDIT_PROMPT_PREFIX } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { saveGenerationServer } from '@/lib/supabase/generations-server'
import { uploadGeneratedImageServer, uploadInputImageServer } from '@/lib/supabase/storage-server'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 120

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

async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  // Try primary model with retries
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
  
  // Fallback to flash model
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
      console.log(`[${label}] Success with fallback in ${Date.now() - startTime}ms`)
      return { image: result, model: 'flash' }
    }
  } catch (err: any) {
    console.error(`[${label}] Fallback also failed: ${err?.message}`)
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
    const { inputImage, modelImage, modelStyle, modelGender, backgroundImage, vibeImage, customPrompt } = body
    
    if (!inputImage) {
      return NextResponse.json({ success: false, error: '缺少输入图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Build prompt
    let prompt = ''
    if (customPrompt) {
      prompt = EDIT_PROMPT_PREFIX + customPrompt
    } else {
      prompt = buildEditPrompt({
        hasModel: !!modelImage,
        modelStyle,
        modelGender,
        hasBackground: !!backgroundImage,
        hasVibe: !!vibeImage,
      })
    }
    
    const parts: any[] = []
    
    // Add model reference image first if provided
    if (modelImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(modelImage),
        },
      })
    }
    
    // Add prompt
    parts.push({ text: prompt })
    
    // Add input image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: stripBase64Prefix(inputImage),
      },
    })
    
    // Add background reference
    if (backgroundImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(backgroundImage),
        },
      })
    }
    
    // Add vibe reference
    if (vibeImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(vibeImage),
        },
      })
    }
    
    console.log('[Edit] Generating edited image...')
    const result = await generateImageWithFallback(client, parts, 'Edit')
    const duration = Date.now() - startTime
    
    if (!result) {
      // Save failed edit record
      saveGenerationServer(
        userId,
        'edit',
        { modelStyle, modelGender, customPrompt },
        [],
        duration,
        'failed',
        '资源紧张，请稍后重试'
      ).catch(console.error)
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY' 
      }, { status: 503 })
    }
    
    let outputUrl = `data:image/png;base64,${result.image}`
    const generationId = generateId()
    
    // Upload to Supabase Storage
    console.log('[Edit] Uploading to Supabase Storage...')
    
    // Upload output image
    const storageUrl = await uploadGeneratedImageServer(outputUrl, generationId, 0, userId)
    if (storageUrl) {
      outputUrl = storageUrl
      console.log('[Edit] Successfully uploaded to storage')
    }
    
    // Also upload input image
    uploadInputImageServer(inputImage, generationId, userId).catch(console.error)
    
    // Save edit record with storage URL and model type
    saveGenerationServer(
      userId,
      'edit',
      {
        modelStyle,
        modelGender,
        customPrompt,
        modelImageUrl: modelImage ? '[provided]' : undefined,
        backgroundImageUrl: backgroundImage ? '[provided]' : undefined,
        vibeImageUrl: vibeImage ? '[provided]' : undefined,
      },
      [outputUrl],
      duration,
      'completed'
    ).catch(console.error)
    
    return NextResponse.json({
      success: true,
      image: outputUrl,
      modelType: result.model,
      generationId,
    })
    
  } catch (error: any) {
    console.error('[Edit] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '编辑失败' 
    }, { status: 500 })
  }
}
