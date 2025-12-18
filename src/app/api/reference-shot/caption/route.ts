import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60

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
  
  try {
    const body = await request.json()
    const { referenceImage } = body
    
    if (!referenceImage) {
      return NextResponse.json({ success: false, error: '缺少参考图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    const prompt = `用英文反推下这张图片的提示词，包含环境、氛围、光影、场景信息、色调的描述，镜头和构图的描述，人物姿势、穿着、神态的描述。请不要描述身材、长相、发型等和人物外貌相关的信息。请直接输出英文反推词。`
    
    const imageData = await ensureBase64Data(referenceImage)
    
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
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
        safetySettings,
      },
    })
    
    const captionPrompt = extractText(response)
    
    if (!captionPrompt) {
      return NextResponse.json({ success: false, error: 'AI 分析失败' }, { status: 500 })
    }
    
    console.log('[Caption] Generated caption:', captionPrompt.substring(0, 100) + '...')
    
    return NextResponse.json({
      success: true,
      captionPrompt,
    })
    
  } catch (error: any) {
    console.error('[Caption] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '反推提示词失败'
    }, { status: 500 })
  }
}

