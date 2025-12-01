import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { saveGenerationServer } from '@/lib/supabase/generations-server'

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
      model: 'gemini-3-pro-image-preview',
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

// Helper function to generate a single model image
async function generateModelImage(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  modelPrompt: string,
  modelImageData: string | null,
  backgroundImageData: string | null,
  vibeImageData: string | null,
  index: number
): Promise<string | null> {
  try {
    console.log(`[Model ${index + 1}] Starting generation...`)
    const startTime = Date.now()
    
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
      model: 'gemini-3-pro-image-preview',
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
    const productImageData = stripBase64Prefix(productImage)
    const modelImageData = modelImage ? stripBase64Prefix(modelImage) : null
    const backgroundImageData = backgroundImage ? stripBase64Prefix(backgroundImage) : null
    const vibeImageData = vibeImage ? stripBase64Prefix(vibeImage) : null
    
    // Build model prompt once
    const modelPrompt = buildModelPrompt({
      hasModel: !!modelImage,
      modelStyle,
      modelGender,
      hasBackground: !!backgroundImage,
      hasVibe: !!vibeImage,
    })
    
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
    
    // Step 2: Generate 2 model images in parallel
    console.log('Step 2: Generating model images...')
    const modelResults = await Promise.allSettled([
      generateModelImage(client, productImageData, modelPrompt, modelImageData, backgroundImageData, vibeImageData, 0),
      generateModelImage(client, productImageData, modelPrompt, modelImageData, backgroundImageData, vibeImageData, 1),
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
    
    // Save successful generation record to database
    if (userId) {
      saveGenerationServer(
        userId,
        'camera',
        {
          modelStyle,
          modelGender,
          modelImageUrl: modelImage ? '[provided]' : undefined,
          backgroundImageUrl: backgroundImage ? '[provided]' : undefined,
          vibeImageUrl: vibeImage ? '[provided]' : undefined,
        },
        results,
        duration,
        'completed'
      ).catch(console.error) // Don't block response
    }
    
    return NextResponse.json({
      success: true,
      images: results,
      stats: {
        total: 4,
        successful: results.length,
        duration,
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
