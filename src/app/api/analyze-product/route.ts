import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings } from '@/lib/genai'
import { SchemaType } from '@google/genai'

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

    // 定义 JSON Schema 强制输出格式
    const generationConfig = {
      temperature: 0.2, // 降低随机性，分析任务越低越好
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          material: {
            type: SchemaType.STRING,
            description: "The primary material of the product in Chinese (e.g., 棉, 麻, 丝, 涤纶, 皮革, 羊毛)"
          },
          fit: {
            type: SchemaType.STRING,
            description: "The silhouette or fit of the product in Chinese (e.g., 宽松, 修身, 直筒, 阔腿)"
          },
          type: {
            type: SchemaType.STRING,
            enum: VALID_CATEGORIES as unknown as string[],
            description: "The category of the item, must be one of: 内衬, 上衣, 裤子, 帽子, 鞋子, 配饰"
          }
        },
        required: ["material", "fit", "type"]
      }
    }

    // 调用 Gemini 模型分析商品
    const model = genAI.models.generateContent({
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

请仔细分析图片中最显眼的商品。`
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
        ...generationConfig,
        safetySettings,
      }
    })

    const response = await model

    // 解析 JSON 响应
    const candidate = response.candidates?.[0]
    if (!candidate?.content?.parts?.[0]) {
      throw new Error('No response from model')
    }

    const textPart = candidate.content.parts[0]
    if (!('text' in textPart) || !textPart.text) {
      throw new Error('Invalid response format')
    }

    let analysisResult
    try {
      analysisResult = JSON.parse(textPart.text)
    } catch (e) {
      console.error('Failed to parse JSON response:', textPart.text)
      throw new Error('Failed to parse analysis result')
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

