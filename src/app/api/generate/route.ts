import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { saveGenerationServer } from '@/lib/supabase/generations-server'
import { uploadGeneratedImageServer, uploadInputImageServer } from '@/lib/supabase/storage-server'

export const maxDuration = 120

// Helper function to generate a single product image
async function generateProductImage(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  index: number
): Promise<string | null> {
  try {
    console.log(`[Product ${index + 1}] Starting generation...`)
    const startTime = Date.now()
    
    const productParts = [
      { text: PRODUCT_PROMPT },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: productImageData,
        },
      },
    ]
    
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ role: 'user', parts: productParts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    console.log(`[Product ${index + 1}] Completed in ${Date.now() - startTime}ms, success: ${!!result}`)
    return result
  } catch (error: any) {
    console.error(`[Product ${index + 1}] Error:`, error?.message || error)
    return null
  }
}

// Step 1: Generate photography instructions using Gemini
async function generateInstructions(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  modelStyle?: string,
  modelGender?: string
): Promise<string | null> {
  try {
    console.log('[Instructions] Starting instruction generation...')
    const startTime = Date.now()
    
    const instructPrompt = buildInstructPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      modelGender,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
    })
    
    const parts: any[] = [{ text: instructPrompt }]
    
    // Add product image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: productImageData,
      },
    })
    
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
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT'],
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
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  modelStyle: string | undefined,
  modelGender: string | undefined,
  instructPrompt: string | null,
  index: number
): Promise<string | null> {
  try {
    console.log(`[Model ${index + 1}] Starting generation...`)
    const startTime = Date.now()
    
    // Build the prompt with instructions
    const modelPrompt = buildModelPrompt({
      hasModel: !!modelImageData,
      modelStyle,
      modelGender,
      hasBackground: !!backgroundImageData,
      hasVibe: !!vibeImageData,
      instructPrompt: instructPrompt || undefined,
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
    
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    console.log(`[Model ${index + 1}] Completed in ${Date.now() - startTime}ms, success: ${!!result}`)
    return result
  } catch (error: any) {
    console.error(`[Model ${index + 1}] Error:`, error?.message || error)
    return null
  }
}

// Small delay to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { productImage, modelImage, modelStyle, modelGender, backgroundImage, vibeImage } = body
    
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
    console.log('- modelImage length:', modelImage?.length || 0)
    console.log('- backgroundImage length:', backgroundImage?.length || 0)
    console.log('- vibeImage length:', vibeImage?.length || 0)
    
    const productImageData = stripBase64Prefix(productImage)
    const modelImageData = modelImage ? stripBase64Prefix(modelImage) : null
    const backgroundImageData = backgroundImage ? stripBase64Prefix(backgroundImage) : null
    const vibeImageData = vibeImage ? stripBase64Prefix(vibeImage) : null
    
    // Validate product image
    if (!productImageData || productImageData.length < 100) {
      console.error('Invalid product image data, length:', productImageData?.length)
      return NextResponse.json({ 
        success: false, 
        error: '商品图片格式无效，请重新拍摄或上传' 
      }, { status: 400 })
    }
    
    console.log('Processed image data lengths:')
    console.log('- productImageData:', productImageData.length)
    console.log('- modelImageData:', modelImageData?.length || 'null')
    console.log('- backgroundImageData:', backgroundImageData?.length || 'null')
    console.log('- vibeImageData:', vibeImageData?.length || 'null')
    
    const results: string[] = []
    
    // Step 1: Generate 2 product images in parallel
    console.log('Step 1: Generating product images...')
    const productResults = await Promise.allSettled([
      generateProductImage(client, productImageData, 0),
      generateProductImage(client, productImageData, 1),
    ])
    
    for (const result of productResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(`data:image/png;base64,${result.value}`)
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
      modelImageData,
      backgroundImageData,
      vibeImageData,
      modelStyle,
      modelGender
    )
    
    await delay(300)
    
    // Step 3: Generate 2 model images with instructions in parallel
    console.log('Step 3: Generating model images with instructions...')
    const modelResults = await Promise.allSettled([
      generateModelImage(
        client, productImageData, modelImageData, backgroundImageData, vibeImageData,
        modelStyle, modelGender, instructPrompt, 0
      ),
      generateModelImage(
        client, productImageData, modelImageData, backgroundImageData, vibeImageData,
        modelStyle, modelGender, instructPrompt, 1
      ),
    ])
    
    for (const result of modelResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(`data:image/png;base64,${result.value}`)
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`Generation completed: ${results.length}/4 images in ${duration}ms`)
    
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
      
      // Also upload input image
      uploadInputImageServer(productImage, generationId, userId).catch(console.error)
      
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
      generationId,
      stats: {
        total: 4,
        successful: results.length,
        duration,
        hasInstructions: !!instructPrompt,
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
