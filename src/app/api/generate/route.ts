import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productImage, modelImage, modelStyle, backgroundImage, vibeImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const results: string[] = []
    
    // Generate 2 product images
    console.log('Generating product images...')
    for (let i = 0; i < 2; i++) {
      try {
        const productParts: any[] = [
          { text: PRODUCT_PROMPT },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: stripBase64Prefix(productImage),
            },
          },
        ]
        
        const productResponse = await client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: productParts }],
          config: {
            responseModalities: ['IMAGE'],
            safetySettings,
          },
        })
        
        const productImageResult = extractImage(productResponse)
        if (productImageResult) {
          results.push(`data:image/png;base64,${productImageResult}`)
        }
      } catch (error) {
        console.error(`Error generating product image ${i + 1}:`, error)
      }
    }
    
    // Generate 2 model images
    console.log('Generating model images...')
    const modelPrompt = buildModelPrompt({
      hasModel: !!modelImage,
      modelStyle,
      hasBackground: !!backgroundImage,
      hasVibe: !!vibeImage,
    })
    
    for (let i = 0; i < 2; i++) {
      try {
        const modelParts: any[] = []
        
        // Add model reference image first if provided
        if (modelImage) {
          modelParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: stripBase64Prefix(modelImage),
            },
          })
        }
        
        // Add prompt
        modelParts.push({ text: modelPrompt })
        
        // Add product image (required)
        modelParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: stripBase64Prefix(productImage),
          },
        })
        
        // Add background reference
        if (backgroundImage) {
          modelParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: stripBase64Prefix(backgroundImage),
            },
          })
        }
        
        // Add vibe reference
        if (vibeImage) {
          modelParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: stripBase64Prefix(vibeImage),
            },
          })
        }
        
        const modelResponse = await client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: modelParts }],
          config: {
            responseModalities: ['IMAGE'],
            safetySettings,
          },
        })
        
        const modelImageResult = extractImage(modelResponse)
        if (modelImageResult) {
          results.push(`data:image/png;base64,${modelImageResult}`)
        }
      } catch (error) {
        console.error(`Error generating model image ${i + 1}:`, error)
      }
    }
    
    if (results.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '图片生成失败，请重试' 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      images: results,
    })
    
  } catch (error: any) {
    console.error('Generation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '生成失败' 
    }, { status: 500 })
  }
}

