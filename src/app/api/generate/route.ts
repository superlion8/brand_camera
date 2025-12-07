import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildEditPrompt } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { saveGenerationServer } from '@/lib/supabase/generations-server'
import { uploadGeneratedImageServer, uploadInputImageServer } from '@/lib/supabase/storage-server'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes for Pro plan

// 将 URL 转换为 base64（服务端版本）
async function urlToBase64(url: string): Promise<string> {
  try {
    const cleanUrl = url.trim()
    console.log('[urlToBase64] Fetching:', cleanUrl.substring(0, 100) + '...')
    const response = await fetch(cleanUrl)
    if (!response.ok) {
      console.error('[urlToBase64] HTTP Error:', response.status, response.statusText, 'URL:', cleanUrl)
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('[urlToBase64] Success, base64 length:', buffer.toString('base64').length)
    return buffer.toString('base64')
  } catch (error: any) {
    console.error('[urlToBase64] Error:', error.message, 'URL:', url?.substring(0, 100))
    throw error
  }
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

// Retry config - prioritize primary model
const PRIMARY_RETRY_COUNT = 0       // Pro 失败直接降级，不重试
const PRIMARY_RETRY_DELAY_MS = 0
const BATCH_DELAY_MS = 1500         // Delay between batches

// Result type with model info
interface ImageResult {
  image: string
  model: 'pro' | 'flash'
}

// Small delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Check if error is a rate limit error (429)
function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || ''
  return msg.includes('429') || 
         msg.includes('rate') || 
         msg.includes('quota') ||
         msg.includes('exhausted') ||
         msg.includes('resource')
}

// Helper function to generate image with retry and fallback
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
        console.log(`[${label}] Retry ${attempt}/${PRIMARY_RETRY_COUNT} after ${PRIMARY_RETRY_DELAY_MS}ms wait...`)
        await delay(PRIMARY_RETRY_DELAY_MS * attempt) // Exponential backoff
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
      
      // If not a rate limit error, don't retry primary model
      if (!isRateLimitError(primaryError)) {
        console.log(`[${label}] Not a rate limit error, skipping to fallback`)
        break
      }
      
      // If we've exhausted retries, move to fallback
      if (attempt === PRIMARY_RETRY_COUNT) {
        console.log(`[${label}] Exhausted ${PRIMARY_RETRY_COUNT} retries, trying fallback...`)
      }
    }
  }
  
  // Try fallback model only after primary model failed all retries
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
      console.log(`[${label}] ${FALLBACK_IMAGE_MODEL} succeeded in ${Date.now() - startTime}ms`)
      return { image: fallbackResult, model: 'flash' }
    }
    throw new Error('No image in fallback response')
  } catch (fallbackError: any) {
    console.error(`[${label}] ${FALLBACK_IMAGE_MODEL} also failed:`, fallbackError?.message || fallbackError)
    return null
  }
}

// Helper function to generate a single product image
async function generateProductImage(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  productImage2Data: string | null,
  index: number
): Promise<ImageResult | null> {
  const parts: any[] = [
    { text: PRODUCT_PROMPT },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: productImageData,
      },
    },
  ]
  
  // Add second product image if provided
  if (productImage2Data) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: productImage2Data,
      },
    })
  }
  
  return generateImageWithFallback(client, parts, `Product ${index + 1}`)
}

// Legacy instruct prompt for this route
const LEGACY_INSTRUCT_PROMPT = `你是一个擅长拍摄小红书/instagram等社媒生活感照片的摄影师。

请你根据商品图，输出一段韩系审美、小红书和ins的，适合模特展示商品的拍摄指令，要求是随意一点、有生活感。请使用以下格式输出：

- composition：
- model pose：
- model expression：
- lighting and color:
- clothing:

输出的内容要尽量简单，不要包含太复杂的信息尽量控制在200字以内`

// Step 1: Generate photography instructions using gemini-3-pro-preview (VLM)
async function generateInstructions(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  productImage2Data: string | null,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null
): Promise<string | null> {
  try {
    console.log('[Instructions] Starting instruction generation...')
    const startTime = Date.now()
    
    const parts: any[] = [{ text: LEGACY_INSTRUCT_PROMPT }]
    
    // Add product image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: productImageData,
      },
    })
    
    // Add second product image if provided
    if (productImage2Data) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: productImage2Data,
        },
      })
    }
    
    // Add model image if provided
    if (modelImageData) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: modelImageData,
        },
      })
    }
    
    // Add background image if provided
    if (backgroundImageData) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: backgroundImageData,
        },
      })
    }
    
    // Add vibe image if provided
    if (vibeImageData) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: vibeImageData,
        },
      })
    }
    
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts }],
      config: {
        // VLM model for text generation based on images
        safetySettings,
      },
    })
    
    const instructions = extractText(response)
    console.log(`[Instructions] Completed in ${Date.now() - startTime}ms`)
    console.log('[Instructions] Generated:', instructions?.substring(0, 200) + '...')
    return instructions
  } catch (error: any) {
    console.error('[Instructions] Error:', error?.message || error)
    return null
  }
}

// Step 2: Generate model image with instructions
async function generateModelImage(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  productImage2Data: string | null,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  modelStyle: string | undefined,
  modelGender: string | undefined,
  instructPrompt: string | null,
  index: number
): Promise<ImageResult | null> {
  // Build the prompt with instructions using edit prompt builder
  const modelPrompt = buildEditPrompt({
    hasModel: !!modelImageData,
    modelStyle,
    modelGender,
    hasBackground: !!backgroundImageData,
    hasVibe: !!vibeImageData,
  }) + (instructPrompt ? `\n\nPhoto shot instruction:\n${instructPrompt}` : '')
  
  console.log(`[Model ${index + 1}] Prompt preview:`, modelPrompt.substring(0, 300) + '...')
  
  const parts: any[] = []
  
  // Add model reference image first if provided
  if (modelImageData) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: modelImageData,
      },
    })
  }
  
  // Add prompt
  parts.push({ text: modelPrompt })
  
  // Add product image (required)
  parts.push({
    inlineData: {
      mimeType: 'image/jpeg',
      data: productImageData,
    },
  })
  
  // Add second product image if provided
  if (productImage2Data) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: productImage2Data,
      },
    })
  }
  
  // Add background reference
  if (backgroundImageData) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: backgroundImageData,
      },
    })
  }
  
  // Add vibe reference
  if (vibeImageData) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: vibeImageData,
      },
    })
  }
  
  return generateImageWithFallback(client, parts, `Model ${index + 1}`)
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
    const { productImage, productImage2, modelImage, modelStyle, modelGender, backgroundImage, vibeImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Pre-process images - 支持 URL 和 base64 格式
    console.log('Processing input images...')
    console.log('- productImage:', productImage?.substring(0, 50) || 'null')
    console.log('- productImage2:', productImage2?.substring(0, 50) || 'null')
    console.log('- modelImage:', modelImage?.substring(0, 50) || 'null')
    console.log('- backgroundImage:', backgroundImage?.substring(0, 50) || 'null')
    console.log('- vibeImage:', vibeImage?.substring(0, 50) || 'null')
    
    // 所有图片都支持 URL 格式（后端转换），减少前端请求体大小
    const productImageData = await ensureBase64Data(productImage)
    const productImage2Data = await ensureBase64Data(productImage2)
    const modelImageData = await ensureBase64Data(modelImage)
    const backgroundImageData = await ensureBase64Data(backgroundImage)
    const vibeImageData = await ensureBase64Data(vibeImage)
    
    // Validate product image - must be valid base64
    if (!productImageData || productImageData.length < 100) {
      console.error('Invalid product image data, length:', productImageData?.length)
      return NextResponse.json({ 
        success: false, 
        error: '商品图片格式无效，请重新拍摄或上传' 
      }, { status: 400 })
    }
    
    // Additional validation: check if it's valid base64
    const isValidBase64 = /^[A-Za-z0-9+/]+=*$/.test(productImageData.substring(0, 1000))
    if (!isValidBase64) {
      console.error('Product image is not valid base64, first 100 chars:', productImageData.substring(0, 100))
      return NextResponse.json({ 
        success: false, 
        error: '商品图片编码格式错误，请重新拍摄或上传' 
      }, { status: 400 })
    }
    
    console.log('Processed image data lengths:')
    console.log('- productImageData:', productImageData.length)
    console.log('- productImage2Data:', productImage2Data?.length || 'null')
    console.log('- modelImageData:', modelImageData?.length || 'null')
    console.log('- backgroundImageData:', backgroundImageData?.length || 'null')
    console.log('- vibeImageData:', vibeImageData?.length || 'null')
    
    const results: string[] = []
    const modelTypes: ('pro' | 'flash')[] = [] // Track which model generated each image
    
    // === SERIAL GENERATION WITH DELAYS TO REDUCE 429 ===
    // Generate images one at a time with delays between requests
    
    // Step 1: Generate product image 1
    console.log('Step 1.1: Generating product image 1...')
    const product1 = await generateProductImage(client, productImageData, productImage2Data, 0)
    if (product1) {
      results.push(`data:image/png;base64,${product1.image}`)
      modelTypes.push(product1.model)
    }
    
    // Delay before next request
    await delay(BATCH_DELAY_MS)
    
    // Step 1.2: Generate product image 2
    console.log('Step 1.2: Generating product image 2...')
    const product2 = await generateProductImage(client, productImageData, productImage2Data, 1)
    if (product2) {
      results.push(`data:image/png;base64,${product2.image}`)
      modelTypes.push(product2.model)
    }
    console.log(`Product images done: ${results.length}/2`)
    
    // === MODEL IMAGE 1: Generate instruction + image ===
    await delay(BATCH_DELAY_MS)
    
    // Step 2.1: Generate photography instructions for model image 1
    console.log('Step 2.1: Generating instructions for model image 1...')
    const instructPrompt1 = await generateInstructions(
      client,
      productImageData,
      productImage2Data,
      modelImageData,
      backgroundImageData,
      vibeImageData
    )
    
    await delay(BATCH_DELAY_MS)
    
    // Step 3.1: Generate model image 1 with its own instructions
    console.log('Step 3.1: Generating model image 1...')
    const model1 = await generateModelImage(
      client, productImageData, productImage2Data, modelImageData, backgroundImageData, vibeImageData,
      modelStyle, modelGender, instructPrompt1, 0
    )
    if (model1) {
      results.push(`data:image/png;base64,${model1.image}`)
      modelTypes.push(model1.model)
    }
    
    // === MODEL IMAGE 2: Generate NEW instruction + image ===
    await delay(BATCH_DELAY_MS)
    
    // Step 2.2: Generate NEW photography instructions for model image 2
    console.log('Step 2.2: Generating instructions for model image 2...')
    const instructPrompt2 = await generateInstructions(
      client,
      productImageData,
      productImage2Data,
      modelImageData,
      backgroundImageData,
      vibeImageData
    )
    
    await delay(BATCH_DELAY_MS)
    
    // Step 3.2: Generate model image 2 with its own instructions
    console.log('Step 3.2: Generating model image 2...')
    const model2 = await generateModelImage(
      client, productImageData, productImage2Data, modelImageData, backgroundImageData, vibeImageData,
      modelStyle, modelGender, instructPrompt2, 1
    )
    if (model2) {
      results.push(`data:image/png;base64,${model2.image}`)
      modelTypes.push(model2.model)
    }
    console.log(`Model images done: ${results.length - 2}/2`)
    
    const duration = Date.now() - startTime
    const flashCount = modelTypes.filter(m => m === 'flash').length
    console.log(`Generation completed: ${results.length}/4 images in ${duration}ms (${flashCount} used fallback)`)
    
    if (results.length === 0) {
      // Save failed generation record
      saveGenerationServer(
        userId,
        'camera',
        { modelStyle, modelGender },
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
    
    // Upload images to Supabase Storage
    let finalImages = results
    const generationId = generateId()
    
    console.log('Uploading images to Supabase Storage...')
    const uploadPromises = results.map((base64Url, index) => 
      uploadGeneratedImageServer(base64Url, generationId, index, userId)
    )
    
    // Also upload input image(s)
    uploadInputImageServer(productImage, generationId, userId).catch(console.error)
    if (productImage2) {
      uploadInputImageServer(productImage2, generationId + '-2', userId).catch(console.error)
    }
    
    const uploadedUrls = await Promise.all(uploadPromises)
    
    // Replace base64 with storage URLs where upload succeeded
    finalImages = uploadedUrls.map((url, index) => url || results[index])
    
    const successfulUploads = uploadedUrls.filter(Boolean).length
    console.log(`Uploaded ${successfulUploads}/${results.length} images to storage`)
    
    // Save generation record with storage URLs
    saveGenerationServer(
      userId,
      'camera',
      {
        modelStyle,
        modelGender,
        hasProduct2: !!productImage2,
        modelImageUrl: modelImage ? '[provided]' : undefined,
        backgroundImageUrl: backgroundImage ? '[provided]' : undefined,
        vibeImageUrl: vibeImage ? '[provided]' : undefined,
        instructPrompt: instructPrompt1 || instructPrompt2 || undefined,
      },
      finalImages,
      duration,
      'completed'
    ).catch(console.error)
    
    return NextResponse.json({
      success: true,
      images: finalImages,
      modelTypes, // Array indicating which model generated each image: 'pro' or 'flash'
      generationId,
      stats: {
        total: 4,
        successful: results.length,
        duration,
        hasInstructions: !!(instructPrompt1 || instructPrompt2),
        hasProduct2: !!productImage2,
        flashCount, // Number of images generated by fallback model
      }
    })
    
  } catch (error: any) {
    console.error('Generation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}
