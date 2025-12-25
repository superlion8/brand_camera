import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadGeneratedImageServer } from '@/lib/supabase/storage-server'
import { generateId } from '@/lib/utils'

export const maxDuration = 180

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

// Simple mode prompt - directly use ref_img as reference
const SIMPLE_MODE_PROMPT = `You are an expert fashion photographer. Create a photorealistic image combining the following elements:

[Input Mapping]
- Reference Structure: Use the reference image as the scene and lighting reference.
- Subject ID: Use the person in the model image as the model. Keep their exact facial features, skin tone, and body proportions.
- Apparel Detail: The model is wearing the product from the product image. Ensure the fabric texture, logo, color, and fit are identical to the product image.

[Execution Guidelines]
- The lighting on the model must perfectly match the reference image.
- The vibe/pose/expression should follow the person shown in reference image, but slightly change to match the vibe of the model.
- Blending must be seamless; shadows must fall naturally on the ground/environment.
- Composition: Instagram-friendly vertical crop.
- Focus: Sharp focus on the model and product, with natural depth of field matching the scene.

[Negative Prompt]
bad anatomy, distorted fingers, floating limbs, mismatched lighting, cartoonish, low resolution, blurry face, changed product color, distorted logos.`

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id
  
  try {
    const body = await request.json()
    const { 
      productImage, 
      modelImage, 
      referenceImage,
    } = body
    
    if (!productImage || !modelImage || !referenceImage) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要参数' 
      }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Prepare image data
    console.log('[ReferenceShot-Simple] Processing images...')
    
    const productData = await ensureBase64Data(productImage)
    const modelData = await ensureBase64Data(modelImage)
    const referenceData = await ensureBase64Data(referenceImage)
    
    // Validate base64 data lengths
    console.log('[ReferenceShot-Simple] Product data length:', productData?.length || 0)
    console.log('[ReferenceShot-Simple] Model data length:', modelData?.length || 0)
    console.log('[ReferenceShot-Simple] Reference data length:', referenceData?.length || 0)
    
    if (!productData || productData.length < 100) {
      return NextResponse.json({ success: false, error: '商品图片数据无效' }, { status: 400 })
    }
    if (!modelData || modelData.length < 100) {
      return NextResponse.json({ success: false, error: '模特图片数据无效' }, { status: 400 })
    }
    if (!referenceData || referenceData.length < 100) {
      return NextResponse.json({ success: false, error: '参考图片数据无效' }, { status: 400 })
    }
    
    // Generate 1 image (simple mode)
    const generationId = generateId()
    const results: string[] = []
    
      try {
      console.log('[ReferenceShot-Simple] Generating image...')
        
        const response = await client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{
            role: 'user',
            parts: [
              { text: SIMPLE_MODE_PROMPT },
              { text: '\n\n[Reference Image]:' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: referenceData,
                },
              },
              { text: '\n\n[Product Image]:' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: productData,
                },
              },
              { text: '\n\n[Model Image]:' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: modelData,
                },
              },
            ],
          }],
          config: {
            responseModalities: ['IMAGE'],
            safetySettings,
          },
        })
        
        const imageResult = extractImage(response)
        
        if (imageResult) {
          // Upload to storage
          const base64Url = `data:image/png;base64,${imageResult}`
        const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, 0, userId)
          
          if (uploadedUrl) {
            results.push(uploadedUrl)
          } else {
            results.push(base64Url) // Fallback to base64
          }
        }
      } catch (err: any) {
      console.error('[ReferenceShot-Simple] Error generating image:', err.message)
    }
    
    if (results.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI 图片生成失败' 
      }, { status: 500 })
    }
    
    console.log('[ReferenceShot-Simple] Generated 1 image')
    
    return NextResponse.json({
      success: true,
      images: results,
      generationId,
      mode: 'simple',
    })
    
  } catch (error: any) {
    console.error('[ReferenceShot-Simple] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '生成失败'
    }, { status: 500 })
  }
}

