import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { generateId } from '@/lib/utils'
import { uploadGeneratedImageServer } from '@/lib/supabase/storage-server'

export const maxDuration = 180 // 3 minutes

// Model image generation prompt
const MODEL_IMAGE_PROMPT = `[Role: World-Class E-commerce Photographer & Retoucher]

# Input
- Reference Product Image: [Insert Single Product Image Here]
- Model Persona: {model_prompt} (Note: This prompt already contains anatomical constraints)
- Product Description: {product_desc}

# Task
Generate a high-fidelity e-commerce fashion shot of the model wearing the Reference Product.

# Execution Steps
1. Subject Construction (Priority High): strictly adhere to the anatomical proportions defined in the Model Persona prompt (e.g., 8-head figure). Do not distort limbs or body ratios.
2. Virtual Try-On: Dress the model in the 'Reference Product'.
   - Ensure fabric physics are realistic (drape, wrinkles, tension).
   - The product must fit the model's idealized body naturally.
3. Studio Setup:
   - Lighting: Professional studio lighting promoting form and texture.
   - Framing: Full body vertical composition (9:16 ratio).

# Quality Constraints
- Maintain anatomical integrity. No weird hands, distorted legs, or incorrect head-to-body ratios.
- Photorealistic, 8k resolution.
- The product is the main focus.

# Output
The final image only.`

// Helper to ensure base64 data
async function ensureBase64Data(image: string): Promise<string> {
  if (image.startsWith('data:')) {
    return image.split(',')[1] || image
  }
  if (image.startsWith('http')) {
    const response = await fetch(image)
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }
  return image
}

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id
  
  try {
    const body = await request.json()
    const { productImages, modelPrompt, productDescriptions } = body
    
    if (!productImages || productImages.length === 0) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    if (!modelPrompt) {
      return NextResponse.json({ success: false, error: '缺少模特描述' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Build prompt with model description and product description
    const productDesc = productDescriptions && productDescriptions.length > 0
      ? productDescriptions.map((d: { description: string }) => d.description).join('; ')
      : 'Fashion clothing item'
    
    let finalPrompt = MODEL_IMAGE_PROMPT
      .replace('{model_prompt}', modelPrompt)
      .replace('{product_desc}', productDesc)
    
    const parts: any[] = [{ text: finalPrompt }]
    
    // Add product images
    for (const image of productImages) {
      const imageData = await ensureBase64Data(image)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      })
    }
    
    console.log('[Generate Model Image] Calling Gemini with prompt:', modelPrompt.substring(0, 100) + '...')
    
    // Call Gemini image generation model
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const imageResult = extractImage(response)
    
    if (!imageResult) {
      // Try fallback model
      console.log('[Generate Model Image] Primary model failed, trying fallback...')
      const fallbackResponse = await client.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          safetySettings,
        },
      })
      
      const fallbackResult = extractImage(fallbackResponse)
      if (!fallbackResult) {
        return NextResponse.json({ success: false, error: 'AI 图片生成失败，请重试' }, { status: 500 })
      }
      
      // Upload to storage
      const generationId = generateId()
      const base64Url = `data:image/png;base64,${fallbackResult}`
      const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, 0, userId)
      
      if (!uploadedUrl) {
        return NextResponse.json({ success: false, error: '图片上传失败，请重试' }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        imageUrl: uploadedUrl,
        generationId,
        model: 'fallback',
      })
    }
    
    // Upload to storage
    const generationId = generateId()
    const base64Url = `data:image/png;base64,${imageResult}`
    const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, 0, userId)
    
    if (!uploadedUrl) {
      console.error('[Generate Model Image] Failed to upload to storage')
      return NextResponse.json({ success: false, error: '图片上传失败，请重试' }, { status: 500 })
    }
    
    console.log('[Generate Model Image] Success, uploaded to storage:', uploadedUrl)
    
    return NextResponse.json({
      success: true,
      imageUrl: uploadedUrl,
      generationId,
      model: 'primary',
    })
    
  } catch (error: any) {
    console.error('Generate image error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '图片生成失败，请重试'
    }, { status: 500 })
  }
}

