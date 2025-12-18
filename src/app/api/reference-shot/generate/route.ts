import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadGeneratedImageServer } from '@/lib/supabase/storage-server'
import { generateId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

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

// Build the final prompt
function buildFinalPrompt(captionPrompt: string): string {
  return `You are an expert fashion photographer. Create a photorealistic image combining the following elements:

[Input Mapping]
- Reference Structure: Use the background image as the scene and lighting reference.
- Subject ID: Use the person in the model image as the model. Keep their exact facial features, skin tone, and body proportions.
- Apparel Detail: The model is wearing the product from the product image. Ensure the fabric texture, logo, color, and fit are identical to the product image.

[Scene & Action]
${captionPrompt}

[Execution Guidelines]
- The lighting on the model must perfectly match the background image.
- Blending must be seamless; shadows must fall naturally on the ground/environment.
- Composition: Instagram-friendly vertical crop.
- Focus: Sharp focus on the model and product, with natural depth of field matching the scene.

[Negative Prompt]
bad anatomy, distorted fingers, floating limbs, mismatched lighting, cartoonish, low resolution, blurry face, changed product color, distorted logos.`
}

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id
  const userEmail = authResult.user.email
  
  try {
    const body = await request.json()
    const { 
      productImage, 
      modelImage, 
      backgroundImage, 
      captionPrompt,
      referenceImageUrl,
    } = body
    
    if (!productImage || !modelImage || !backgroundImage || !captionPrompt) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要参数' 
      }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const finalPrompt = buildFinalPrompt(captionPrompt)
    
    // Prepare image data
    const productData = await ensureBase64Data(productImage)
    const modelData = await ensureBase64Data(modelImage)
    const backgroundData = await ensureBase64Data(backgroundImage)
    
    // Generate 2 images
    const generationId = generateId()
    const results: string[] = []
    
    for (let i = 0; i < 2; i++) {
      try {
        console.log(`[ReferenceShot] Generating image ${i + 1}/2...`)
        
        const response = await client.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: [{
            role: 'user',
            parts: [
              { text: finalPrompt },
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
              { text: '\n\n[Background Image]:' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: backgroundData,
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
          const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, i, userId)
          
          if (uploadedUrl) {
            results.push(uploadedUrl)
          } else {
            results.push(base64Url) // Fallback to base64
          }
        }
      } catch (err: any) {
        console.error(`[ReferenceShot] Error generating image ${i + 1}:`, err.message)
      }
    }
    
    if (results.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI 图片生成失败' 
      }, { status: 500 })
    }
    
    // Save to database
    const supabase = await createClient()
    const { data: genData, error: genError } = await supabase
      .from('generations')
      .insert({
        user_id: userId,
        user_email: userEmail,
        task_type: 'reference_shot',
        status: 'completed',
        output_image_urls: results,
        input_image_url: referenceImageUrl || null,
        input_params: {
          captionPrompt: captionPrompt.substring(0, 500),
          hasCustomModel: !!modelImage,
        },
        total_images_count: results.length,
      })
      .select()
      .single()
    
    if (genError) {
      console.error('[ReferenceShot] Failed to save generation:', genError)
    } else {
      console.log('[ReferenceShot] Saved generation:', genData.id)
    }
    
    console.log(`[ReferenceShot] Generated ${results.length} images`)
    
    return NextResponse.json({
      success: true,
      images: results,
      generationId: genData?.id || generationId,
    })
    
  } catch (error: any) {
    console.error('[ReferenceShot] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '生成失败'
    }, { status: 500 })
  }
}

