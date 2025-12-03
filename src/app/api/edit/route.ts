import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { buildEditPrompt, EDIT_PROMPT_PREFIX } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes (Pro plan)

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
    const { 
      inputImage, 
      modelImage, 
      modelStyle, 
      modelGender, 
      backgroundImage, 
      vibeImage, 
      customPrompt,
      taskId, // 任务 ID，用于数据库写入
    } = body
    
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
      // 标记失败
      if (taskId) {
        await markImageFailed({
          taskId,
        userId,
          imageIndex: 0,
          error: 'RESOURCE_BUSY',
        })
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY' 
      }, { status: 503 })
    }
    
    console.log(`[Edit] Generated in ${duration}ms, uploading to storage...`)
    
    const base64Image = `data:image/png;base64,${result.image}`
    let uploadedUrl = base64Image
    const generationId = taskId || generateId()
    
    // 上传到 Storage
    const storageUrl = await uploadImageToStorage(base64Image, userId, 'edit_0')
    if (storageUrl) {
      uploadedUrl = storageUrl
      console.log('[Edit] Successfully uploaded to storage')
      
      // 写入数据库
      if (taskId) {
        const dbSuccess = await appendImageToGeneration({
          taskId,
      userId,
          imageIndex: 0,
          imageUrl: storageUrl,
          modelType: result.model,
          genMode: 'extended',
          prompt: prompt,
          taskType: 'edit',
          inputParams: {
        modelStyle,
        modelGender,
        customPrompt,
            hasModel: !!modelImage,
            hasBackground: !!backgroundImage,
            hasVibe: !!vibeImage,
          },
        })
        
        if (dbSuccess) {
          console.log('[Edit] Saved to database')
        } else {
          console.warn('[Edit] Failed to save to database')
        }
      }
    } else {
      console.warn('[Edit] Upload failed, returning base64')
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`[Edit] Completed in ${totalDuration}ms`)
    
    return NextResponse.json({
      success: true,
      image: uploadedUrl,
      modelType: result.model,
      generationId,
      savedToDb: !!taskId,
    })
    
  } catch (error: any) {
    console.error('[Edit] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '编辑失败' 
    }, { status: 500 })
  }
}
