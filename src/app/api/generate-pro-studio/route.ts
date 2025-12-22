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
const FLASH_MODEL = 'gemini-3-flash-preview'      // 分析用（快速）
const VLM_MODEL = 'gemini-3-pro-preview'          // 生成 outfit
const IMAGE_MODEL = 'gemini-3-pro-image-preview'  // 图像生成

// Storage URL
const ALL_MODELS_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'
const PRO_STUDIO_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/pro_studio'

// ============================================
// 4 种机位配置
// ============================================
const SHOT_FOCUS_CONFIGS = [
  {
    index: 0,
    name: 'full_body',
    prompt: 'Full body wide shot. Standard e-commerce catalog pose. The model is standing straight with a neutral stance, facing the camera directly. Ensure the entire outfit fits within the frame from head to toe. Clean, professional composition.'
  },
  {
    index: 1,
    name: 'cool_pose',
    prompt: "Fashion Editorial Shot. A slightly low-angle perspective to elongate the silhouette. The model is striking a confident, relaxed 'cool' pose. The framing focuses on the 'Total Look' but with more attitude than a catalog shot."
  },
  {
    index: 2,
    name: 'detail',
    prompt: 'Detailed Close-up Shot. Cinematic Close-up. The camera zooms in to fill the frame with the main product item. Focus sharply on the fabric texture and stitching details of the product.'
  },
  {
    index: 3,
    name: 'dynamic',
    prompt: 'Studio shot. The model is caught in a subtle, natural movement, taking a small, gentle step forward. Not a runway walk, but a relaxed shift in weight. The clothing hangs naturally on the body. The vibe is calm, professional, and effortless.'
  },
]

// ============================================
// Prompts
// ============================================

// 步骤1: 服装风格分析 + 智能选择模特/背景
const MATCH_PROMPT = `1. 请分析商品{{product_img}}的材质、版型、色彩和风格
2. 在 model_analysis表中选择出一个 model_id，按优先级：
  1. 气质匹配：模特整体气质/风格(model_style_all字段)与商品{{product_img}}相符
  2. 性别和年龄品牌：商品的性别和年龄属性与模特相匹配
  3. 身材/比例适配：模特身形与商品版型更合适（oversized 更适合骨架感/衣架感；修身更适合线条利落；高腰阔腿更适合比例好）
3. 读取pro_studio_scene_tag表中所有场景的标签，进行商品和场景的匹配度打分，选出一个 scene_id，按优先级：
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
"model_id":"选择的模特id" ,
"model_reason": "", 
"scene_id": "选择的场景id", 
"scene_reason":"选择场景的原因" }`

// 步骤3: 生成服装搭配
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

// 步骤4: 最终图像生成
const FINAL_PROMPT = `[Role: Professional Commercial Photographer]
[Task: High-Fidelity Fashion Photography]

Reference Sources (Strict Adherence)
1. THE PRODUCT: [商品图]
  - ACTION: Reconstruct this exact garment.
  - PRIORITY: MAXIMUM. The logo, text, neckline, and pattern MUST be identical to the reference.
2. THE MODEL: [模特图]
  - ACTION: Use the exact facial features, skin tone, and body shape of this specific model. The model MUST look identical.
3. THE SCENE: [场景图] 
  - ACTION: The scene image is an atmospheric reference, not a fixed physical space. You may subtly reconstruct or extend the scene following realistic photographic and spatial logic, and redesign the composition through varied camera angles, shot scales, and framing, taking visual inspiration from editorial-style imagery commonly seen in designer fashion brands' official website.
  - The model and the product must be naturally merged with the scene, with reasonable lighting and vibe.
    
Styling Instructions
{{outfit_instruct}}

Camera & Shot Settings
- SHOT FOCUS: {{shot_focus}}
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
 * 步骤1: 服装风格分析 + 智能选择模特/背景
 */
async function analyzeAndSelect(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  needModel: boolean,
  needScene: boolean
): Promise<{
  modelId: string | null;
  sceneId: string | null;
  productStyle: string;
  modelReason?: string;
  sceneReason?: string;
}> {
  try {
    // 获取数据库数据
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[ProStudio] Missing Supabase credentials')
      return { modelId: null, sceneId: null, productStyle: 'Unknown' }
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
      promptParts.push(`\n\n注意：用户已选择模特，不需要选择 model_id，请在输出中将 model_id 设为 null`)
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
      promptParts.push(`\n\n注意：用户已选择场景，不需要选择 scene_id，请在输出中将 scene_id 设为 null`)
    }
    
    const fullPrompt = promptParts.join('')
    
    console.log('[ProStudio] Analyzing product and selecting model/scene...')
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
      return { modelId: null, sceneId: null, productStyle: 'Unknown' }
    }
    
    console.log('[ProStudio] Analysis result:', textResult.substring(0, 300))
    
    // 解析 JSON 结果
    const jsonMatch = textResult.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[ProStudio] Failed to parse JSON from result')
      return { modelId: null, sceneId: null, productStyle: 'Unknown' }
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      modelId: needModel ? parsed.model_id : null,
      sceneId: needScene ? parsed.scene_id : null,
      productStyle: parsed.product_style || 'Unknown',
      modelReason: parsed.model_reason,
      sceneReason: parsed.scene_reason,
    }
  } catch (e) {
    console.error('[ProStudio] Analysis error:', e)
    return { modelId: null, sceneId: null, productStyle: 'Unknown' }
  }
}

/**
 * 步骤3: 生成服装搭配指令
 */
async function generateOutfitInstruct(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  sceneData: string,
  productStyle: string
): Promise<string | null> {
  try {
    const prompt = OUTFIT_PROMPT.replace('{{product_style}}', productStyle)
    
    console.log('[ProStudio] Generating outfit instructions...')
    
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: '\n\n[商品图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: productData } },
          { text: '\n\n[模特图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: modelData } },
          { text: '\n\n[场景图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: sceneData } },
        ],
      }],
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
 * 步骤4: 生成单张图片（带机位）
 */
async function generateImageWithShotFocus(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  sceneData: string,
  outfitInstruct: string,
  shotFocus: string,
  label: string
): Promise<string | null> {
  try {
    const prompt = FINAL_PROMPT
      .replace('{{outfit_instruct}}', outfitInstruct)
      .replace('{{shot_focus}}', shotFocus)
    
    console.log(`[${label}] Generating image with shot focus: ${shotFocus.substring(0, 30)}...`)
    
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: '\n\n[商品图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: productData } },
          { text: '\n\n[模特图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: modelData } },
          { text: '\n\n[场景图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: sceneData } },
        ],
      }],
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
    // outfitItems 支持两种格式：
    //   - 直接 URL 字符串：{ top: "https://..." }
    //   - 对象格式：{ top: { imageUrl: "https://..." } }
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
          // 1. 处理商品图片
          sendEvent({ type: 'progress', step: 'product', message: '处理商品图片...' })
          const productData = await imageToBase64(mainProductImage)
          if (!productData) {
            sendEvent({ type: 'error', error: '商品图片处理失败' })
            controller.close()
            return
          }

          // 2. 判断是否需要 AI 分析
          const needModel = !modelImage || modelImage === 'random'
          const needScene = !backgroundImage || backgroundImage === 'random'
          
          let modelData: string | null = null
          let modelUrl: string | undefined
          let sceneData: string | null = null
          let sceneUrl: string | undefined
          let productStyle = 'Unknown'
          let modelIsAI = false
          let sceneIsAI = false

          // 3. 如果需要，执行 AI 分析选择
          if (needModel || needScene) {
            sendEvent({ 
              type: 'progress', 
              step: 'analyze', 
              message: `智能分析中${needModel ? '（选择模特）' : ''}${needScene ? '（选择场景）' : ''}...` 
            })
            
            const analysis = await analyzeAndSelect(client, productData, needModel, needScene)
            productStyle = analysis.productStyle
            
            sendEvent({ 
              type: 'analysis_complete', 
              productStyle,
              modelId: analysis.modelId,
              sceneId: analysis.sceneId,
              modelReason: analysis.modelReason,
              sceneReason: analysis.sceneReason,
            })
            
            // 获取 AI 选择的模特图片
            if (needModel && analysis.modelId) {
              sendEvent({ type: 'progress', step: 'model', message: `获取模特图片: ${analysis.modelId}...` })
              const modelResult = await getModelImage(analysis.modelId)
              if (modelResult) {
                modelData = modelResult.base64
                modelUrl = modelResult.url
                modelIsAI = true
              }
            }
            
            // 获取 AI 选择的场景图片
            if (needScene && analysis.sceneId) {
              sendEvent({ type: 'progress', step: 'scene', message: `获取场景图片: ${analysis.sceneId}...` })
              const sceneResult = await getSceneImage(analysis.sceneId)
              if (sceneResult) {
                sceneData = sceneResult.base64
                sceneUrl = sceneResult.url
                sceneIsAI = true
              }
            }
          }

          // 4. 处理用户选择的图片
          if (!needModel && modelImage) {
            sendEvent({ type: 'progress', step: 'model', message: '处理用户选择的模特图片...' })
            modelData = await imageToBase64(modelImage)
            modelUrl = modelImage.startsWith('http') ? modelImage : undefined
          }
          
          if (!needScene && backgroundImage) {
            sendEvent({ type: 'progress', step: 'scene', message: '处理用户选择的场景图片...' })
            sceneData = await imageToBase64(backgroundImage)
            sceneUrl = backgroundImage.startsWith('http') ? backgroundImage : undefined
          }

          // 5. Fallback: 如果 AI 选择失败，随机选择
          if (!modelData) {
            sendEvent({ type: 'progress', step: 'model', message: '随机选择模特...' })
            const randomModel = await getRandomPresetBase64('studio-models', 5)
            if (randomModel) {
              modelData = randomModel.base64
              modelUrl = randomModel.url
              modelIsAI = true
            }
          }
          
          if (!sceneData) {
            sendEvent({ type: 'progress', step: 'scene', message: '随机选择场景...' })
            // 从 pro_studio 文件夹随机选择
            const sceneFiles = ['background01', 'background02', 'background03', 'background04', 'background05',
                               'background06', 'background07', 'background08', 'background09', 'background10', 'background11']
            const randomSceneId = sceneFiles[Math.floor(Math.random() * sceneFiles.length)]
            const sceneResult = await getSceneImage(randomSceneId)
            if (sceneResult) {
              sceneData = sceneResult.base64
              sceneUrl = sceneResult.url
              sceneIsAI = true
            }
          }

          // 6. 验证必需数据
          if (!modelData) {
            sendEvent({ type: 'error', error: '无法获取模特图片' })
            controller.close()
            return
          }
          if (!sceneData) {
            sendEvent({ type: 'error', error: '无法获取场景图片' })
            controller.close()
            return
          }

          // 7. 步骤3: 生成服装搭配
          sendEvent({ type: 'progress', step: 'outfit', message: '设计服装搭配方案...' })
          const outfitInstruct = await generateOutfitInstruct(
            client, productData, modelData, sceneData, productStyle
          )
          
          if (!outfitInstruct) {
            sendEvent({ type: 'error', error: '生成搭配方案失败' })
            controller.close()
            return
          }
          
          sendEvent({ type: 'outfit_ready', outfit: outfitInstruct })

          // 8. 步骤4: 并行生成 4 张图片（4 种机位）
          sendEvent({ type: 'progress', step: 'generate', message: '开始生成 4 张图片...' })
          
          let successCount = 0
          const generatePromises = SHOT_FOCUS_CONFIGS.map(async (config) => {
            sendEvent({ 
              type: 'progress', 
              step: 'image', 
              index: config.index, 
              message: `生成第 ${config.index + 1}/4 张图片 (${config.name})...` 
            })
            
            const imageResult = await generateImageWithShotFocus(
              client,
              productData,
              modelData!,
              sceneData!,
              outfitInstruct,
              config.prompt,
              `ProStudio-${config.name}`
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
                  imageIndex: config.index,
                  imageUrl: uploadedUrl,
                  modelType: 'pro',
                  genMode: 'simple',
                  taskType: 'pro_studio',
                  inputParams: config.index === 0 ? {
                    productImages: allProductImageUrls,  // 记录所有商品图片 URL
                    modelUrl,
                    sceneUrl,
                    modelIsAI,
                    sceneIsAI,
                    productStyle,
                    outfitInstruct,
                    shotType: config.name,
                  } : { shotType: config.name },
                })

                successCount++
                // Bug 2 修复：只有保存成功时才发送 dbId
                sendEvent({
                  type: 'image',
                  index: config.index,
                  image: uploadedUrl,
                  shotType: config.name,
                  ...(saveResult.dbId ? { dbId: saveResult.dbId } : {}),
                })
              } else {
                sendEvent({ type: 'image_error', index: config.index, error: '图片上传失败', shotType: config.name })
              }
            } else {
              sendEvent({ type: 'image_error', index: config.index, error: '图片生成失败', shotType: config.name })
            }
            
            return { index: config.index, success: !!imageResult }
          })

          await Promise.allSettled(generatePromises)

          sendEvent({ 
            type: 'complete', 
            totalSuccess: successCount,
            modelIsAI,
            sceneIsAI,
            modelUrl,
            sceneUrl,
            productStyle,
            outfitInstruct,
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
