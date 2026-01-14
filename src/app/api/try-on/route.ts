import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage, finalizeTaskStatus } from '@/lib/supabase/generationService'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes

// 模型配置
const IMAGE_MODEL = 'gemini-3-pro-image-preview'

// Try-on prompt
const TRY_ON_PROMPT = `You are a professional virtual try-on assistant specialized in fashion photography.

Your task is to generate a realistic photo of the person wearing the provided clothing items.

## Instructions:
1. Analyze the person's body shape, pose, and lighting in the original photo
2. Analyze each clothing item's style, color, fabric, and fit
3. Generate a natural, realistic photo showing the person wearing these clothes
4. Maintain the person's original pose, facial expression, and background
5. Ensure the clothing fits naturally on the person's body with proper shadows and folds
6. Keep the overall lighting consistent with the original photo

## User's additional instructions:
{{user_prompt}}

Generate a high-quality, photorealistic image of the person wearing the provided clothing items.`

// 将 URL 转换为 base64
async function urlToBase64(url: string): Promise<string> {
  try {
    const cleanUrl = url.trim()
    const response = await fetch(cleanUrl)
    if (!response.ok) {
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
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return await urlToBase64(image)
  } else if (image.startsWith('data:')) {
    return image.replace(/^data:image\/\w+;base64,/, '')
  }
  return image
}

// 生成单张图片
async function generateImage(
  client: ReturnType<typeof getGenAIClient>,
  personImageBase64: string,
  clothingImagesBase64: string[],
  userPrompt: string,
  imageIndex: number
): Promise<{ success: boolean; imageData?: string; error?: string }> {
  try {
    // 构建 prompt
    const finalPrompt = TRY_ON_PROMPT.replace('{{user_prompt}}', userPrompt || 'No additional instructions.')

    // 构建内容数组
    const parts: any[] = [
      { text: finalPrompt },
      { text: '\n\n[Person Photo]:' },
      { inlineData: { mimeType: 'image/jpeg', data: personImageBase64 } },
    ]

    // 添加所有服装图片
    clothingImagesBase64.forEach((clothingBase64, idx) => {
      parts.push({ text: `\n\n[Clothing Item ${idx + 1}]:` })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: clothingBase64 } })
    })

    parts.push({ text: `\n\nGenerate try-on result image ${imageIndex + 1}:` })

    console.log(`[Try-on] Generating image ${imageIndex + 1}...`)
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const imageData = extractImage(response)

    if (!imageData) {
      console.error(`[Try-on] No image data in response for image ${imageIndex + 1}`)
      return { success: false, error: 'No image generated' }
    }

    console.log(`[Try-on] Image ${imageIndex + 1} generated successfully`)
    return { success: true, imageData }
  } catch (error: any) {
    console.error(`[Try-on] Error generating image ${imageIndex + 1}:`, error.message)
    return { success: false, error: error.message }
  }
}

export async function POST(request: NextRequest) {
  // 验证用户
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id

  // 创建 SSE 流
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const sendEvent = async (event: string, data: any) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  // 异步处理生成
  ;(async () => {
    try {
      const body = await request.json()
      const { personImage, clothingImages, prompt, generationId } = body

      // 验证输入
      if (!personImage) {
        await sendEvent('error', { message: 'Person image is required' })
        await writer.close()
        return
      }

      if (!clothingImages || clothingImages.length === 0) {
        await sendEvent('error', { message: 'At least one clothing image is required' })
        await writer.close()
        return
      }

      await sendEvent('progress', { step: 'preparing', message: 'Preparing images...' })

      // 转换图片为 base64
      const personImageBase64 = await ensureBase64Data(personImage)
      if (!personImageBase64) {
        await sendEvent('error', { message: 'Failed to process person image' })
        await writer.close()
        return
      }

      const clothingImagesBase64: string[] = []
      for (const clothing of clothingImages) {
        const base64 = await ensureBase64Data(clothing)
        if (base64) {
          clothingImagesBase64.push(base64)
        }
      }

      if (clothingImagesBase64.length === 0) {
        await sendEvent('error', { message: 'Failed to process clothing images' })
        await writer.close()
        return
      }

      await sendEvent('progress', { step: 'generating', message: 'Generating try-on images...' })

      // 获取 GenAI 客户端
      const client = getGenAIClient()

      // 生成 2 张图片
      const results: string[] = []
      for (let i = 0; i < 2; i++) {
        await sendEvent('progress', { 
          step: 'generating', 
          message: `Generating image ${i + 1}/2...`,
          current: i + 1,
          total: 2
        })

        const result = await generateImage(
          client,
          personImageBase64,
          clothingImagesBase64,
          prompt || '',
          i
        )

        if (result.success && result.imageData) {
          // 上传到存储
          const imageUrl = await uploadImageToStorage(result.imageData, userId, 'try_on')
          if (imageUrl) {
            results.push(imageUrl)
            
            // 如果有 generationId，追加到生成记录
            if (generationId) {
              await appendImageToGeneration({
                taskId: generationId,
                userId,
                imageIndex: i,
                imageUrl,
                modelType: 'pro',
                genMode: 'simple',
                taskType: 'try_on',
              })
            }

            await sendEvent('image', { 
              index: i, 
              url: imageUrl,
              total: 2
            })
          }
        } else {
          console.error(`[Try-on] Failed to generate image ${i + 1}:`, result.error)
        }
      }

      if (results.length === 0) {
        await sendEvent('error', { message: 'Failed to generate any images' })
      } else {
        // 后端统一更新任务状态（不依赖前端）
        if (generationId) {
          await finalizeTaskStatus(generationId, userId, results.length)
        }
        
        await sendEvent('complete', { 
          images: results,
          count: results.length
        })
      }

      await writer.close()
    } catch (error: any) {
      console.error('[Try-on] Error:', error)
      await sendEvent('error', { message: error.message || 'Unknown error' })
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

