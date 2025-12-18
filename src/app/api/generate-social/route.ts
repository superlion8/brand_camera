import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { imageToBase64, getRandomPresetBase64 } from '@/lib/presets/serverPresets'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes

// 确保图片数据是 base64 格式（支持 URL 和 base64 输入）
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  return await imageToBase64(image)
}

// Image generation model
const IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_MODEL = 'gemini-2.5-flash-image'

// Social 模式 Prompts
const PROMPTS = {
  // 韩系生活感 (每组 2 张)
  lifestyle: `请为{{product}}生成一个模特实拍图，环境参考{{background}}，模特参考{{model}}，但不能长得和图一完全一样，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格`,
  
  // 对镜自拍 (每组 1 张)
  mirrorSelfie: `为{{product}}商品图生成一个模特对镜自拍的全身图，人物站在镜子前，环境参考{{background}}图，模特参考{{model}}图，动作一定是对镜自拍的pose,随意一些，有生活感，用手机随手拍出来的图片质感，构图和景别随意一些，包括中景和全景,模特需要合理的站在环境参考图内`,
}

// 生成单张图片
async function generateImage(
  client: ReturnType<typeof getGenAIClient>,
  productData: string,
  modelData: string,
  backgroundData: string,
  prompt: string,
  label: string
): Promise<{ image: string; model: 'pro' | 'flash' } | null> {
  // 构建 parts
  const parts: any[] = [
    { text: prompt },
    { text: '\n\n[Product Image - 商品]:' },
    { inlineData: { mimeType: 'image/jpeg', data: productData } },
    { text: '\n\n[Model Reference - 模特参考]:' },
    { inlineData: { mimeType: 'image/jpeg', data: modelData } },
    { text: '\n\n[Background Reference - 环境参考]:' },
    { inlineData: { mimeType: 'image/jpeg', data: backgroundData } },
  ]

  // 尝试主模型
  try {
    console.log(`[${label}] Trying ${IMAGE_MODEL}...`)
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
      console.log(`[${label}] Success with ${IMAGE_MODEL}`)
      return { image: result, model: 'pro' }
    }
  } catch (err: any) {
    console.log(`[${label}] ${IMAGE_MODEL} failed:`, err?.message)
  }

  // 尝试 fallback 模型
  try {
    console.log(`[${label}] Trying fallback ${FALLBACK_MODEL}...`)
    const response = await client.models.generateContent({
      model: FALLBACK_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const result = extractImage(response)
    if (result) {
      console.log(`[${label}] Success with fallback`)
      return { image: result, model: 'flash' }
    }
  } catch (err: any) {
    console.error(`[${label}] Fallback failed:`, err?.message)
  }

  return null
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
      modelImage,
      backgroundImage,
      taskId,
    } = body

    if (!productImage) {
      return new Response(JSON.stringify({ success: false, error: '缺少商品图片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

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

    // 处理模特图片（用户提供或随机）
    let modelData: string | null = null
    let actualModelUrl: string | undefined
    let actualModelName: string = '模特'
    let modelIsRandom = false

    if (modelImage && modelImage !== 'random') {
      modelData = await ensureBase64Data(modelImage)
      if (modelData) {
        actualModelUrl = modelImage.startsWith('http') ? modelImage : undefined
      }
    }
    
    if (!modelData) {
      console.log('[Social] Getting random model...')
      const randomModel = await getRandomPresetBase64('models', 5)
      if (randomModel) {
        modelData = randomModel.base64
        actualModelUrl = randomModel.url
        actualModelName = randomModel.fileName.replace(/\.[^.]+$/, '')
        modelIsRandom = true
        console.log(`[Social] Got random model: ${randomModel.fileName}`)
      }
    }

    if (!modelData) {
      return new Response(JSON.stringify({ success: false, error: '没有可用的模特' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 处理背景图片（用户提供或随机）
    let backgroundData: string | null = null
    let actualBgUrl: string | undefined
    let actualBgName: string = '背景'
    let bgIsRandom = false

    if (backgroundImage && backgroundImage !== 'random') {
      backgroundData = await ensureBase64Data(backgroundImage)
      if (backgroundData) {
        actualBgUrl = backgroundImage.startsWith('http') ? backgroundImage : undefined
      }
    }
    
    if (!backgroundData) {
      console.log('[Social] Getting random background...')
      const randomBg = await getRandomPresetBase64('backgrounds', 5)
      if (randomBg) {
        backgroundData = randomBg.base64
        actualBgUrl = randomBg.url
        actualBgName = randomBg.fileName.replace(/\.[^.]+$/, '')
        bgIsRandom = true
        console.log(`[Social] Got random background: ${randomBg.fileName}`)
      }
    }

    if (!backgroundData) {
      return new Response(JSON.stringify({ success: false, error: '没有可用的背景' }), {
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

        // 生成 6 张图 (2 组 × 3 张)
        // 组 1: 韩系1, 韩系2, 对镜自拍1
        // 组 2: 韩系3, 韩系4, 对镜自拍2
        const imageConfigs = [
          { index: 0, type: 'lifestyle', label: 'Social-1-Lifestyle' },
          { index: 1, type: 'lifestyle', label: 'Social-2-Lifestyle' },
          { index: 2, type: 'mirror', label: 'Social-3-Mirror' },
          { index: 3, type: 'lifestyle', label: 'Social-4-Lifestyle' },
          { index: 4, type: 'lifestyle', label: 'Social-5-Lifestyle' },
          { index: 5, type: 'mirror', label: 'Social-6-Mirror' },
        ]

        let successCount = 0

        for (const config of imageConfigs) {
          sendEvent({ type: 'progress', index: config.index, message: `生成第 ${config.index + 1} 张...` })

          const prompt = config.type === 'lifestyle' ? PROMPTS.lifestyle : PROMPTS.mirrorSelfie
          
          const result = await generateImage(
            client,
            productData!,
            modelData!,
            backgroundData!,
            prompt,
            config.label
          )

          if (result) {
            // 上传到存储
            const uploadedUrl = await uploadImageToStorage(
              `data:image/png;base64,${result.image}`,
              userId,
              `social-${taskId}`,
              3
            )

            if (uploadedUrl) {
              // 保存到数据库
              await appendImageToGeneration({
                taskId,
                userId,
                imageIndex: config.index,
                imageUrl: uploadedUrl,
                modelType: result.model,
                genMode: config.type === 'lifestyle' ? 'simple' : 'extended',
                taskType: 'social',
              })

              successCount++
              sendEvent({
                type: 'image',
                index: config.index,
                image: uploadedUrl,
                modelType: result.model,
                imageType: config.type, // lifestyle 或 mirror
              })
            } else {
              sendEvent({
                type: 'error',
                index: config.index,
                error: '图片上传失败',
              })
            }
          } else {
            sendEvent({
              type: 'error',
              index: config.index,
              error: '图片生成失败',
            })
          }
        }

        sendEvent({ 
          type: 'complete', 
          totalSuccess: successCount,
          modelIsRandom,
          bgIsRandom,
          modelUrl: actualModelUrl,
          bgUrl: actualBgUrl,
        })
        
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

