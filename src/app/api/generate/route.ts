import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { saveGenerationServer } from '@/lib/supabase/generations-server'
import { uploadGeneratedImageServer, uploadInputImageServer } from '@/lib/supabase/storage-server'

export const maxDuration = 120

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Result type with model info
interface ImageResult {
  image: string
  model: 'pro' | 'flash'
}

// Helper function to generate image with fallback
async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  // Try primary model first
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
      console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} succeeded in ${Date.now() - startTime}ms`)
      return { image: result, model: 'pro' }
    }
    throw new Error('No image in response')
  } catch (primaryError: any) {
    console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} failed: ${primaryError?.message || primaryError}`)
    
    // Check if it's a rate limit or quota error
    const errorMessage = primaryError?.message?.toLowerCase() || ''
    const shouldFallback = errorMessage.includes('quota') || 
                          errorMessage.includes('rate') || 
                          errorMessage.includes('limit') ||
                          errorMessage.includes('exhausted') ||
                          errorMessage.includes('429') ||
                          errorMessage.includes('resource') ||
                          true // Always try fallback on any error
    
    if (!shouldFallback) {
      console.log(`[${label}] Not a quota/rate error, skipping fallback`)
      return null
    }
    
    // Try fallback model
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

// Step 1: Generate photography instructions using gemini-3-pro-preview (VLM)
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
    console.log('[Instructions] Starting instruction generation...')
    const startTime = Date.now()
    
    const instructPrompt = buildInstructPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
      hasProduct2: !!productImage2Data,
    })
    
    const parts: any[] = [{ text: instructPrompt }]
    
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
  // Build the prompt with instructions
  const modelPrompt = buildModelPrompt({
    hasModel: !!modelImageData,
    modelStyle,
    modelGender,
    hasBackground: !!backgroundImageData,
    hasVibe: !!vibeImageData,
    instructPrompt: instructPrompt || undefined,
    hasProduct2: !!productImage2Data,
  })
  
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

// Small delay to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { productImage, productImage2, modelImage, modelStyle, modelGender, backgroundImage, vibeImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    // Get user ID for database recording (optional, won't block generation)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch (e) {
      console.log('Could not get user ID:', e)
    }
    
    const client = getGenAIClient()
    
    // Pre-process images once (strip base64 prefix)
    console.log('Processing input images...')
    console.log('- productImage length:', productImage?.length || 0)
    console.log('- productImage2 length:', productImage2?.length || 0)
    console.log('- modelImage length:', modelImage?.length || 0)
    console.log('- backgroundImage length:', backgroundImage?.length || 0)
    console.log('- vibeImage length:', vibeImage?.length || 0)
    
    const productImageData = stripBase64Prefix(productImage)
    const productImage2Data = productImage2 ? stripBase64Prefix(productImage2) : null
    const modelImageData = modelImage ? stripBase64Prefix(modelImage) : null
    const backgroundImageData = backgroundImage ? stripBase64Prefix(backgroundImage) : null
    const vibeImageData = vibeImage ? stripBase64Prefix(vibeImage) : null
    
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
    
    // Step 1: Generate 2 product images in parallel
    console.log('Step 1: Generating product images...')
    const productResults = await Promise.allSettled([
      generateProductImage(client, productImageData, productImage2Data, 0),
      generateProductImage(client, productImageData, productImage2Data, 1),
    ])
    
    for (const result of productResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(`data:image/png;base64,${result.value.image}`)
        modelTypes.push(result.value.model)
      }
    }
    console.log(`Product images done: ${results.length}/2`)
    
    // Small delay between batches to avoid rate limiting
    await delay(500)
    
    // Step 2: Generate photography instructions
    console.log('Step 2: Generating photography instructions...')
    const instructPrompt = await generateInstructions(
      client,
      productImageData,
      productImage2Data,
      modelImageData,
      backgroundImageData,
      vibeImageData,
      modelStyle
    )
    
    await delay(300)
    
    // Step 3: Generate 2 model images with instructions in parallel
    console.log('Step 3: Generating model images with instructions...')
    const modelResults = await Promise.allSettled([
      generateModelImage(
        client, productImageData, productImage2Data, modelImageData, backgroundImageData, vibeImageData,
        modelStyle, modelGender, instructPrompt, 0
      ),
      generateModelImage(
        client, productImageData, productImage2Data, modelImageData, backgroundImageData, vibeImageData,
        modelStyle, modelGender, instructPrompt, 1
      ),
    ])
    
    for (const result of modelResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(`data:image/png;base64,${result.value.image}`)
        modelTypes.push(result.value.model)
      }
    }
    
    const duration = Date.now() - startTime
    const flashCount = modelTypes.filter(m => m === 'flash').length
    console.log(`Generation completed: ${results.length}/4 images in ${duration}ms (${flashCount} used fallback)`)
    
    if (results.length === 0) {
      // Save failed generation record
      if (userId) {
        saveGenerationServer(
          userId,
          'camera',
          { modelStyle, modelGender },
          [],
          duration,
          'failed',
          '图片生成失败'
        ).catch(console.error)
      }
      
      return NextResponse.json({ 
        success: false, 
        error: '图片生成失败，请重试' 
      }, { status: 500 })
    }
    
    // If user is logged in, upload images to Supabase Storage
    let finalImages = results
    const generationId = generateId()
    
    if (userId) {
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
          instructPrompt: instructPrompt || undefined,
        },
        finalImages,
        duration,
        'completed'
      ).catch(console.error)
    }
    
    return NextResponse.json({
      success: true,
      images: finalImages,
      modelTypes, // Array indicating which model generated each image: 'pro' or 'flash'
      generationId,
      stats: {
        total: 4,
        successful: results.length,
        duration,
        hasInstructions: !!instructPrompt,
        hasProduct2: !!productImage2,
        flashCount, // Number of images generated by fallback model
      }
    })
    
  } catch (error: any) {
    console.error('Generation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '生成失败' 
    }, { status: 500 })
  }
}
