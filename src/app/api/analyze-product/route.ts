import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractText } from '@/lib/genai'

export const maxDuration = 60 // 1 minute timeout

// 有效的商品类型
const VALID_CATEGORIES = ["内衬", "上衣", "裤子", "帽子", "鞋子", "配饰"] as const

// VLM 模型
const VLM_MODEL = 'gemini-2.0-flash'

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

    // 准备图片数据
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mimeType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'

    const genAI = getGenAIClient()

    // 调用 Gemini 模型分析商品
    const response = await genAI.models.generateContent({
      model: VLM_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `分析这张图片中的主要商品。请识别：
1. 商品类型（type）：必须是以下之一：内衬、上衣、裤子、帽子、鞋子、配饰
2. 主要材质（material）：用中文描述，如棉、麻、丝、涤纶、皮革等
3. 版型（fit）：用中文描述，如宽松、修身、直筒等

请以 JSON 格式返回，格式如下：
{"type": "上衣", "material": "棉", "fit": "宽松"}

只返回 JSON，不要返回其他内容。`
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
        safetySettings,
      }
    })

    // 解析 JSON 响应
    const text = extractText(response)
    if (!text) {
      throw new Error('No response from model')
    }

    // 尝试从响应中提取 JSON
    let analysisResult
    try {
      // 尝试直接解析
      analysisResult = JSON.parse(text)
    } catch (e) {
      // 尝试从 markdown 代码块中提取
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysisResult = JSON.parse(jsonMatch[1] || jsonMatch[0])
        } catch {
          console.error('Failed to parse JSON response:', text)
          throw new Error('Failed to parse analysis result')
        }
      } else {
        console.error('Failed to parse JSON response:', text)
        throw new Error('Failed to parse analysis result')
      }
    }

    // 验证返回的类型是否有效
    if (!VALID_CATEGORIES.includes(analysisResult.type)) {
      console.warn('Invalid category returned:', analysisResult.type)
      // 如果返回了无效类型，尝试映射到最接近的
      analysisResult.type = "上衣" // 默认为上衣
    }

    console.log('[Analyze Product] Result:', analysisResult)

    return NextResponse.json({
      success: true,
      data: {
        type: analysisResult.type,
        material: analysisResult.material || '未知',
        fit: analysisResult.fit || '标准'
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

