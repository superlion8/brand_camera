import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage } from '@/lib/genai'
import { createClient } from '@supabase/supabase-js'

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Helper to convert image URL or base64 to base64 data
async function getImageBase64(imageSource: string): Promise<{ data: string; mimeType: string }> {
  if (imageSource.startsWith('data:')) {
    // Already base64
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      return { mimeType: match[1], data: match[2] }
    }
  }
  
  // Fetch from URL
  const response = await fetch(imageSource)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  
  return { data: base64, mimeType }
}

// Upload generated image to Supabase
async function uploadToSupabase(base64Data: string, mimeType: string): Promise<string> {
  const supabase = getSupabase()
  const buffer = Buffer.from(base64Data, 'base64')
  const extension = mimeType.includes('png') ? 'png' : 'jpg'
  const filename = `brand-style/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: false
    })
  
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage
    .from('generations')
    .getPublicUrl(filename)
  
  return urlData.publicUrl
}

export async function POST(request: NextRequest) {
  try {
    const { productImage, referenceImage, type, brandSummary, styleKeywords } = await request.json()

    if (!productImage || !referenceImage) {
      return NextResponse.json({ error: 'Missing required images' }, { status: 400 })
    }

    console.log(`[Brand Style] Generating ${type} style image...`)

    // Prepare images
    const [productImageData, referenceImageData] = await Promise.all([
      getImageBase64(productImage),
      getImageBase64(referenceImage)
    ])

    // Build prompt based on type
    let prompt: string
    switch (type) {
      case 'web':
        prompt = `[Role: Professional E-commerce Fashion Photographer]

# Task
Generate a professional e-commerce model photo for the product shown in the first image.

# Reference Style
Use the second image as a style reference for:
- Model appearance and pose
- Background and environment
- Lighting and atmosphere
- Overall aesthetic

# Product
The clothing/product from the first image should be worn/displayed by the model.

# Brand Style
${brandSummary || 'Modern, professional, high-quality fashion brand'}
Keywords: ${styleKeywords?.join(', ') || 'professional, elegant, modern'}

# Requirements
- Professional studio or lifestyle setting
- Model should be facing the camera or slightly angled
- Clean, commercial-quality result
- The product should be clearly visible and well-presented
- Maintain anatomical correctness

# Output
Generate a single high-quality e-commerce photo.`
        break
        
      case 'ins':
        prompt = `[Role: Instagram Fashion Content Creator]

# Task
Generate an Instagram-style lifestyle photo featuring the product from the first image.

# Reference Style
Use the second image as a style reference for:
- Aesthetic and vibe
- Color grading and mood
- Lifestyle setting
- Model styling

# Product
The clothing/product from the first image should be worn/displayed naturally.

# Brand Style
${brandSummary || 'Trendy, authentic, lifestyle-focused brand'}
Keywords: ${styleKeywords?.join(', ') || 'lifestyle, authentic, trendy'}

# Requirements
- Natural, candid feel (not too posed)
- Lifestyle environment (cafe, street, home, etc.)
- Warm, inviting atmosphere
- Instagram-worthy composition
- Product should look natural and desirable

# Output
Generate a single Instagram-style lifestyle photo.`
        break
        
      case 'product':
        prompt = `[Role: Product Photography Specialist]

# Task
Generate a clean product-only photo (no model) for the product shown in the first image.

# Reference Style
Use the second image as a reference for:
- Lighting setup
- Background style
- Product staging
- Overall aesthetic

# Product
Recreate the product from the first image in a studio setting.

# Brand Style
${brandSummary || 'Clean, professional product photography'}
Keywords: ${styleKeywords?.join(', ') || 'clean, professional, detailed'}

# Requirements
- No human model, product only
- Clean studio background
- Professional lighting
- Product should be the hero
- High detail and clarity

# Output
Generate a single professional product photo.`
        break
        
      default:
        throw new Error(`Unknown generation type: ${type}`)
    }

    // Generate image
    const genAI = getGenAIClient()
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: productImageData.mimeType, data: productImageData.data } },
            { inlineData: { mimeType: referenceImageData.mimeType, data: referenceImageData.data } }
          ]
        }
      ],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      }
    })

    // Extract generated image using helper
    const generatedImageBase64 = extractImage(result)
    const generatedMimeType = 'image/png'

    if (!generatedImageBase64) {
      throw new Error('No image generated')
    }

    // Upload to Supabase
    console.log('[Brand Style] Uploading generated image...')
    const imageUrl = await uploadToSupabase(generatedImageBase64, generatedMimeType)

    console.log('[Brand Style] Image generation complete')

    return NextResponse.json({
      imageUrl,
      success: true
    })

  } catch (error) {
    console.error('[Brand Style] Error generating image:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

