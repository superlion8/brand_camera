import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'

export const maxDuration = 300 // 5 minutes (Pro plan) - includes image upload

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'
const VLM_MODEL = 'gemini-3-pro-preview'

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
  modelImageData: string,
  backgroundImageData: string,
  label: string
): Promise<string | null> {
  try {
    const instructPrompt = buildInstructPrompt()
    
    // Input: product, model, background
    const parts: any[] = [
      { text: instructPrompt },
      { inlineData: { mimeType: 'image/jpeg', data: productImageData } },  // {{product}}
      { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },    // {{model}}
      { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
    ]
    
    console.log(`[${label}] Generating photography instructions with VLM...`)
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{ role: 'user', parts }],
      config: { safetySettings },
    })
    
    const result = extractText(response)
    if (result) {
      console.log(`[${label}] Instructions generated (${result.length} chars)`)
    }
    return result
  } catch (err: any) {
    console.error(`[${label}] Instructions error:`, err?.message)
    return null
  }
}

// Simple prompt for model generation (简单版)
const SIMPLE_MODEL_PROMPT = `请为{{product}}生成一个模特实拍图，环境参考{{background}}，模特参考{{model}}，但不能长得和图一完全一样，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格`

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
      type, // 'product' | 'model'
      index, // 0 or 1
      taskId, // 任务 ID，用于数据库写入
      productImage, 
      productImage2, 
      modelImage, 
      modelStyle, 
      modelGender, 
      backgroundImage, 
      vibeImage,
      simpleMode, // New: use simple prompt for model generation
      // 新增：用于数据库写入的参数
      inputParams, // 生成参数（modelStyle, modelGender 等）
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
      // Extended mode: 2-step process (扩展版)
      // Step 1: Generate photography instructions with VLM
      // Step 2: Generate image with the instructions
      
      if (!modelImageData || !backgroundImageData) {
        return NextResponse.json({ 
          success: false, 
          error: '扩展模式需要模特和背景图片' 
        }, { status: 400 })
      }
      
      console.log(`[${label}] Step 1: Generating instructions...`)
      const instructPrompt = await generateInstructions(
        client, productImageData, modelImageData, backgroundImageData, label
      )
      
      // Step 2: Generate image
      const modelPrompt = buildModelPrompt({
        instructPrompt: instructPrompt || undefined,
      })
      
      // Save the full prompt used
      usedPrompt = modelPrompt
      if (instructPrompt) {
        usedPrompt = `[Photography Instructions]\n${instructPrompt}\n\n[Image Generation Prompt]\n${modelPrompt}`
      }
      
      // Parts order: product, model, background, prompt
      const parts: any[] = [
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } },  // {{product}}
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },    // {{model}}
        { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
        { text: modelPrompt },
      ]
      
      console.log(`[${label}] Step 2: Generating model image...`)
      result = await generateImageWithFallback(client, parts, label)
    }
    
    const duration = Date.now() - startTime
    
    if (!result) {
      console.log(`[${label}] Failed in ${duration}ms`)
      
      // 标记图片失败（如果有 taskId）
      if (taskId) {
        await markImageFailed({
          taskId,
          userId,
          imageIndex: index || 0,
          error: 'RESOURCE_BUSY',
        })
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY',
        type,
        index,
        duration,
      }, { status: 503 })
    }
    
    console.log(`[${label}] Generated in ${duration}ms, uploading to storage...`)
    
    // 上传图片到 Storage
    const base64Image = `data:image/png;base64,${result.image}`
    let uploadedUrl = base64Image // 默认返回 base64
    
    if (taskId) {
      const uploaded = await uploadImageToStorage(base64Image, userId, `output_${index || 0}`)
      if (uploaded) {
        uploadedUrl = uploaded
        console.log(`[${label}] Uploaded to storage`)
        
        // 写入数据库
        const dbSuccess = await appendImageToGeneration({
          taskId,
          userId,
          imageIndex: index || 0,
          imageUrl: uploaded,
          modelType: result.model,
          genMode: generationMode,
          prompt: usedPrompt,
          taskType: type === 'product' ? 'product_studio' : 'model_studio',
          inputParams,
        })
        
        if (dbSuccess) {
          console.log(`[${label}] Saved to database`)
        } else {
          console.warn(`[${label}] Failed to save to database, but image is uploaded`)
        }
      } else {
        console.warn(`[${label}] Upload failed, returning base64`)
      }
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`[${label}] Completed in ${totalDuration}ms (gen: ${duration}ms)`)
    
    return NextResponse.json({
      success: true,
      type,
      index,
      image: uploadedUrl, // 返回 Storage URL 或 base64
      modelType: result.model,
      generationMode, // 'extended' or 'simple'
      prompt: usedPrompt,
      duration: totalDuration,
      savedToDb: !!taskId, // 告诉前端是否已保存到数据库
    })
    
  } catch (error: any) {
    console.error('[Single] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}

