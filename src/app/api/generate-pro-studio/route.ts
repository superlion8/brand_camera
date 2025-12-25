import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { imageToBase64, getPresetByName, getRandomPresetBase64 } from '@/lib/presets/serverPresets'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300 // 5 minutes

// ============================================
// 模型配置
// ============================================
const FLASH_MODEL = 'gemini-3-flash-preview'      // 分析、outfit、shot_instruct
const IMAGE_MODEL = 'gemini-3-pro-image-preview'  // 图像生成

// Storage URL
const ALL_MODELS_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'
const PRO_STUDIO_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/pro_studio'

// ============================================
// Prompts
// ============================================

// 步骤1: 服装风格分析 + 智能选择4个模特/4个背景
const MATCH_PROMPT = `1. 请分析商品{{product_img}}的材质、版型、色彩和风格
2. 在 model_analysis表中选择出4个合适的 model_id，按优先级：
  1. 气质匹配：模特整体气质/风格(model_style_all字段)与商品{{product_img}}相符
  2. 性别和年龄品牌：商品的性别和年龄属性与模特相匹配
  3. 身材/比例适配：模特身形与商品版型更合适（oversized 更适合骨架感/衣架感；修身更适合线条利落；高腰阔腿更适合比例好）
3. 读取pro_studio_scene_tag表中所有场景的标签，进行商品和场景的匹配度打分，选出4个合适的 scene_id，按优先级：
  1. 风格匹配：优先选择 style_all 覆盖商品风格的背景；例如商品风格为 Y2K，则筛选 style_all 中包含 Y2K 的背景场景。
    1. 兜底规则：若 style_all 为空或命中数量过少，可放宽为 style = Unknown/Minimal/Casual 等更通用风格进入候选，但整体降权，作为备选。
  2. 色系匹配：在风格匹配的候选背景中，选择与商品色系协调且突出主体的背景——优先保证明度/对比度足够让服饰轮廓清晰，并避免背景色偏或反光对肤色与浅色服饰造成染色，从而呈现更"高级"的整体观感。
    - 明度优先规则：
      - 浅色服饰（白/奶油/浅灰/浅粉等）→ 背景优先 中/深明度；
      - 深色服饰（黑/藏蓝/深棕等）→ 背景优先 浅明度；
      - 中间调服饰 → 避免选择与服饰 同明度档 的背景。
    - 背景复杂度规则（color_variation）：电商模特棚拍默认优先 low（干净、统一、少抢戏）；只有在服饰本身为纯色/极简时，才允许 medium 作为次选，high 一般降权。
    - 光线一致性规则（shadow_strength）：主图导向优先 none/light（更稳定、更易统一店铺质感）；medium/strong 更偏 lookbook/editorial，除非你明确要这种风格，否则降权。
    - 冲突惩罚规则：若服饰与背景"同明度"同时背景 color_variation 又是 medium/high，属于高风险组合（轮廓不清、主体不突出），应显著降分或直接剔除
请严格按照以下 JSON 格式输出结果，不要包含 markdown 标记（如 \`\`\`json），也不要输出任何解释性文字：
{
"product_style":"Y2K | Casual | Business | Girly | Retro | High-Fashion | Streetwear | Minimal | Sporty | Workwear | Preppy | AvantGarde | Boho | Unknown",
"model_id1":"选择的模特id 1",
"model_id2":"选择的模特id 2",
"model_id3":"选择的模特id 3",
"model_id4":"选择的模特id 4",
"scene_id1":"选择的场景id 1",
"scene_id2":"选择的场景id 2",
"scene_id3":"选择的场景id 3",
"scene_id4":"选择的场景id 4"
}`

// 步骤2: 生成服装搭配
const OUTFIT_PROMPT = `# Role
你是由《Vogue》和《GQ》特聘的资深时尚造型总监。你的任务是基于核心单品，为电商拍摄设计一套极具高级感、符合当下流行趋势的服装搭配（Look）。

# Inputs
- 核心单品：[商品图]
- 模特特征: [模特图]
- 拍摄环境: [场景图]
- 服装风格：{{product_style}}

# Styling Logic (Think step-by-step)
1. 分析核心单品: 识别商品图的主色调、材质（如丹宁、丝绸、皮革）和版型。
2. 环境融合: 搭配的色系必须与场景图形成和谐（同色系高级感）或 撞色（视觉冲击）的关系。
3. 材质互补: 如果核心单品是哑光，搭配光泽感配饰；如果是重工面料，搭配简约基础款。
4. 主次分明: 所有搭配单品（上装/下装/鞋/配饰）都是为了烘托核心单品，严禁在色彩或设计上喧宾夺主。

# Task
基于上述要求，生成一段新的详细的搭配描述，要包含上装、下装、配饰和风格氛围的描述。

# Constraints & Formatting
请不要输出任何推理过程，直接输出一段连贯的、侧重于视觉描述的文本。
描述必须包含以下细节：
1. 具体款式与剪裁 (如: 宽松落肩西装、高腰直筒裤、法式方领衬衫)。
2. 精确的面料与质感 (如: 粗棒针织、光面漆皮、做旧水洗牛仔、垂坠感醋酸)。
3. 准确的色彩术语 (如: 莫兰迪灰、克莱因蓝、大地色系、荧光绿)。
4. 配饰细节 (可选，如: 极简金属耳环、复古墨镜、腋下包)

示例风格（仅供参考）：
'模特身穿[核心单品]，搭配一条米白色高腰羊毛阔腿裤，面料呈现细腻的绒感。外搭一件深驼色大廓形风衣，敞开穿着以露出核心单品。脚踩一双方头切尔西靴，皮革光泽感强。佩戴金色粗链条项链，整体呈现出一种慵懒而高级的风格，色调与背景的暖光完美呼应。'

现在，请开始为商品进行搭配设计：`

// 步骤3: 生成拍摄指令
const SHOT_INSTRUCT_PROMPT = `你现在是一个专门拍摄电商商品棚拍图的职业摄影师，请你基于你要拍摄的商品[商品图]，和展示这个商品的模特[模特图]，为这个模特选择一身合适商品风格的服装造型搭配，搭配要和谐、有风格、有高级感；
再为这个模特和这身装扮选择一个合适的影棚拍摄背景和拍摄pose，输出1段拍摄指令。
拍摄背景不要出现打光灯等拍摄设施，按成片图的标准来塑造。
服装风格参考：{{product_style}}
请你严格用英文按照下面这个格式来写，不需要输出其他额外的东西：
{
"background":"",
"model_pose":"",
"composition":"",
"camera_setting":""
}`

// 步骤4: 最终图像生成
const FINAL_PROMPT = `[Role: Professional Commercial Photographer]
[Task: High-Fidelity Fashion Photography]

Reference Sources (Strict Adherence)
1. THE PRODUCT: [商品图]
  - ACTION: Reconstruct this exact garment.
  - PRIORITY: MAXIMUM. The logo, text, neckline, and pattern MUST be identical to the reference.
2. THE MODEL: [模特图]
  - ACTION: Use the exact facial features, skin tone, and body shape of this specific model. The model MUST look identical.
  - CONSTRAINT: Ignore original clothes in model reference.
3. THE SCENE: [场景图] 
  - ACTION: Use this exact environment.
    
Styling Instructions
{{outfit_instruct}}

Camera & Shot Settings
{{shot_instruct}}

Additional Settings:
- Lighting: Professional studio lighting blended with the environment's natural light sources. Soft shadows, commercial aesthetics.
- Quality: 8k resolution, raw photo, realistic skin texture, realistic fabric physics (wrinkles, drape).
  
Negative Prompt
- illustration, painting, cartoon, 3d render, deformed hands, missing limbs, bad face, blurry product, changing brand logo, extra text, messy background.`

// ============================================
// 辅助函数
// ============================================

/**
 * 获取模特图片（从 all_models 文件夹）
 */
async function getModelImage(modelId: string): Promise<{ base64: string; url: string } | null> {
  // 尝试 .png 和 .jpg
  for (const ext of ['.png', '.jpg']) {
    const url = `${ALL_MODELS_URL}/${modelId}${ext}`
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        const imgResponse = await fetch(url)
        const buffer = await imgResponse.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return { base64, url }
      }
    } catch (e) {
      continue
    }
  }
  console.error(`[ProStudio] Model image not found: ${modelId}`)
  return null
}

/**
 * 获取场景图片（从 pro_studio 文件夹）
 */
async function getSceneImage(sceneId: string): Promise<{ base64: string; url: string } | null> {
  // sceneId 格式如 "background01"，文件名为 "background01.jpg"
  const url = `${PRO_STUDIO_URL}/${sceneId}.jpg`
  try {
    const response = await fetch(url)
    if (response.ok) {
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return { base64, url }
    }
  } catch (e) {
    console.error(`[ProStudio] Scene image fetch error:`, e)
  }
  console.error(`[ProStudio] Scene image not found: ${sceneId}`)
  return null
}

/**
 * 步骤1: 服装风格分析 + 智能选择4个模特/4个背景
 */
async function analyzeAndSelect(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  needModel: boolean,
  needScene: boolean
): Promise<{
  modelIds: string[];
  sceneIds: string[];
  productStyle: string;
}> {
  try {
    // 获取数据库数据
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[ProStudio] Missing Supabase credentials')
      return { modelIds: [], sceneIds: [], productStyle: 'Unknown' }
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 并行获取模特和场景数据
    const [modelsResult, scenesResult] = await Promise.all([
      needModel ? supabase
        .from('models_analysis')
        .select('model_id, model_gender, model_age_group, model_style_primary, model_style_all, body_shape, height_range, model_desc')
        : Promise.resolve({ data: null, error: null }),
      needScene ? supabase
        .from('pro_studio_scene_tag')
        .select('background_id, space_scale, color_family, lightness_level, color_variation, lighting_type, shadow_strength')
        : Promise.resolve({ data: null, error: null }),
    ])
    
    // 构建 prompt
    let promptParts: string[] = [MATCH_PROMPT]
    
    if (needModel && modelsResult.data) {
      const modelDatabase = modelsResult.data.map((m: any) => ({
        model_id: m.model_id,
        gender: m.model_gender,
        age_group: m.model_age_group,
        style: m.model_style_primary,
        style_all: m.model_style_all,
        body_shape: m.body_shape,
        height: m.height_range,
        desc: m.model_desc?.substring(0, 100) + '...'
      }))
      promptParts.push(`\n\nmodel_analysis表数据：\n${JSON.stringify(modelDatabase, null, 2)}`)
    } else if (!needModel) {
      promptParts.push(`\n\n注意：用户已选择模特，不需要选择 model_id，请在输出中将所有 model_id1-4 设为 null`)
    }
    
    if (needScene && scenesResult.data) {
      const sceneDatabase = scenesResult.data.map((s: any) => ({
        background_id: s.background_id,
        space_scale: s.space_scale,
        color_family: s.color_family,
        lightness_level: s.lightness_level,
        color_variation: s.color_variation,
        lighting_type: s.lighting_type,
        shadow_strength: s.shadow_strength,
      }))
      promptParts.push(`\n\npro_studio_scene_tag表数据：\n${JSON.stringify(sceneDatabase, null, 2)}`)
    } else if (!needScene) {
      promptParts.push(`\n\n注意：用户已选择场景，不需要选择 scene_id，请在输出中将所有 scene_id1-4 设为 null`)
    }
    
    const fullPrompt = promptParts.join('')
    
    console.log('[ProStudio] Analyzing product and selecting 4 models/scenes...')
    console.log(`[ProStudio] needModel: ${needModel}, needScene: ${needScene}`)
    
    const response = await client.models.generateContent({
      model: FLASH_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: fullPrompt },
          { text: '\n\n[商品图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: productData } },
        ],
      }],
      config: { safetySettings },
    })
    
    const textResult = extractText(response)
    if (!textResult) {
      console.error('[ProStudio] No text result from analysis')
      return { modelIds: [], sceneIds: [], productStyle: 'Unknown' }
    }
    
    console.log('[ProStudio] Analysis result:', textResult.substring(0, 500))
    
    // 解析 JSON 结果
    const jsonMatch = textResult.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[ProStudio] Failed to parse JSON from result')
      return { modelIds: [], sceneIds: [], productStyle: 'Unknown' }
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // 提取4个模特ID和4个场景ID
    const modelIds: string[] = []
    const sceneIds: string[] = []
    
    if (needModel) {
      for (let i = 1; i <= 4; i++) {
        const id = parsed[`model_id${i}`]
        if (id && id !== 'null') modelIds.push(id)
      }
    }
    
    if (needScene) {
      for (let i = 1; i <= 4; i++) {
        const id = parsed[`scene_id${i}`]
        if (id && id !== 'null') sceneIds.push(id)
      }
    }
    
    return {
      modelIds,
      sceneIds,
      productStyle: parsed.product_style || 'Unknown',
    }
  } catch (e) {
    console.error('[ProStudio] Analysis error:', e)
    return { modelIds: [], sceneIds: [], productStyle: 'Unknown' }
  }
}

/**
 * 步骤2: 生成服装搭配指令
 */
async function generateOutfitInstruct(
  client: ReturnType<typeof getGenAIClient>,
  productDataList: string[],
  modelData: string,
  sceneData: string,
  productStyle: string
): Promise<string | null> {
  try {
    const prompt = OUTFIT_PROMPT.replace('{{product_style}}', productStyle)
    
    console.log(`[ProStudio] Generating outfit instructions with ${productDataList.length} products...`)
    
    // 构建 parts，支持多件商品图片
    const parts: any[] = [{ text: prompt }]
    
    // 添加所有商品图片
    productDataList.forEach((productData, index) => {
      parts.push({ text: `\n\n[商品图${index + 1}]:` })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productData } })
    })
    
    // 添加模特和场景
    parts.push({ text: '\n\n[模特图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelData } })
    parts.push({ text: '\n\n[场景图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: sceneData } })
    
    const response = await client.models.generateContent({
      model: FLASH_MODEL,
      contents: [{ role: 'user', parts }],
      config: { safetySettings },
    })
    
    const result = extractText(response)
    if (result) {
      console.log('[ProStudio] Outfit instructions:', result.substring(0, 150) + '...')
    }
    return result
  } catch (e) {
    console.error('[ProStudio] Failed to generate outfit instructions:', e)
    return null
  }
}

/**
 * 步骤3: 生成拍摄指令
 */
async function generateShotInstruct(
  client: ReturnType<typeof getGenAIClient>,
  productDataList: string[],
  modelData: string,
  sceneData: string,
  productStyle: string
): Promise<string | null> {
  try {
    const prompt = SHOT_INSTRUCT_PROMPT.replace('{{product_style}}', productStyle)
    
    console.log(`[ProStudio] Generating shot instructions...`)
    
    // 构建 parts
    const parts: any[] = [{ text: prompt }]
    
    // 添加所有商品图片
    productDataList.forEach((productData, index) => {
      parts.push({ text: `\n\n[商品图${index + 1}]:` })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productData } })
    })
    
    // 添加模特和场景
    parts.push({ text: '\n\n[模特图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelData } })
    parts.push({ text: '\n\n[场景图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: sceneData } })
    
    const response = await client.models.generateContent({
      model: FLASH_MODEL,
      contents: [{ role: 'user', parts }],
      config: { safetySettings },
    })
    
    const result = extractText(response)
    if (result) {
      console.log('[ProStudio] Shot instructions:', result.substring(0, 150) + '...')
    }
    return result
  } catch (e) {
    console.error('[ProStudio] Failed to generate shot instructions:', e)
    return null
  }
}

/**
 * 步骤4: 生成单张图片
 */
async function generateImage(
  client: ReturnType<typeof getGenAIClient>,
  productDataList: string[],
  modelData: string,
  sceneData: string,
  outfitInstruct: string,
  shotInstruct: string,
  label: string
): Promise<string | null> {
  try {
    const prompt = FINAL_PROMPT
      .replace('{{outfit_instruct}}', outfitInstruct)
      .replace('{{shot_instruct}}', shotInstruct)
    
    console.log(`[${label}] Generating image with ${productDataList.length} products...`)
    
    // 构建 parts，支持多件商品图片
    const parts: any[] = [{ text: prompt }]
    
    // 添加所有商品图片
    productDataList.forEach((productData, index) => {
      parts.push({ text: `\n\n[商品图${index + 1}]:` })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productData } })
    })
    
    // 添加模特和场景
    parts.push({ text: '\n\n[模特图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelData } })
    parts.push({ text: '\n\n[场景图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: sceneData } })
    
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    if (result) {
      console.log(`[${label}] Image generated successfully`)
    }
    return result
  } catch (e) {
    console.error(`[${label}] Image generation failed:`, e)
    return null
  }
}

// ============================================
// 主 API Handler
// ============================================

export async function POST(request: NextRequest) {
  // 认证检查
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const body = await request.json()
    const {
      productImage,      // 单商品模式
      productImages,     // 多商品模式（数组格式）
      outfitItems,       // 多商品模式（outfit 格式：{ top?, pants?, inner?, hat?, shoes? }）
      modelImage,        // 用户选择的模特图（可选）
      backgroundImage,   // 用户选择的背景图（可选）
      taskId,
    } = body

    // 支持两种模式：单商品 (productImage) 和多商品 (productImages/outfitItems)
    const getOutfitItemUrl = (item: any): string | undefined => {
      if (!item) return undefined
      if (typeof item === 'string') return item
      return item.imageUrl
    }
    
    // 获取主商品图片（用于 AI 分析）
    const mainProductImage = productImage 
      || (productImages && (productImages as any[])[0]?.imageUrl)
      || (outfitItems && getOutfitItemUrl(Object.values(outfitItems)[0]))
    
    // 获取所有商品图片 URL（用于保存记录）
    const allProductImageUrls: string[] = productImage 
      ? [productImage]
      : productImages 
        ? (productImages as any[]).map((p: any) => typeof p === 'string' ? p : p.imageUrl).filter(Boolean)
        : outfitItems 
          ? (Object.values(outfitItems) as any[]).map((p: any) => getOutfitItemUrl(p)).filter(Boolean) as string[]
          : []

    if (!mainProductImage) {
      return new Response(JSON.stringify({ success: false, error: '缺少商品图片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!taskId) {
      return new Response(JSON.stringify({ success: false, error: '缺少任务ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[ProStudio] Request params:', {
      hasProductImage: !!productImage,
      hasProductImages: !!productImages,
      hasOutfitItems: !!outfitItems,
      mainProductImage: mainProductImage?.substring(0, 50) + '...',
      allProductCount: allProductImageUrls.length,
      taskId,
    })

    const client = getGenAIClient()
    
    // 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // 1. 处理所有商品图片
          sendEvent({ type: 'progress', step: 'product', message: '处理商品图片...' })
          
          // 收集所有需要处理的商品图片 URL
          const productUrls: string[] = []
          if (outfitItems) {
            const slots = ['inner', 'top', 'pants', 'hat', 'shoes'] as const
            for (const slot of slots) {
              const item = outfitItems[slot]
              const url = getOutfitItemUrl(item)
              if (url) productUrls.push(url)
            }
          } else if (productImages && Array.isArray(productImages)) {
            for (const p of productImages) {
              const url = typeof p === 'string' ? p : p?.imageUrl
              if (url) productUrls.push(url)
            }
          } else if (mainProductImage) {
            productUrls.push(mainProductImage)
          }
          
          console.log(`[ProStudio] Processing ${productUrls.length} product images...`)
          
          // 转换所有商品图片为 base64
          const productDataList: string[] = []
          for (const url of productUrls) {
            const data = await imageToBase64(url)
            if (data) {
              productDataList.push(data)
            } else {
              console.warn(`[ProStudio] Failed to convert product image: ${url.substring(0, 50)}...`)
            }
          }
          
          if (productDataList.length === 0) {
            sendEvent({ type: 'error', error: '商品图片处理失败' })
            controller.close()
            return
          }
          
          console.log(`[ProStudio] Successfully converted ${productDataList.length} product images to base64`)

          // 2. 判断是否需要 AI 分析选择模特/背景
          const mainProductData = productDataList[0]
          const needModel = !modelImage || modelImage === 'random'
          const needScene = !backgroundImage || backgroundImage === 'random'
          
          let modelDataList: { base64: string; url: string }[] = []
          let sceneDataList: { base64: string; url: string }[] = []
          let productStyle = 'Unknown'

          // 3. 如果需要，执行 AI 分析选择4个模特/场景
          if (needModel || needScene) {
            sendEvent({ 
              type: 'progress', 
              step: 'analyze', 
              message: `智能分析中${needModel ? '（选择4个模特）' : ''}${needScene ? '（选择4个场景）' : ''}...` 
            })
            
            const analysis = await analyzeAndSelect(client, mainProductData, needModel, needScene)
            productStyle = analysis.productStyle
            
            sendEvent({ 
              type: 'analysis_complete', 
              productStyle,
              modelIds: analysis.modelIds,
              sceneIds: analysis.sceneIds,
            })
            
            // 获取 AI 选择的4个模特图片
            if (needModel && analysis.modelIds.length > 0) {
              sendEvent({ type: 'progress', step: 'model', message: `获取${analysis.modelIds.length}个模特图片...` })
              for (const modelId of analysis.modelIds) {
                const modelResult = await getModelImage(modelId)
              if (modelResult) {
                  modelDataList.push(modelResult)
                }
              }
              console.log(`[ProStudio] Got ${modelDataList.length} model images`)
            }
            
            // 获取 AI 选择的4个场景图片
            if (needScene && analysis.sceneIds.length > 0) {
              sendEvent({ type: 'progress', step: 'scene', message: `获取${analysis.sceneIds.length}个场景图片...` })
              for (const sceneId of analysis.sceneIds) {
                const sceneResult = await getSceneImage(sceneId)
              if (sceneResult) {
                  sceneDataList.push(sceneResult)
                }
              }
              console.log(`[ProStudio] Got ${sceneDataList.length} scene images`)
            }
          }

          // 4. 处理用户选择的图片（复制4份）
          if (!needModel && modelImage) {
            sendEvent({ type: 'progress', step: 'model', message: '处理用户选择的模特图片...' })
            const modelData = await imageToBase64(modelImage)
            if (modelData) {
              const modelUrl = modelImage.startsWith('http') ? modelImage : undefined
              // 复制4份用于4次生成
              for (let i = 0; i < 4; i++) {
                modelDataList.push({ base64: modelData, url: modelUrl || '' })
              }
            }
          }
          
          if (!needScene && backgroundImage) {
            sendEvent({ type: 'progress', step: 'scene', message: '处理用户选择的场景图片...' })
            const sceneData = await imageToBase64(backgroundImage)
            if (sceneData) {
              const sceneUrl = backgroundImage.startsWith('http') ? backgroundImage : undefined
              // 复制4份用于4次生成
              for (let i = 0; i < 4; i++) {
                sceneDataList.push({ base64: sceneData, url: sceneUrl || '' })
              }
            }
          }

          // 5. Fallback: 如果 AI 选择失败或数量不足，随机补充
          if (modelDataList.length < 4) {
            sendEvent({ type: 'progress', step: 'model', message: '随机补充模特...' })
            const needed = 4 - modelDataList.length
            for (let i = 0; i < needed; i++) {
            const randomModel = await getRandomPresetBase64('studio-models', 5)
            if (randomModel) {
                modelDataList.push({ base64: randomModel.base64, url: randomModel.url })
              }
            }
          }
          
          if (sceneDataList.length < 4) {
            sendEvent({ type: 'progress', step: 'scene', message: '随机补充场景...' })
            const sceneFiles = ['background01', 'background02', 'background03', 'background04', 'background05',
                               'background06', 'background07', 'background08', 'background09', 'background10', 'background11']
            const needed = 4 - sceneDataList.length
            const usedScenes = new Set(sceneDataList.map(s => s.url))
            for (let i = 0; i < needed; i++) {
              // 随机选择一个未使用的场景
              const availableScenes = sceneFiles.filter(s => !usedScenes.has(`${PRO_STUDIO_URL}/${s}.jpg`))
              if (availableScenes.length === 0) break
              const randomSceneId = availableScenes[Math.floor(Math.random() * availableScenes.length)]
            const sceneResult = await getSceneImage(randomSceneId)
            if (sceneResult) {
                sceneDataList.push(sceneResult)
                usedScenes.add(sceneResult.url)
              }
            }
          }

          // 6. 验证必需数据
          if (modelDataList.length === 0) {
            sendEvent({ type: 'error', error: '无法获取模特图片' })
            controller.close()
            return
          }
          if (sceneDataList.length === 0) {
            sendEvent({ type: 'error', error: '无法获取场景图片' })
            controller.close()
            return
          }

          // 确保有4个模特和4个场景
          while (modelDataList.length < 4) {
            modelDataList.push(modelDataList[modelDataList.length - 1])
          }
          while (sceneDataList.length < 4) {
            sceneDataList.push(sceneDataList[sceneDataList.length - 1])
          }

          // 7. 并行生成 4 张图片（每张使用不同的模特/场景组合）
          sendEvent({ type: 'progress', step: 'generate', message: '开始生成 4 张图片...' })
          
          let successCount = 0
          const generatePromises = [0, 1, 2, 3].map(async (index) => {
            const modelData = modelDataList[index]
            const sceneData = sceneDataList[index]
            
            sendEvent({ 
              type: 'progress', 
              step: 'image', 
              index, 
              message: `生成第 ${index + 1}/4 张图片...` 
            })
            
            // 步骤2: 生成服装搭配
            const outfitInstruct = await generateOutfitInstruct(
              client, productDataList, modelData.base64, sceneData.base64, productStyle
            )
            
            if (!outfitInstruct) {
              sendEvent({ type: 'image_error', index, error: '生成搭配方案失败' })
              return { index, success: false }
            }
            
            // 步骤3: 生成拍摄指令
            const shotInstruct = await generateShotInstruct(
              client, productDataList, modelData.base64, sceneData.base64, productStyle
            )
            
            if (!shotInstruct) {
              sendEvent({ type: 'image_error', index, error: '生成拍摄指令失败' })
              return { index, success: false }
            }
            
            // 步骤4: 生成图片
            const imageResult = await generateImage(
              client,
              productDataList,
              modelData.base64,
              sceneData.base64,
              outfitInstruct,
              shotInstruct,
              `ProStudio-${index}`
            )

            if (imageResult) {
              // 上传到存储
              const uploadedUrl = await uploadImageToStorage(
                `data:image/png;base64,${imageResult}`,
                userId,
                `prostudio-${taskId}`,
                4
              )

              if (uploadedUrl) {
                // 保存到数据库，获取 dbId
                const saveResult = await appendImageToGeneration({
                  taskId,
                  userId,
                  imageIndex: index,
                  imageUrl: uploadedUrl,
                  modelType: 'pro',
                  genMode: 'simple',
                  taskType: 'pro_studio',
                  inputParams: index === 0 ? {
                    productImages: allProductImageUrls,
                    modelUrl: modelData.url,
                    sceneUrl: sceneData.url,
                    modelIsAI: needModel,
                    sceneIsAI: needScene,
                    productStyle,
                    outfitInstruct,
                    shotInstruct,
                  } : { 
                    modelUrl: modelData.url,
                    sceneUrl: sceneData.url,
                  },
                })

                successCount++
                sendEvent({
                  type: 'image',
                  index,
                  image: uploadedUrl,
                  modelUrl: modelData.url,
                  sceneUrl: sceneData.url,
                  ...(saveResult.dbId ? { dbId: saveResult.dbId } : {}),
                })
              } else {
                sendEvent({ type: 'image_error', index, error: '图片上传失败' })
              }
            } else {
              sendEvent({ type: 'image_error', index, error: '图片生成失败' })
            }
            
            return { index, success: !!imageResult }
          })

          await Promise.allSettled(generatePromises)

          sendEvent({ 
            type: 'complete', 
            totalSuccess: successCount,
            modelIsAI: needModel,
            sceneIsAI: needScene,
            productStyle,
          })
          
        } catch (err: any) {
          console.error('[ProStudio] Stream error:', err)
          sendEvent({ type: 'error', error: err.message || '生成失败' })
        }
        
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[ProStudio] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '生成失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
