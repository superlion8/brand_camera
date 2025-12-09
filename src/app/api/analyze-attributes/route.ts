import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, safetySettings, extractText } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60 // 1 minute timeout

// VLM 模型
const VLM_MODEL = 'gemini-2.5-flash'

// 多语言商品类型
const CATEGORIES_BY_LANG = {
  zh: ["内衬", "上衣", "裤子", "裙子", "帽子", "鞋子"],
  en: ["Innerwear", "Top", "Pants", "Skirt", "Hat", "Shoes"],
  ko: ["이너웨어", "상의", "바지", "스커트", "모자", "신발"]
} as const

type SupportedLang = 'zh' | 'en' | 'ko'

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

// 多语言 prompt
const getAnalysisPrompt = (lang: SupportedLang) => {
  const categories = CATEGORIES_BY_LANG[lang].join(', ')
  
  if (lang === 'en') {
    return `You are a professional fashion designer. Please identify the product category in the image (must be one of: ${categories}).

After identifying, analyze the 5 most likely "fit" and 5 most likely "material" characteristics.

Please output strictly in JSON format, options sorted by likelihood from highest to lowest:

{
  "product_category": "Top",
  "fit_attributes": {
    "shape": ["Silhouette1", "Silhouette2", "Silhouette3", "Silhouette4", "Silhouette5"],
    "fit": ["Fit1", "Fit2", "Fit3", "Fit4", "Fit5"],
    "visual_fabric_vibe": ["Vibe1", "Vibe2", "Vibe3", "Vibe4", "Vibe5"]
  },
  "material_attributes": {
    "fiber_composition": ["Material1", "Material2", "Material3", "Material4", "Material5"],
    "visual_luster": ["Luster1", "Luster2", "Luster3", "Luster4", "Luster5"],
    "weave_structure": ["Weave1", "Weave2", "Weave3", "Weave4", "Weave5"]
  }
}

Notes:
- shape: Overall silhouette, e.g. H-line, A-line, X-line, Cocoon, Straight, Slim, Relaxed, Boxy
- fit: Fit and ease, e.g. Tight, Fitted, Loose, Oversized, Slim fit, Regular fit
- visual_fabric_vibe: Visual feel and fabric structure, e.g. Crisp, Draping, Fluffy, Body-hugging, Structured
- fiber_composition: Fiber/material, e.g. Cotton, Polyester, Wool, Silk, Leather, Denim, Linen
- visual_luster: Visual sheen, e.g. Matte, Silky, Glossy, Metallic, Satin, Brushed
- weave_structure: Construction/weave, e.g. Plain weave, Twill, Knit, Denim, Tweed, Fleece`
  }
  
  if (lang === 'ko') {
    return `당신은 전문 패션 디자이너입니다. 이미지에서 상품 카테고리를 식별해주세요 (다음 중 하나여야 합니다: ${categories}).

식별 후, 가장 가능성 있는 5가지 "핏"과 5가지 "소재" 특성을 분석해주세요.

가능성이 높은 순서대로 정렬하여 JSON 형식으로 출력해주세요:

{
  "product_category": "상의",
  "fit_attributes": {
    "shape": ["실루엣1", "실루엣2", "실루엣3", "실루엣4", "실루엣5"],
    "fit": ["핏1", "핏2", "핏3", "핏4", "핏5"],
    "visual_fabric_vibe": ["느낌1", "느낌2", "느낌3", "느낌4", "느낌5"]
  },
  "material_attributes": {
    "fiber_composition": ["소재1", "소재2", "소재3", "소재4", "소재5"],
    "visual_luster": ["광택1", "광택2", "광택3", "광택4", "광택5"],
    "weave_structure": ["조직1", "조직2", "조직3", "조직4", "조직5"]
  }
}

참고:
- shape: 전체 실루엣, 예: H라인, A라인, X라인, 코쿤, 스트레이트, 슬림, 릴렉스드, 박시
- fit: 핏과 여유, 예: 타이트, 피티드, 루즈, 오버사이즈, 슬림핏, 레귤러핏
- visual_fabric_vibe: 시각적 느낌과 원단 구조, 예: 뻣뻣한, 드레이프, 푹신한, 밀착, 구조감 있는
- fiber_composition: 섬유/소재, 예: 면, 폴리에스터, 울, 실크, 가죽, 데님, 린넨
- visual_luster: 시각적 광택, 예: 무광, 실키, 유광, 메탈릭, 새틴, 브러시드
- weave_structure: 구조/조직, 예: 평직, 능직, 니트, 데님, 트위드, 플리스`
  }
  
  // Default: Chinese
  return `你是一个专业的服装设计师。请识别图中商品的类别（必须是以下之一：${categories}）。

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
}

export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const body = await request.json()
    const { images, language = 'zh' } = body // images: string[], language: 'zh' | 'en' | 'ko'

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少商品图片' },
        { status: 400 }
      )
    }

    // 确定语言
    const lang: SupportedLang = ['zh', 'en', 'ko'].includes(language) ? language : 'zh'
    const validCategories = CATEGORIES_BY_LANG[lang]
    const analysisPrompt = getAnalysisPrompt(lang)

    const genAI = getGenAIClient()
    const results: any[] = []

    // 逐张分析商品
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      console.log(`[Analyze Attributes] Processing image ${i + 1}/${images.length}, lang: ${lang}`)

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
                { text: analysisPrompt },
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
                  enum: [...validCategories],
                  description: "Product category"
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
        if (!validCategories.includes(analysisResult.product_category)) {
          analysisResult.product_category = validCategories[1] // Default to "Top"/"上衣"/"상의"
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

