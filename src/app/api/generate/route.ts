import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'

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
    console.log(`[Product ${index + 1}] Completed in ${Date.now() - startTime}ms`)
    return result
  } catch (error) {
    console.error(`[Product ${index + 1}] Error:`, error)
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
    console.log(`[Model ${index + 1}] Completed in ${Date.now() - startTime}ms`)
    return result
  } catch (error) {
    console.error(`[Model ${index + 1}] Error:`, error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { productImage, modelImage, modelStyle, modelGender, backgroundImage, vibeImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
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
    
    console.log('Starting parallel image generation...')
    
    // Generate all 4 images in parallel
    const [product1, product2, model1, model2] = await Promise.all([
      generateProductImage(client, productImageData, 0),
      generateProductImage(client, productImageData, 1),
      generateModelImage(client, productImageData, modelPrompt, modelImageData, backgroundImageData, vibeImageData, 0),
      generateModelImage(client, productImageData, modelPrompt, modelImageData, backgroundImageData, vibeImageData, 1),
    ])
    
    // Collect successful results
    const results: string[] = []
    
    if (product1) results.push(`data:image/png;base64,${product1}`)
    if (product2) results.push(`data:image/png;base64,${product2}`)
    if (model1) results.push(`data:image/png;base64,${model1}`)
    if (model2) results.push(`data:image/png;base64,${model2}`)
    
    console.log(`Generation completed: ${results.length}/4 images in ${Date.now() - startTime}ms`)
    
    if (results.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '图片生成失败，请重试' 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      images: results,
      stats: {
        total: 4,
        successful: results.length,
        duration: Date.now() - startTime,
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
