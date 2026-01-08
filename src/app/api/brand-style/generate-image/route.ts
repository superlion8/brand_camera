import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage } from '@/lib/genai'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Lazy initialize supabase (service role) for storage
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  
  return createClient(url, key)
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

// Upload generated image to Supabase storage
async function uploadToSupabase(base64Data: string, mimeType: string): Promise<string> {
  const supabase = getSupabaseAdmin()
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

// Save generation record to gallery
async function saveToGallery(
  userId: string,
  userEmail: string,
  imageUrl: string,
  type: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  
  const { error } = await supabase
    .from('generations')
    .insert({
      user_id: userId,
      user_email: userEmail,
      task_id: `brand-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      task_type: 'brand_style',
      status: 'completed',
      total_images_count: 1,
      output_image_urls: [imageUrl], // 使用正确的字段名
      metadata: { type } // web, ins, or product
    })
  
  if (error) {
    console.error('[Brand Style] Error saving to gallery:', error)
    // Don't throw - image was generated successfully
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productImage, referenceImage, type, brandSummary, styleKeywords } = await request.json()

    if (!productImage || !referenceImage) {
      return NextResponse.json({ error: 'Missing required images' }, { status: 400 })
    }

    console.log(`[Brand Style] Generating ${type} style image for user ${user.id}...`)

    // Prepare images
    const [productImageData, referenceImageData] = await Promise.all([
      getImageBase64(productImage),
      getImageBase64(referenceImage)
    ])

    // Build prompt based on type
    let prompt: string
    switch (type) {
      case 'web':
        // 官网展品展示图：保持参考图中的模特和背景，姿势微调
        prompt = `给第一张图片中的商品[product]生成模特展示图。

要求：
1. 保持第二张参考图[web_img_model]中的模特外貌特征和背景环境
2. 姿势微调，使其更符合[product]商品的气质
3. 穿搭要搭配适合[product]风格的服装配饰
4. 商品[product]必须清晰可见，是画面的焦点
5. 保持专业电商级别的画质和光影

品牌风格：${brandSummary || '现代、专业、高质量时尚品牌'}
关键词：${styleKeywords?.join(', ') || '专业、优雅、现代'}

生成一张高质量的官网风格模特展示图。`
        break
        
      case 'ins':
        // INS风格图：保持参考图中的模特，背景可根据pose调整
        prompt = `给第一张图片中的商品[product]生成INS风格模特展示图。

要求：
1. 保持第二张参考图中的模特外貌特征
2. 姿势微调，使其更符合[product]商品的气质
3. 背景使用参考图的空间风格，可以根据新的pose调整拍摄角度
4. 穿搭要搭配适合[product]风格的服装配饰
5. 画面要有INS/社交媒体的生活感和氛围感
6. 自然光或氛围光，色调温暖有质感

品牌风格：${brandSummary || '时尚、真实、生活方式导向'}
关键词：${styleKeywords?.join(', ') || '生活方式、真实、时尚'}

生成一张适合INS发布的生活方式模特展示图。`
        break
        
      case 'product':
        // 商品展示图：无模特，参考原图的拍摄风格
        prompt = `给第一张图片中的商品[product]生成一张无模特的商品展示图。

要求：
1. 参考第二张图[web_img_product]的拍摄风格
2. 参考其光影效果和布光方式
3. 参考其背景布局和场景设计
4. 不要出现人物/模特
5. 商品是唯一的主角，清晰展示细节
6. 专业的产品摄影级别画质

品牌风格：${brandSummary || '干净、专业的产品摄影'}
关键词：${styleKeywords?.join(', ') || '干净、专业、细节'}

生成一张专业的纯商品展示图。`
        break
        
      default:
        throw new Error(`Unknown generation type: ${type}`)
    }

    // Generate image using Gemini 3 Pro Image Preview
    const genAI = getGenAIClient()
    const result = await genAI.models.generateContent({
      model: 'gemini-3-pro-image-preview',
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

    // Save to gallery
    console.log('[Brand Style] Saving to gallery...')
    await saveToGallery(user.id, user.email || '', imageUrl, type)

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

