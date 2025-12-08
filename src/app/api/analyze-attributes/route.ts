import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractText } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60 // 1 minute timeout

// 有效的商品类型
const VALID_CATEGORIES = ["内衬", "上衣", "裤子", "帽子", "鞋子"] as const

// VLM 模型
const VLM_MODEL = 'gemini-2.5-flash'

// 将 URL 转换为 base64（服务端版本）
async function urlToBase64(url: string): Promise<string> {
  try {
    const cleanUrl = url.trim()
    console.log('[urlToBase64] Fetching:', cleanUrl.substring(0, 100) + '...')
    const response = await fetch(cleanUrl)
    if (!response.ok) {
      console.error('[urlToBase64] HTTP Error:', response.status, response.statusText)
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error: any) {
    console.error('[urlToBase64] Error:', error.message)
    throw error
  }
}

// 确保图片数据是 base64 格式
async function ensureBase64Data(image: string | null | undefined): Promise<{ data: string; mimeType: string } | null> {
  if (!image) return null
  
  let base64Data: string
  let mimeType: string = 'image/jpeg'
  
  if (image.startsWith('http://') || image.startsWith('https://')) {
    base64Data = await urlToBase64(image)
    if (image.toLowerCase().includes('.png')) {
      mimeType = 'image/png'
    }
  } else if (image.startsWith('data:')) {
    base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    mimeType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
  } else {
    base64Data = image
  }
  
  return { data: base64Data, mimeType }
}

// 分析商品属性的 prompt
const ANALYSIS_PROMPT = `你是一个专业的服装设计师。请识别图中商品的类别（必须是以下之一：内衬、上衣、裤子、帽子、鞋子）。

识别后，请分析其最可能的5种"版型"和5种"材质"特征。

请严格按照 JSON 格式输出，选项按可能性从高到低排列：

{
  "product_category": "上衣",
  "fit_attributes": {
    "shape": ["廓形1", "廓形2", "廓形3", "廓形4", "廓形5"],
    "fit": ["合身度1", "合身度2", "合身度3", "合身度4", "合身度5"],
    "visual_fabric_vibe": ["视觉体感1", "视觉体感2", "视觉体感3", "视觉体感4", "视觉体感5"]
  },
  "material_attributes": {
    "fiber_composition": ["材质1", "材质2", "材质3", "材质4", "材质5"],
    "visual_luster": ["光泽1", "光泽2", "光泽3", "光泽4", "光泽5"],
    "weave_structure": ["工艺1", "工艺2", "工艺3", "工艺4", "工艺5"]
  }
}

注意：
- shape: 整体廓形，如 H型、A型、X型、茧型、直筒、修身 等
- fit: 合身度与松量，如 紧身、合身、宽松、Oversize、修身 等
- visual_fabric_vibe: 视觉体感与面料支撑，如 硬挺、垂坠、蓬松、贴身、有骨架 等
- fiber_composition: 成分/原料，如 纯棉、聚酯纤维、羊毛、真丝、皮革、丹宁 等
- visual_luster: 视觉光泽，如 哑光、丝光、亮面、金属光泽、磨砂 等
- weave_structure: 工艺与结构，如 平纹、斜纹、针织、丹宁、粗花呢、毛呢 等`

export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const body = await request.json()
    const { images } = body // images: string[] - 可以是多张商品图

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少商品图片' },
        { status: 400 }
      )
    }

    const genAI = getGenAIClient()
    const results: any[] = []

    // 逐张分析商品
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      console.log(`[Analyze Attributes] Processing image ${i + 1}/${images.length}`)

      try {
        const imageData = await ensureBase64Data(image)
        if (!imageData) {
          results.push({
            index: i,
            success: false,
            error: '图片格式无效'
          })
          continue
        }

        // 调用 Gemini 模型分析商品
        const response = await genAI.models.generateContent({
          model: VLM_MODEL,
          contents: [
            {
              role: "user",
              parts: [
                { text: ANALYSIS_PROMPT },
                {
                  inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                  }
                }
              ]
            }
          ],
          config: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                product_category: {
                  type: "STRING",
                  enum: [...VALID_CATEGORIES],
                  description: "商品类别"
                },
                fit_attributes: {
                  type: "OBJECT",
                  properties: {
                    shape: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "整体廓形选项"
                    },
                    fit: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "合身度选项"
                    },
                    visual_fabric_vibe: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "视觉体感选项"
                    }
                  },
                  required: ["shape", "fit", "visual_fabric_vibe"]
                },
                material_attributes: {
                  type: "OBJECT",
                  properties: {
                    fiber_composition: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "材质成分选项"
                    },
                    visual_luster: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "视觉光泽选项"
                    },
                    weave_structure: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "工艺结构选项"
                    }
                  },
                  required: ["fiber_composition", "visual_luster", "weave_structure"]
                }
              },
              required: ["product_category", "fit_attributes", "material_attributes"]
            } as any,
            safetySettings,
          }
        })

        const text = extractText(response)
        if (!text) {
          results.push({
            index: i,
            success: false,
            error: '模型无响应'
          })
          continue
        }

        let analysisResult
        try {
          analysisResult = JSON.parse(text)
        } catch (e) {
          console.error('Failed to parse JSON response:', text)
          results.push({
            index: i,
            success: false,
            error: '解析失败'
          })
          continue
        }

        // 验证类别
        if (!VALID_CATEGORIES.includes(analysisResult.product_category)) {
          analysisResult.product_category = "上衣"
        }

        console.log(`[Analyze Attributes] Image ${i + 1} result:`, analysisResult.product_category)

        results.push({
          index: i,
          success: true,
          imageUrl: image,
          data: analysisResult
        })

      } catch (err: any) {
        console.error(`[Analyze Attributes] Image ${i + 1} error:`, err.message)
        results.push({
          index: i,
          success: false,
          error: err.message || '分析失败'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('[Analyze Attributes] Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '分析失败'
      },
      { status: 500 }
    )
  }
}

