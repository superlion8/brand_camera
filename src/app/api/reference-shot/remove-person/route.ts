import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { uploadGeneratedImageServer } from '@/lib/supabase/storage-server'
import { generateId } from '@/lib/utils'

export const maxDuration = 120

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
    const { referenceImage } = body
    
    if (!referenceImage) {
      return NextResponse.json({ success: false, error: '缺少参考图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    const prompt = `Remove the person/people from this image. Keep the background, environment, lighting, and all other elements intact. Fill in the area where the person was with appropriate background content that matches the surroundings.`
    
    const imageData = await ensureBase64Data(referenceImage)
    
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData,
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
    
    if (!imageResult) {
      return NextResponse.json({ success: false, error: 'AI 图片生成失败' }, { status: 500 })
    }
    
    // Upload to storage
    const generationId = generateId()
    const base64Url = `data:image/png;base64,${imageResult}`
    const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, 0, userId)
    
    if (!uploadedUrl) {
      // Return base64 as fallback
      console.warn('[RemovePerson] Upload failed, returning base64')
      return NextResponse.json({
        success: true,
        backgroundImage: base64Url,
      })
    }
    
    console.log('[RemovePerson] Generated background image')
    
    return NextResponse.json({
      success: true,
      backgroundImage: uploadedUrl,
    })
    
  } catch (error: any) {
    console.error('[RemovePerson] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '去除人物失败'
    }, { status: 500 })
  }
}

