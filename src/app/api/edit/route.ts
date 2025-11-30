import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { buildModelPrompt, EDIT_PROMPT_PREFIX } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputImage, modelImage, modelStyle, backgroundImage, vibeImage, customPrompt } = body
    
    if (!inputImage) {
      return NextResponse.json({ success: false, error: '缺少输入图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Build prompt
    let prompt = ''
    if (customPrompt) {
      prompt = EDIT_PROMPT_PREFIX + customPrompt
    } else {
      prompt = buildModelPrompt({
        hasModel: !!modelImage,
        modelStyle,
        hasBackground: !!backgroundImage,
        hasVibe: !!vibeImage,
      })
    }
    
    const parts: any[] = []
    
    // Add model reference image first if provided
    if (modelImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(modelImage),
        },
      })
    }
    
    // Add prompt
    parts.push({ text: prompt })
    
    // Add input image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: stripBase64Prefix(inputImage),
      },
    })
    
    // Add background reference
    if (backgroundImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(backgroundImage),
        },
      })
    }
    
    // Add vibe reference
    if (vibeImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(vibeImage),
        },
      })
    }
    
    console.log('Editing image...')
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const resultImage = extractImage(response)
    
    if (!resultImage) {
      return NextResponse.json({ 
        success: false, 
        error: '图片编辑失败，请重试' 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${resultImage}`,
    })
    
  } catch (error: any) {
    console.error('Edit error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '编辑失败' 
    }, { status: 500 })
  }
}

