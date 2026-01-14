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

// Build the final prompt (supports multiple products)
function buildFinalPrompt(captionPrompt: string, productCount: number): string {
  const productMapping = productCount > 1 
    ? `- Apparel Details: The model is wearing ALL the products from the product images (${productCount} items). Each product must be visible and identifiable. Ensure the fabric texture, logo, color, and fit are identical to each product image.`
    : `- Apparel Detail: The model is wearing the product from the product image. Ensure the fabric texture, logo, color, and fit are identical to the product image.`

  return `You are an expert fashion photographer. Create a photorealistic image combining the following elements:

[Input Mapping]
- Reference Structure: Use the background image as the scene and lighting reference.
- Subject ID: Use the person in the model image as the model. Keep their exact facial features, skin tone, and body proportions.
${productMapping}

[Scene & Action]
${captionPrompt}

[Execution Guidelines]
- The lighting on the model must perfectly match the background image.
- Blending must be seamless; shadows must fall naturally on the ground/environment.
- Composition: Instagram-friendly vertical crop.
- Focus: Sharp focus on the model and ALL products, with natural depth of field matching the scene.
${productCount > 1 ? '- All products must be clearly visible and properly worn/styled together.\n- Maintain the exact appearance of each product from its respective image.' : ''}

[Negative Prompt]
bad anatomy, distorted fingers, floating limbs, mismatched lighting, cartoonish, low resolution, blurry face, changed product color, distorted logos${productCount > 1 ? ', missing products, products incorrectly styled' : ''}.`
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
    const { 
      productImage, 
      productImages, // Array of product images (up to 4)
      modelImage, 
      backgroundImage, 
      captionPrompt,
      referenceImageUrl,
    } = body
    
    // Support both single productImage and productImages array
    const allProductImages = productImages?.length > 0 ? productImages : (productImage ? [productImage] : [])
    
    if (allProductImages.length === 0 || !modelImage || !backgroundImage || !captionPrompt) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要参数' 
      }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const finalPrompt = buildFinalPrompt(captionPrompt, allProductImages.length)
    
    // Prepare image data
    console.log(`[ReferenceShot-Extended] Processing ${allProductImages.length} product images...`)
    
    // Process all product images
    const productDataArray = await Promise.all(
      allProductImages.map((img: string) => ensureBase64Data(img))
    )
    const modelData = await ensureBase64Data(modelImage)
    const backgroundData = await ensureBase64Data(backgroundImage)
    
    // Validate base64 data lengths
    console.log('[ReferenceShot-Extended] Product images count:', productDataArray.length)
    console.log('[ReferenceShot-Extended] Model data length:', modelData?.length || 0)
    console.log('[ReferenceShot-Extended] Background data length:', backgroundData?.length || 0)
    
    for (let i = 0; i < productDataArray.length; i++) {
      if (!productDataArray[i] || productDataArray[i].length < 100) {
        return NextResponse.json({ success: false, error: `商品图片 ${i + 1} 数据无效` }, { status: 400 })
      }
    }
    if (!modelData || modelData.length < 100) {
      return NextResponse.json({ success: false, error: '模特图片数据无效' }, { status: 400 })
    }
    if (!backgroundData || backgroundData.length < 100) {
      return NextResponse.json({ success: false, error: '背景图片数据无效' }, { status: 400 })
    }
    
    // Generate 1 image (extended mode)
    const generationId = generateId()
    const results: string[] = []
    
      try {
      console.log(`[ReferenceShot-Extended] Generating image with ${productDataArray.length} products...`)
        
        // Build parts array with all product images
        const parts: any[] = [
          { text: finalPrompt },
        ]
        
        // Add all product images
        productDataArray.forEach((productData, idx) => {
          parts.push({ text: `\n\n[Product Image ${idx + 1}]:` })
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: productData,
            },
          })
        })
        
        // Add model and background images
        parts.push({ text: '\n\n[Model Image]:' })
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: modelData,
          },
        })
        parts.push({ text: '\n\n[Background Image]:' })
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: backgroundData,
          },
        })
        
        const response = await client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{
            role: 'user',
            parts,
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
      console.error('[ReferenceShot-Extended] Error generating image:', err.message)
    }
    
    if (results.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI 图片生成失败' 
      }, { status: 500 })
    }
    
    // 不在这里创建 generation 记录，由前端统一调用 save API
    // 配额记录由 quota/reserve 管理
    console.log('[ReferenceShot-Extended] Generated 1 image')
    
    return NextResponse.json({
      success: true,
      images: results,
      generationId,
      mode: 'extended',
    })
    
  } catch (error: any) {
    console.error('[ReferenceShot] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '生成失败'
    }, { status: 500 })
  }
}

