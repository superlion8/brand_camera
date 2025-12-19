import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { imageToBase64, getRandomPresetBase64 } from '@/lib/presets/serverPresets'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300 // 5 minutes

// Models
const VLM_MODEL = 'gemini-3-pro-preview'
const IMAGE_MODEL = 'gemini-3-pro-image-preview'

// Storage URL
const ALL_MODELS_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'
const SOCIAL_MEDIA_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/social_media'

// Prompts
const MODEL_SELECT_PROMPT = `请分析商品的材质、版型、色彩和风格, 在模特数据库中选择出一个 model_id，按优先级：
1. 气质匹配：模特整体气质/风格(model_style_all字段)与商品相符
2. 性别和年龄匹配：商品的性别和年龄属性与模特相匹配
3. 身材/比例适配：模特身形与商品版型更合适（oversized 更适合骨架感/衣架感；修身更适合线条利落；高腰阔腿更适合比例好）
4. 商业展示友好：优先能把商品穿得高级、不抢戏、不违和的模特

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
2. 搭配核心: 分析商品的款式为它搭配适合的搭配单品（上装/下装/鞋/配饰），搭配单品要足够多元化且时尚度够高，能够匹配穿搭博主的时尚感
3. 环境融合: 搭配的色系必须与场景形成服饰搭配和谐（同色系高级感）或 时尚度高的撞色关系。
4. 材质互补: 如果核心单品是哑光，搭配光泽感配饰；如果是重工面料，搭配简约基础款。
5. 主次分明: 所有搭配单品（上装/下装/鞋/配饰）都是为了烘托核心单品，严禁在色彩或设计上喧宾夺主。

# Task
忽略模特图原本的穿搭，基于上述要求，生成一段新的详细的搭配描述，要包含上装、下装、配饰和风格氛围的描述。

# Constraints & Formatting
请不要输出任何推理过程，直接输出一段连贯的、侧重于视觉描述的文本。
描述必须包含以下细节：
1. 具体款式与剪裁 (如: 宽松落肩西装、高腰直筒裤、法式方领衬衫)。
2. 精确的面料与质感 (如: 粗棒针织、光面漆皮、做旧水洗牛仔、垂坠感醋酸)。
3. 准确的色彩术语 (如: 莫兰迪灰、克莱因蓝、大地色系、荧光绿)。
4. 配饰细节 (如: 极简金属耳环、复古墨镜、腋下包)。

示例风格（仅供参考）：
'模特身穿[核心单品]，搭配一条米白色高腰羊毛阔腿裤，面料呈现细腻的绒感。外搭一件深驼色大廓形风衣，敞开穿着以露出核心单品。脚踩一双方头切尔西靴，皮革光泽感强。佩戴金色粗链条项链，整体呈现出一种生活真实感强的手机拍照风格，色调与背景的暖光完美呼应。'

现在，请开始为商品进行搭配设计：`

const FINAL_PROMPT = `[Role: Professional Fashion Blogger Taking a Mirror Selfie]
[Task: Shoot a realistic mirror selfie social media post showcasing clothing.]

Reference Materials (Strictly Followed)
1. THE PRODUCT: [商品图]
- Action: Precisely reproduce this garment.
- Priority: Highest. The logo, text, neckline, and pattern must be exactly the same as the reference image.
2. THE MODEL: [模特图]
- Action: Use the specific appearance, hairstyle, makeup, skin tone, and body type of this model. The model must look exactly the same as the reference image.
- Restriction: Ignore the original clothing in the model reference image.
3. THE SCENE: [背景图]
- Action: Use this exact scene environment and character pose.

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
  // social_media 文件夹中的文件名（有缺号）
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
): Promise<{ modelId: string; modelUrl: string; modelBase64: string; reason: string } | null> {
  try {
    // 1. 获取 models_analysis 数据
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) return null
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: modelsData, error } = await supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_style_primary, model_style_all, body_shape, height_range, model_desc')
    
    if (error || !modelsData || modelsData.length === 0) {
      console.error('[Social] Failed to fetch models_analysis:', error)
      return null
    }
    
    // 2. 构建 prompt
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
    
    // 3. 调用 VLM
    console.log('[Social] Calling VLM to select model...')
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
    
    // 4. 解析结果
    const jsonMatch = textResult.match(/\{[\s\S]*?"model_id"[\s\S]*?\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    const modelId = parsed.model_id
    const reason = parsed.reason || ''
    
    console.log(`[Social] AI selected model: ${modelId}, reason: ${reason}`)
    
    // 5. 获取模特图片（尝试 .png 和 .jpg）
    let modelUrl = `${ALL_MODELS_URL}/${modelId}.png`
    let modelResponse = await fetch(modelUrl, { method: 'HEAD' })
    
    if (!modelResponse.ok) {
      modelUrl = `${ALL_MODELS_URL}/${modelId}.jpg`
      modelResponse = await fetch(modelUrl, { method: 'HEAD' })
    }
    
    if (!modelResponse.ok) {
      console.error(`[Social] Model image not found: ${modelId}`)
      return null
    }
    
    // 6. 下载模特图片
    const imageResponse = await fetch(modelUrl)
    const buffer = await imageResponse.arrayBuffer()
    const modelBase64 = Buffer.from(buffer).toString('base64')
    
    return { modelId, modelUrl, modelBase64, reason }
  } catch (e) {
    console.error('[Social] AI model selection failed:', e)
    return null
  }
}

// 生成服装搭配指令
async function generateOutfitInstruct(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  sceneData: string,
): Promise<string | null> {
  try {
    console.log('[Social] Generating outfit instructions...')
    
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
      console.log('[Social] Outfit instructions generated:', result.substring(0, 100) + '...')
    }
    return result
  } catch (e) {
    console.error('[Social] Failed to generate outfit instructions:', e)
    return null
  }
}

// 生成最终图片
async function generateFinalImage(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  sceneData: string,
  outfitInstruct: string,
  label: string,
): Promise<string | null> {
  try {
    const prompt = FINAL_PROMPT.replace('{outfit_instruct}', outfitInstruct)
    
    console.log(`[${label}] Generating image...`)
    
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
          { text: '\n\n[背景图]:' },
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

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  try {
    const body = await request.json()
    const { 
      productImage,
      modelImage, // 用户选择的模特图（可选）
      taskId,
    } = body

    if (!productImage) {
      return new Response(JSON.stringify({ success: false, error: '缺少商品图片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const client = getGenAIClient()
    
    // 1. 处理商品图片
    console.log('[Social] Processing product image...')
    const productData = await ensureBase64Data(productImage)
    if (!productData) {
      return new Response(JSON.stringify({ success: false, error: '商品图片处理失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // 2. 处理模特图片
          let modelData: string | null = null
          let modelUrl: string | undefined
          let modelIsAI = false

          if (modelImage && modelImage !== 'random') {
            sendEvent({ type: 'progress', step: 'model', message: '处理模特图片...' })
            modelData = await ensureBase64Data(modelImage)
            modelUrl = modelImage.startsWith('http') ? modelImage : undefined
          }
          
          if (!modelData) {
            sendEvent({ type: 'progress', step: 'model', message: '智能选择模特中...' })
            const aiResult = await selectModelByAI(client, productData)
            if (aiResult) {
              modelData = aiResult.modelBase64
              modelUrl = aiResult.modelUrl
              modelIsAI = true
              sendEvent({ type: 'model_selected', modelId: aiResult.modelId, reason: aiResult.reason })
            }
          }

          if (!modelData) {
            sendEvent({ type: 'error', error: '无法获取模特图片' })
            controller.close()
            return
          }

          // 3. 获取随机背景图（从 social_media 文件夹）
          sendEvent({ type: 'progress', step: 'background', message: '选择场景背景...' })
          const bgResult = await getRandomSocialMediaBackground()
          
          if (!bgResult) {
            sendEvent({ type: 'error', error: '无法获取背景图片' })
            controller.close()
            return
          }
          
          const sceneData = bgResult.base64
          const sceneUrl = bgResult.url
          sendEvent({ type: 'background_selected', url: sceneUrl, fileName: bgResult.fileName })

          // 4. 生成服装搭配指令
          sendEvent({ type: 'progress', step: 'outfit', message: '设计服装搭配方案...' })
          const outfitInstruct = await generateOutfitInstruct(client, productData, modelData, sceneData)
          
          if (!outfitInstruct) {
            sendEvent({ type: 'error', error: '生成搭配方案失败' })
            controller.close()
            return
          }
          
          sendEvent({ type: 'outfit_ready', outfit: outfitInstruct })

          // 5. 生成 3 张图片（共用同一个模特和背景）
          let successCount = 0

          for (let i = 0; i < 3; i++) {
            sendEvent({ type: 'progress', step: 'image', index: i, message: `生成第 ${i + 1}/3 张图片...` })
            
            const imageResult = await generateFinalImage(
              client,
              productData,
              modelData,
              sceneData,
              outfitInstruct,
              `Social-Image-${i + 1}`
            )

            if (imageResult) {
              // 上传到存储
              const uploadedUrl = await uploadImageToStorage(
                `data:image/png;base64,${imageResult}`,
                userId,
                `social-${taskId}`,
                3
              )

              if (uploadedUrl) {
                // 保存到数据库
                await appendImageToGeneration({
                  taskId,
                  userId,
                  imageIndex: i,
                  imageUrl: uploadedUrl,
                  modelType: 'pro',
                  genMode: 'simple',
                  taskType: 'social',
                })

                successCount++
                sendEvent({
                  type: 'image',
                  index: i,
                  image: uploadedUrl,
                })
              } else {
                sendEvent({ type: 'image_error', index: i, error: '图片上传失败' })
              }
            } else {
              sendEvent({ type: 'image_error', index: i, error: '图片生成失败' })
            }
          }

          sendEvent({ 
            type: 'complete', 
            totalSuccess: successCount,
            modelIsAI,
            modelUrl,
            sceneUrl,
            outfitInstruct,
          })
          
        } catch (err: any) {
          console.error('[Social] Stream error:', err)
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
