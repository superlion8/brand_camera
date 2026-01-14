import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage, finalizeTaskStatus } from '@/lib/supabase/generationService'
import { imageToBase64 } from '@/lib/presets/serverPresets'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300 // 5 minutes

// Models
const VLM_MODEL = 'gemini-3-pro-preview'
const IMAGE_MODEL = 'gemini-3-pro-image-preview'

// Storage URL
const ALL_MODELS_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'
const SOCIAL_MEDIA_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/social_media'

// Generation config
const GROUPS = 2
const IMAGES_PER_GROUP = 2
const TOTAL_IMAGES = GROUPS * IMAGES_PER_GROUP // 4

// Prompts
const MODEL_SELECT_PROMPT = `请分析商品的材质、版型、色彩和风格, 在模特数据库中选择出一个 model_id，按优先级：
1. 气质匹配：模特整体气质/风格(model_style_all字段)与商品相符
2. 性别和年龄匹配：商品的性别和年龄属性与模特相匹配
3. 考虑到这个模特是为了UGC自拍图所准备的，所以选择的模特要有素人感，不能是高级脸

模特数据库：
{model_database}

输出格式（严格 JSON）: {"model_id":"selected_model_id","reason":"reason why select this model"}`

const OUTFIT_PROMPT = `# Role
你是服装设计品牌的设计师和社媒穿搭博主。你的任务是基于核心单品，为社媒穿搭展示的服装搭配拍摄设计一套极具高级感、符合当下流行趋势的服装搭配（Look）。

# Inputs
- 核心单品：[商品图]
- 模特特征: [模特图]
- 拍摄环境: [背景图]

# Styling Logic (Think step-by-step)
1. 分析核心单品: 识别商品的主色调、材质（如丹宁、丝绸、皮革）和服饰版型。
2. 搭配核心: 分析商品的款式为它搭配适合的搭配单品（上装/下装/鞋/配饰等），搭配单品要足够多元化且时尚度够高，能够匹配穿搭博主的时尚感
3. 环境融合: 搭配的色系必须与场景形成服饰搭配和谐（同色系高级感）或 时尚度高的撞色关系。
4. 材质互补: 如果核心单品是哑光，搭配光泽感配饰；如果是重工面料，搭配简约基础款。
5. 主次分明: 所有搭配单品（上装/下装/鞋/配饰）都是为了烘托核心单品，严禁在色彩或设计上喧宾夺主。

# Task
基于上述要求，生成一段新的详细的搭配描述，要包含上装、下装、配饰和风格氛围的描述。

# Constraints & Formatting
请不要输出任何推理过程，直接输出一段连贯的、侧重于视觉描述的文本。
描述必须包含以下细节：
1. 全身搭配的描述
2. 具体款式与剪裁 (如: 宽松落肩西装、高腰直筒裤、法式方领衬衫)。
3. 精确的面料与质感 (如: 粗棒针织、光面漆皮、做旧水洗牛仔、垂坠感醋酸)。
4. 准确的色彩术语 (如: 莫兰迪灰、克莱因蓝、大地色系、荧光绿)。
5. 配饰细节 (如: 极简金属耳环、复古墨镜、腋下包)。

示例风格（仅供参考）：
'模特身穿[核心单品]，搭配一条米白色高腰羊毛阔腿裤，面料呈现细腻的绒感。外搭一件深驼色大廓形风衣，敞开穿着以露出核心单品。脚踩一双方头切尔西靴，皮革光泽感强。佩戴金色粗链条项链，整体呈现出一种生活真实感强的手机拍照风格，色调与背景的暖光完美呼应。'

现在，请开始为商品进行搭配设计：`

const FINAL_PROMPT_1 = `请为[商品图]生成一个模特实拍图，环境参考[背景图]，模特参考[模特图]，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格。

搭配指令：
{outfit_instruct}`

const FINAL_PROMPT_2 = `[Role: Professional Fashion Blogger Taking a Mirror Selfie]
[Task: Shoot a realistic mirror selfie social media post showcasing clothing.]

Reference Materials (Strictly Followed)
1. THE PRODUCT: [商品图]
  - ACTION: Reconstruct this exact garment.
  - PRIORITY: MAXIMUM. The logo, text, neckline, and pattern MUST be identical to the reference.
2. THE MODEL: [模特图]
  - ACTION: Use the exact facial features, skin tone, and body shape of this specific model. The model MUST look identical as [模特图], do not use the figure in the [背景图]
3. THE SCENE: [背景图]
  - ACTION: The scene image [背景图] is an atmospheric reference, not a fixed physical space. You may subtly reconstruct or extend the scene following realistic photographic and spatial logic, and redesign the composition through varied camera angles, shot scales, and framing, taking visual inspiration from editorial-style imagery commonly seen in designer fashion brands' official website
  - The model and the product must be naturally merged with the scene, with reasonable lighting and vibe 

Styling Instructions:
{outfit_instruct}

Visual Description of the Shoot:
Please refer to the background image to analyze the character's pose, the background environment information, and the realistic lighting and shadows as a description.

Camera and Shooting Settings:
- Shooting Equipment: Apple iPhone external camera shooting quality
- Image Quality: 8K resolution, original photo, realistic skin texture, realistic fabric physics (wrinkles, drape).`

// 确保图片数据是 base64 格式
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  return await imageToBase64(image)
}

// 从 social_media 文件夹随机获取背景图
async function getRandomSocialMediaBackground(): Promise<{ base64: string; url: string; fileName: string } | null> {
  const availableFiles = [
    '1.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg',
    '14.jpg', '16.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '23.jpg', '25.jpg', '26.jpg', '27.jpg',
    '28.jpg', '29.jpg', '30.jpg', '31.jpg', '33.jpg', '34.jpg', '35.jpg', '37.jpg', '38.jpg', '39.jpg',
    '40.jpg', '41.jpg', '42.jpg', '43.jpg', '44.jpg', '45.png', '46.png', '47.jpg', '48.jpg', '49.jpg',
    '50.jpg', '51.jpg', '52.jpg', '53.png', '55.jpg', '56.png', '57.jpg'
  ]
  
  const randomFile = availableFiles[Math.floor(Math.random() * availableFiles.length)]
  const url = `${SOCIAL_MEDIA_URL}/${randomFile}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    
    return { base64, url, fileName: randomFile }
  } catch (e) {
    console.error('[Social] Failed to fetch random background:', e)
    return null
  }
}

// 智能选择模特
async function selectModelByAI(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  groupIndex: number,
): Promise<{ modelId: string; modelUrl: string; modelBase64: string; reason: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) return null
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: modelsData, error } = await supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_style_primary, model_style_all, body_shape, height_range, model_desc')
    
    if (error || !modelsData || modelsData.length === 0) {
      console.error(`[Social-G${groupIndex}] Failed to fetch models_analysis:`, error)
      return null
    }
    
    const modelDatabase = modelsData.map(m => ({
      model_id: m.model_id,
      gender: m.model_gender,
      age_group: m.model_age_group,
      style: m.model_style_primary,
      style_all: m.model_style_all,
      body_shape: m.body_shape,
      height: m.height_range,
      desc: m.model_desc?.substring(0, 150) + '...'
    }))
    
    const prompt = MODEL_SELECT_PROMPT.replace('{model_database}', JSON.stringify(modelDatabase, null, 2))
    
    console.log(`[Social-G${groupIndex}] Calling VLM to select model...`)
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: '\n\n[商品图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: productData } },
        ],
      }],
      config: { safetySettings },
    })
    
    const textResult = extractText(response)
    if (!textResult) return null
    
    const jsonMatch = textResult.match(/\{[\s\S]*?"model_id"[\s\S]*?\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    const modelId = parsed.model_id
    const reason = parsed.reason || ''
    
    console.log(`[Social-G${groupIndex}] AI selected model: ${modelId}, reason: ${reason}`)
    
    // 获取模特图片
    let modelUrl = `${ALL_MODELS_URL}/${modelId}.png`
    let modelResponse = await fetch(modelUrl, { method: 'HEAD' })
    
    if (!modelResponse.ok) {
      modelUrl = `${ALL_MODELS_URL}/${modelId}.jpg`
      modelResponse = await fetch(modelUrl, { method: 'HEAD' })
    }
    
    if (!modelResponse.ok) {
      console.error(`[Social-G${groupIndex}] Model image not found: ${modelId}`)
      return null
    }
    
    const imageResponse = await fetch(modelUrl)
    const buffer = await imageResponse.arrayBuffer()
    const modelBase64 = Buffer.from(buffer).toString('base64')
    
    return { modelId, modelUrl, modelBase64, reason }
  } catch (e) {
    console.error(`[Social-G${groupIndex}] AI model selection failed:`, e)
    return null
  }
}

// 生成服装搭配指令
async function generateOutfitInstruct(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  sceneData: string,
  groupIndex: number,
): Promise<string | null> {
  try {
    console.log(`[Social-G${groupIndex}] Generating outfit instructions...`)
    
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: OUTFIT_PROMPT },
          { text: '\n\n[商品图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: productData } },
          { text: '\n\n[模特图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: modelData } },
          { text: '\n\n[背景图]:' },
          { inlineData: { mimeType: 'image/jpeg', data: sceneData } },
        ],
      }],
      config: { safetySettings },
    })
    
    const result = extractText(response)
    if (result) {
      console.log(`[Social-G${groupIndex}] Outfit instructions generated: ${result.substring(0, 100)}...`)
    }
    return result
  } catch (e) {
    console.error(`[Social-G${groupIndex}] Failed to generate outfit instructions:`, e)
    return null
  }
}

// 生成最终图片
async function generateFinalImage(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  additionalProducts: string[],
  modelData: string,
  sceneData: string,
  outfitInstruct: string,
  promptType: 1 | 2,
  label: string,
): Promise<string | null> {
  try {
    const promptTemplate = promptType === 1 ? FINAL_PROMPT_1 : FINAL_PROMPT_2
    const prompt = promptTemplate.replace('{outfit_instruct}', outfitInstruct)
    
    console.log(`[${label}] Generating image with prompt type ${promptType}, additional products: ${additionalProducts.length}`)
    
    // Build parts with main product + additional products
    const parts: any[] = [
      { text: prompt },
      { text: '\n\n[商品图]:' },
      { inlineData: { mimeType: 'image/jpeg', data: productData } },
    ]
    // Add additional products
    additionalProducts.forEach((prodData, idx) => {
      parts.push({ text: `\n\n[商品图${idx + 2}]:` })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: prodData } })
    })
    // Add model and scene
    parts.push({ text: '\n\n[模特图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelData } })
    parts.push({ text: '\n\n[背景图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: sceneData } })
    
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts,
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

// 处理单组的完整工作流
interface GroupResult {
  groupIndex: number
  modelUrl?: string
  modelId?: string
  sceneUrl?: string
  outfitInstruct?: string
  images: { index: number; url: string | null; promptType: 1 | 2 }[]
}

async function processGroup(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  additionalProducts: string[],
  userModelData: string | null,
  userModelUrl: string | undefined,
  groupIndex: number,
  taskId: string,
  userId: string,
  sendEvent: (data: any) => void,
): Promise<GroupResult> {
  const result: GroupResult = {
    groupIndex,
    images: [],
  }

  try {
    // 1. 获取模特图片
    let modelData: string | null = userModelData
    let modelUrl = userModelUrl
    let modelId: string | undefined

    if (!modelData) {
      sendEvent({ type: 'progress', groupIndex, step: 'model', message: `Group ${groupIndex + 1}: Selecting model...` })
      const aiResult = await selectModelByAI(client, productData, groupIndex)
      if (aiResult) {
        modelData = aiResult.modelBase64
        modelUrl = aiResult.modelUrl
        modelId = aiResult.modelId
        sendEvent({ type: 'model_selected', groupIndex, modelId: aiResult.modelId, reason: aiResult.reason })
      }
    }

    if (!modelData) {
      sendEvent({ type: 'error', groupIndex, error: `Group ${groupIndex + 1}: Failed to fetch model image` })
      return result
    }

    result.modelUrl = modelUrl
    result.modelId = modelId

    // 2. 获取随机背景图
    sendEvent({ type: 'progress', groupIndex, step: 'background', message: `Group ${groupIndex + 1}: Selecting background...` })
    const bgResult = await getRandomSocialMediaBackground()
    
    if (!bgResult) {
      sendEvent({ type: 'error', groupIndex, error: `Group ${groupIndex + 1}: Failed to fetch background image` })
      return result
    }
    
    const sceneData = bgResult.base64
    result.sceneUrl = bgResult.url
    sendEvent({ type: 'background_selected', groupIndex, url: bgResult.url, fileName: bgResult.fileName })

    // 3. 生成服装搭配指令
    sendEvent({ type: 'progress', groupIndex, step: 'outfit', message: `Group ${groupIndex + 1}: Designing outfit...` })
    const outfitInstruct = await generateOutfitInstruct(client, productData, modelData, sceneData, groupIndex)
    
    if (!outfitInstruct) {
      sendEvent({ type: 'error', groupIndex, error: `Group ${groupIndex + 1}: Failed to generate outfit plan` })
      return result
    }
    
    result.outfitInstruct = outfitInstruct
    sendEvent({ type: 'outfit_ready', groupIndex, outfit: outfitInstruct })

    // 4. 生成 2 张图片（并行），都使用 FINAL_PROMPT_2
    const imagePromises = [
      { promptType: 2 as const, localIndex: 0 },
      { promptType: 2 as const, localIndex: 1 },
    ].map(async ({ promptType, localIndex }) => {
      const globalIndex = groupIndex * IMAGES_PER_GROUP + localIndex
      const label = `Social-G${groupIndex}-I${localIndex}`
      
      sendEvent({ 
        type: 'progress', 
        groupIndex, 
        step: 'image', 
        localIndex,
        globalIndex,
        message: `Group ${groupIndex + 1}: Generating image ${localIndex + 1}/2...` 
      })
      
      const imageResult = await generateFinalImage(
        client,
        productData,
        additionalProducts,
        modelData!,
        sceneData,
        outfitInstruct,
        promptType,
        label
      )

      if (imageResult) {
        const uploadedUrl = await uploadImageToStorage(
          `data:image/png;base64,${imageResult}`,
          userId,
          `social-${taskId}`,
          TOTAL_IMAGES
        )

        if (uploadedUrl) {
          const saveResult = await appendImageToGeneration({
            taskId,
            userId,
            imageIndex: globalIndex,
            imageUrl: uploadedUrl,
            modelType: 'pro',
            genMode: 'simple', // Social 模式统一使用 simple
            taskType: 'social',
          })

          // ✅ 检查数据库保存是否成功
          if (saveResult.success) {
            sendEvent({
              type: 'image',
              groupIndex,
              localIndex,
              globalIndex,
              image: uploadedUrl,
              promptType,
              dbId: saveResult.dbId,
            })
            return { index: globalIndex, url: uploadedUrl, promptType }
          } else {
            console.error(`[Social] Failed to save image ${globalIndex} to database`)
            sendEvent({ type: 'image_error', groupIndex, localIndex, globalIndex, error: 'Database save failed' })
            return { index: globalIndex, url: null, promptType }
          }
        } else {
          sendEvent({ type: 'image_error', groupIndex, localIndex, globalIndex, error: 'Image upload failed' })
          return { index: globalIndex, url: null, promptType }
        }
      } else {
        sendEvent({ type: 'image_error', groupIndex, localIndex, globalIndex, error: 'Image generation failed' })
        return { index: globalIndex, url: null, promptType }
      }
    })

    const imageResults = await Promise.all(imagePromises)
    result.images = imageResults

  } catch (e: any) {
    console.error(`[Social-G${groupIndex}] Group processing failed:`, e)
    sendEvent({ type: 'error', groupIndex, error: e.message || `Group ${groupIndex + 1} processing failed` })
  }

  return result
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const body = await request.json()
    const {
      productImage,
      additionalProducts, // Array of up to 3 additional products
      modelImage,
      taskId,
    } = body

    if (!productImage) {
      return new Response(JSON.stringify({ success: false, error: '缺少商品图片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Process additional products (up to 3)
    const validAdditionalProducts: string[] = []
    if (additionalProducts && Array.isArray(additionalProducts)) {
      for (const img of additionalProducts.slice(0, 3)) {
        if (img) {
          const base64 = await imageToBase64(img)
          if (base64) validAdditionalProducts.push(base64)
        }
      }
    }
    console.log(`[Social API] Additional products: ${validAdditionalProducts.length}`)

    const client = getGenAIClient()
    
    // 处理商品图片
    console.log('[Social] Processing product image...')
    const productData = await ensureBase64Data(productImage)
    if (!productData) {
      return new Response(JSON.stringify({ success: false, error: '商品图片处理失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 处理用户选择的模特图片（如果有）
    let userModelData: string | null = null
    let userModelUrl: string | undefined

    if (modelImage && modelImage !== 'random') {
      userModelData = await ensureBase64Data(modelImage)
      userModelUrl = modelImage.startsWith('http') ? modelImage : undefined
    }

    // 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          console.log(`[Social] Starting 2-group parallel generation...`)
          sendEvent({ type: 'start', totalGroups: GROUPS, imagesPerGroup: IMAGES_PER_GROUP, totalImages: TOTAL_IMAGES })

          // 两组并行执行
          const groupResults = await Promise.all([
            processGroup(client, productData, validAdditionalProducts, userModelData, userModelUrl, 0, taskId, userId, sendEvent),
            processGroup(client, productData, validAdditionalProducts, userModelData, userModelUrl, 1, taskId, userId, sendEvent),
          ])

          // 统计成功数
          let successCount = 0
          for (const groupResult of groupResults) {
            for (const img of groupResult.images) {
              if (img.url) successCount++
            }
          }

          // 后端统一更新任务状态（不依赖前端）
          await finalizeTaskStatus(taskId, userId, successCount)

          sendEvent({ 
            type: 'complete', 
            totalSuccess: successCount,
            totalImages: TOTAL_IMAGES,
            groups: groupResults.map(g => ({
              groupIndex: g.groupIndex,
              modelUrl: g.modelUrl,
              modelId: g.modelId,
              sceneUrl: g.sceneUrl,
              outfitInstruct: g.outfitInstruct,
              imageCount: g.images.filter(i => i.url).length,
            })),
          })
          
          console.log(`[Social] Complete: ${successCount}/${TOTAL_IMAGES} images`)
          
        } catch (err: any) {
          console.error('[Social] Stream error:', err)
          sendEvent({ type: 'error', error: err.message || 'Generation failed' })
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
    console.error('[Social] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '生成失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
