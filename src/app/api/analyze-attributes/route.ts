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

// 多语言 prompt - V2 新版本
const getAnalysisPrompt = (lang: SupportedLang) => {
  const categories = CATEGORIES_BY_LANG[lang].join(', ')
  
  if (lang === 'en') {
    return `You are a professional fashion designer. Please identify the product category in the image (must be one of: ${categories}).

After identifying, analyze the 4 most likely "fit dimension" and 4 most likely "fabric dimension" characteristic options.

Special note: When analyzing fabric, first determine if it belongs to major categories like 'Knit', 'Woven', or 'Denim', then analyze its specific surface texture.

Please output strictly in JSON format, with options sorted by likelihood in descending order (most likely first):

{
  "product_category": "Top",
  "fit_attributes": {
    "silhouette": ["H-line", "A-line", "Cocoon", "Fitted waist", "Asymmetric"],
    "fit_tightness": ["Tight", "Slim", "Fitted", "Loose", "Oversized"],
    "length": ["Cropped", "Regular", "Midi", "Maxi", "Knee-length"],
    "waist_line": ["High-waist", "Mid-rise", "Low-rise", "No waistline", "Elastic waist"]
  },
  "material_attributes": {
    "material_category": ["Knit/Wool", "Woven/Cotton-Linen", "Denim", "Leather/Faux", "Silk/Satin", "Sheer/Lace"],
    "stiffness_drape": ["Crisp structured", "Medium", "Soft draping", "Stiff", "Fluid"],
    "surface_texture": ["Smooth", "Ribbed", "Fuzzy/Brushed", "Tweed texture", "Textured", "Cable knit"],
    "visual_luster": ["Matte", "Soft sheen", "Silk shine", "Leather sheen", "Metallic"]
  }
}

Notes:
- silhouette: Overall shape - H-line, A-line, X-line, Cocoon, Fitted waist, Boxy, Asymmetric
- fit_tightness: Fit level - Tight, Slim, Fitted, Regular, Loose, Oversized
- length: Garment length - Cropped, Regular, Midi, Maxi, Knee-length, Ankle-length
- waist_line: Waist position (for pants/skirts) - High-waist, Mid-rise, Low-rise, No waistline, Elastic waist
- material_category: Main fabric type - Knit/Wool, Woven/Cotton-Linen, Denim, Leather/Faux, Silk/Satin, Sheer/Lace
- stiffness_drape: Fabric stiffness - Crisp structured, Medium, Soft draping, Stiff, Fluid
- surface_texture: Surface pattern - Smooth, Ribbed, Fuzzy/Brushed, Tweed texture, Textured, Cable knit
- visual_luster: Sheen level - Matte, Soft sheen, Silk shine, Leather sheen, Metallic`
  }
  
  if (lang === 'ko') {
    return `당신은 전문 패션 디자이너입니다. 이미지에서 상품 카테고리를 식별해주세요 (다음 중 하나여야 합니다: ${categories}).

식별 후, 가장 가능성 있는 4가지 "핏 차원"과 4가지 "소재 차원"의 특성 옵션을 분석해주세요.

특별 참고: 소재 분석 시, 먼저 '니트', '직물', '데님' 등의 대분류를 판단한 후 구체적인 표면 질감을 분석해주세요.

가능성이 높은 순서대로 정렬하여 JSON 형식으로 출력해주세요 (가장 가능성 높은 것이 첫 번째):

{
  "product_category": "상의",
  "fit_attributes": {
    "silhouette": ["H라인", "A라인", "코쿤", "피티드웨이스트", "비대칭"],
    "fit_tightness": ["타이트", "슬림", "피티드", "루즈", "오버사이즈"],
    "length": ["크롭", "레귤러", "미디", "맥시", "니렝스"],
    "waist_line": ["하이웨이스트", "미드라이즈", "로우라이즈", "노웨이스트라인", "밴딩"]
  },
  "material_attributes": {
    "material_category": ["니트/울", "직물/면마", "데님", "가죽/인조가죽", "실크/새틴", "시스루/레이스"],
    "stiffness_drape": ["뻣뻣한", "보통", "부드러운드레이프", "딱딱한", "흐르는"],
    "surface_texture": ["매끄러운", "골지", "기모/브러시드", "트위드", "텍스처", "케이블니트"],
    "visual_luster": ["무광", "은은한광택", "실크광택", "가죽광택", "메탈릭"]
  }
}

참고:
- silhouette: 전체 실루엣 - H라인, A라인, X라인, 코쿤, 피티드웨이스트, 박시, 비대칭
- fit_tightness: 핏 정도 - 타이트, 슬림, 피티드, 레귤러, 루즈, 오버사이즈
- length: 기장 - 크롭, 레귤러, 미디, 맥시, 니렝스, 발목길이
- waist_line: 허리선 위치 (바지/스커트) - 하이웨이스트, 미드라이즈, 로우라이즈, 노웨이스트라인, 밴딩
- material_category: 소재 대분류 - 니트/울, 직물/면마, 데님, 가죽/인조가죽, 실크/새틴, 시스루/레이스
- stiffness_drape: 소재 경도 - 뻣뻣한, 보통, 부드러운드레이프, 딱딱한, 흐르는
- surface_texture: 표면 질감 - 매끄러운, 골지, 기모/브러시드, 트위드, 텍스처, 케이블니트
- visual_luster: 광택 정도 - 무광, 은은한광택, 실크광택, 가죽광택, 메탈릭`
  }
  
  // Default: Chinese
  return `你是一个专业的服装设计师。请识别图中商品的类别（必须是以下之一：${categories}）。

识别后，请分析其最可能的 4个"版型维度" 和 4个"面料维度" 的特征选项。

特别注意：在分析面料时，请优先判断其属于"针织"、"梭织"还是"牛仔"等大类，再分析其具体的表面肌理。

请严格按照以下 JSON 格式输出，数组中的选项按可能性倒序排列（最可能的排在第一位）：

{
  "product_category": "上衣",
  "fit_attributes": {
    "silhouette": ["H型", "A型", "茧型", "收腰型", "不规则"],
    "fit_tightness": ["紧身", "修身", "合身", "宽松", "Oversize"],
    "length": ["超短/露腰", "常规长度", "中长款", "加长/拖地", "及膝"],
    "waist_line": ["高腰", "中腰", "低腰", "无腰线", "松紧腰"]
  },
  "material_attributes": {
    "material_category": ["针织/毛织", "梭织/棉麻", "牛仔", "皮革/仿皮", "丝绸/缎面", "薄纱/蕾丝"],
    "stiffness_drape": ["挺括有型", "适中", "柔软垂坠", "硬朗", "流动感强"],
    "surface_texture": ["平滑无痕", "竖条纹/坑条", "毛绒/磨毛", "粗花呢肌理", "凹凸纹理", "绞花/粗棒针"],
    "visual_luster": ["完全哑光", "柔和光泽", "丝绸亮面", "皮革光泽", "金属光泽"]
  }
}

注意：
- silhouette: 整体廓形 - H型、A型、X型、茧型、收腰型、直筒、不规则
- fit_tightness: 松紧度 - 紧身、修身、合身、常规、宽松、Oversize
- length: 服装长度 - 超短/露腰、常规长度、中长款、加长/拖地、及膝、及踝
- waist_line: 腰线位置(裤子/裙子) - 高腰、中腰、低腰、无腰线、松紧腰
- material_category: 面料大类 - 针织/毛织、梭织/棉麻、牛仔、皮革/仿皮、丝绸/缎面、薄纱/蕾丝
- stiffness_drape: 软硬度 - 挺括有型、适中、柔软垂坠、硬朗、流动感强
- surface_texture: 表面肌理 - 平滑无痕、竖条纹/坑条、毛绒/磨毛、粗花呢肌理、凹凸纹理、绞花/粗棒针
- visual_luster: 光泽度 - 完全哑光、柔和光泽、丝绸亮面、皮革光泽、金属光泽`
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
                    silhouette: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Silhouette options"
                    },
                    fit_tightness: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Fit tightness options"
                    },
                    length: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Length options"
                    },
                    waist_line: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Waist line options"
                    }
                  },
                  required: ["silhouette", "fit_tightness", "length", "waist_line"]
                },
                material_attributes: {
                  type: "OBJECT",
                  properties: {
                    material_category: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Material category options"
                    },
                    stiffness_drape: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Stiffness/drape options"
                    },
                    surface_texture: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Surface texture options"
                    },
                    visual_luster: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Visual luster options"
                    }
                  },
                  required: ["material_category", "stiffness_drape", "surface_texture", "visual_luster"]
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
