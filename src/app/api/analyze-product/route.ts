import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractText } from '@/lib/genai'
import { imageToBase64 } from '@/lib/presets/serverPresets'

export const maxDuration = 60 // 1 minute timeout

// 有效的商品类型（只返回类型，不需要材质和版型）
const VALID_CATEGORIES = ["内衬", "上衣", "裤子", "帽子", "鞋子"] as const

// VLM 模型 - 使用 gemini-2.5-flash
const VLM_MODEL = 'gemini-2.5-flash'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Missing image' },
        { status: 400 }
      )
    }

    // 准备图片数据 - 支持 URL 和 base64 格式
    let mimeType: string = 'image/jpeg'
    
    // 使用共享的 imageToBase64 函数处理
    const base64Data = await imageToBase64(image)
    
    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format' },
        { status: 400 }
      )
    }
    
    // 根据原始格式推断 MIME 类型
    if (image.toLowerCase().includes('.png') || image.startsWith('data:image/png')) {
      mimeType = 'image/png'
    }

    const genAI = getGenAIClient()

    // 调用 Gemini 模型分析商品 - 使用 JSON schema
    const response = await genAI.models.generateContent({
      model: VLM_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Analyze the main product in this image."
            },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              enum: [...VALID_CATEGORIES],
              description: "The category of the item"
            }
          },
          required: ["type"]
        } as any,
        safetySettings,
      }
    })

    // 解析 JSON 响应（使用 JSON schema，直接解析即可）
    const text = extractText(response)
    if (!text) {
      throw new Error('No response from model')
    }

    let analysisResult
    try {
      analysisResult = JSON.parse(text)
    } catch (e) {
      console.error('Failed to parse JSON response:', text)
      throw new Error('Failed to parse analysis result')
    }

    // 验证返回的类型是否有效
    if (!VALID_CATEGORIES.includes(analysisResult.type)) {
      console.warn('Invalid category returned:', analysisResult.type)
      analysisResult.type = "上衣" // 默认为上衣
    }

    console.log('[Analyze Product] Result:', analysisResult)

    return NextResponse.json({
      success: true,
      data: {
        type: analysisResult.type
      }
    })

  } catch (error: any) {
    console.error('[Analyze Product] Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Analysis failed'
      },
      { status: 500 }
    )
  }
}

