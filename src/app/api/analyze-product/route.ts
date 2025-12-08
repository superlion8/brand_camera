import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractText } from '@/lib/genai'

export const maxDuration = 60 // 1 minute timeout

// 有效的商品类型（只返回类型，不需要材质和版型）
const VALID_CATEGORIES = ["内衬", "上衣", "裤子", "帽子", "鞋子"] as const

// VLM 模型 - 使用 gemini-2.5-flash
const VLM_MODEL = 'gemini-2.5-flash'

// 将 URL 转换为 base64（服务端版本，带重试）
async function urlToBase64(url: string, maxRetries = 2): Promise<string> {
  const cleanUrl = url.trim()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[urlToBase64] Attempt ${attempt}/${maxRetries}, Fetching:`, cleanUrl.substring(0, 100) + '...')
      const response = await fetch(cleanUrl, {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        console.error(`[urlToBase64] HTTP Error (attempt ${attempt}):`, response.status, response.statusText, 'URL:', cleanUrl)
        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
        continue
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      console.log('[urlToBase64] Success, base64 length:', buffer.toString('base64').length)
      return buffer.toString('base64')
    } catch (error: any) {
      console.error(`[urlToBase64] Error (attempt ${attempt}):`, error.message, 'URL:', cleanUrl.substring(0, 100))
      if (attempt === maxRetries) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw new Error('Failed to fetch image after all retries')
}

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
    let base64Data: string
    let mimeType: string = 'image/jpeg'
    
    if (image.startsWith('http://') || image.startsWith('https://')) {
      // URL 格式：转换为 base64
      console.log('[Analyze Product] Converting URL to base64:', image.substring(0, 80))
      base64Data = await urlToBase64(image)
      // 根据 URL 扩展名推断 MIME 类型
      if (image.toLowerCase().includes('.png')) {
        mimeType = 'image/png'
      }
    } else if (image.startsWith('data:')) {
      // data URL 格式：提取 base64
      base64Data = image.replace(/^data:image\/\w+;base64,/, '')
      mimeType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    } else {
      // 纯 base64
      base64Data = image
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

