import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage } from '@/lib/genai'
import { createClient } from '@supabase/supabase-js'

// Together AI API base URL
const TOGETHER_API_BASE = 'https://api.together.ai/v1'

// Lazy initialize supabase
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

// Helper to convert image URL or base64 to base64 data
async function getImageBase64(imageSource: string): Promise<{ data: string; mimeType: string }> {
  if (imageSource.startsWith('data:')) {
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      return { mimeType: match[1], data: match[2] }
    }
  }
  
  const response = await fetch(imageSource)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  
  return { data: base64, mimeType }
}

// Upload image to Supabase
async function uploadImageToSupabase(base64Data: string, mimeType: string): Promise<string> {
  const supabase = getSupabase()
  const buffer = Buffer.from(base64Data, 'base64')
  const extension = mimeType.includes('png') ? 'png' : 'jpg'
  const filename = `brand-style/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, buffer, { contentType: mimeType, upsert: false })
  
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage.from('generations').getPublicUrl(filename)
  return urlData.publicUrl
}

// Upload video to Supabase
async function uploadVideoToSupabase(videoData: Buffer, mimeType: string): Promise<string> {
  const supabase = getSupabase()
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, videoData, { contentType: mimeType, upsert: false })
  
  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage.from('generations').getPublicUrl(filename)
  return urlData.publicUrl
}

// Generate image using Gemini
async function generateImage(
  productImage: string,
  referenceImage: string,
  type: 'web' | 'ins' | 'product',
  brandSummary: string,
  styleKeywords: string[]
): Promise<string> {
  const [productImageData, referenceImageData] = await Promise.all([
    getImageBase64(productImage),
    getImageBase64(referenceImage)
  ])

  let prompt: string
  switch (type) {
    case 'web':
      prompt = `给第一张图片中的商品[product]生成模特展示图。

要求：
1. 保持第二张参考图[web_img_model]中的模特外貌特征和背景环境
2. 姿势微调，使其更符合[product]商品的气质
3. 穿搭要搭配适合[product]风格的服装配饰
4. 商品[product]必须清晰可见，是画面的焦点
5. 保持专业电商级别的画质和光影

品牌风格：${brandSummary || '现代、专业、高质量时尚品牌'}
关键词：${styleKeywords?.join(', ') || '专业、优雅、现代'}

生成一张高质量的官网风格模特展示图。`
      break
      
    case 'ins':
      prompt = `给第一张图片中的商品[product]生成INS风格模特展示图。

要求：
1. 保持第二张参考图中的模特外貌特征
2. 姿势微调，使其更符合[product]商品的气质
3. 背景使用参考图的空间风格，可以根据新的pose调整拍摄角度
4. 穿搭要搭配适合[product]风格的服装配饰
5. 画面要有INS/社交媒体的生活感和氛围感
6. 自然光或氛围光，色调温暖有质感

品牌风格：${brandSummary || '时尚、真实、生活方式导向'}
关键词：${styleKeywords?.join(', ') || '生活方式、真实、时尚'}

生成一张适合INS发布的生活方式模特展示图。`
      break
      
    case 'product':
      prompt = `给第一张图片中的商品[product]生成一张无模特的商品展示图。

要求：
1. 参考第二张图[web_img_product]的拍摄风格
2. 参考其光影效果和布光方式
3. 参考其背景布局和场景设计
4. 不要出现人物/模特
5. 商品是唯一的主角，清晰展示细节
6. 专业的产品摄影级别画质

品牌风格：${brandSummary || '干净、专业的产品摄影'}
关键词：${styleKeywords?.join(', ') || '干净、专业、细节'}

生成一张专业的纯商品展示图。`
      break
  }

  const genAI = getGenAIClient()
  const result = await genAI.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: productImageData.mimeType, data: productImageData.data } },
          { inlineData: { mimeType: referenceImageData.mimeType, data: referenceImageData.data } }
        ]
      }
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    }
  })

  const generatedImageBase64 = extractImage(result)
  if (!generatedImageBase64) {
    throw new Error('No image generated')
  }

  return await uploadImageToSupabase(generatedImageBase64, 'image/png')
}

// Generate video using Together AI Sora 2
async function generateVideo(prompt: string, brandSummary: string): Promise<string | null> {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) {
    console.log('[Together] No API key, skipping video generation')
    return null
  }

  const videoPrompt = `${prompt}

商品信息：展示一件时尚商品
品牌风格：${brandSummary || '现代、时尚、生活方式导向'}

视频要求：
- UGC/创作者风格 - 真实自然
- 9:16 竖版比例（适合社交媒体）
- 流畅的镜头运动
- 自然光效
- 时长 5-8 秒
- 高质量、专业感

注意：不要描述人物的穿着，专注于动作、环境和拍摄技法。`

  // Create video job
  const createResponse = await fetch(`${TOGETHER_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/sora-2',
      prompt: videoPrompt,
      seconds: '6',
      fps: 24,
      output_format: 'MP4',
    })
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Together AI error: ${createResponse.status} - ${errorText}`)
  }

  const { id: videoId } = await createResponse.json()
  console.log('[Together] Video job created:', videoId)

  // Poll for completion
  const maxAttempts = 120
  const pollInterval = 5000
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    
    const statusResponse = await fetch(`${TOGETHER_API_BASE}/videos/${videoId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    
    if (!statusResponse.ok) {
      throw new Error(`Failed to poll video status`)
    }
    
    const data = await statusResponse.json()
    
    if (data.status === 'completed') {
      const videoUrl = data.outputs?.video_url
      if (!videoUrl) throw new Error('No video URL in response')
      
      // Download and re-upload to Supabase
      const downloadResponse = await fetch(videoUrl)
      const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer())
      return await uploadVideoToSupabase(videoBuffer, 'video/mp4')
    }
    
    if (data.status === 'failed') {
      throw new Error(`Video generation failed: ${data.error?.message || 'Unknown error'}`)
    }
  }
  
  throw new Error('Video generation timed out')
}

// Task definition
interface TaskDefinition {
  id: string
  type: 'image' | 'video'
  imageType?: 'web' | 'ins' | 'product'
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const body = await request.json()
        const { analysisData } = body

        if (!analysisData) {
          send({ type: 'error', error: 'Missing analysis data' })
          controller.close()
          return
        }

        const productImage = analysisData.productImage
        const brandSummary = analysisData.summary?.summary || ''
        const styleKeywords = analysisData.summary?.styleKeywords || []

        // Build task list based on available data
        const tasks: TaskDefinition[] = []
        
        if (analysisData.productPage?.modelImage) {
          tasks.push({ id: 'web-1', type: 'image', imageType: 'web' })
          tasks.push({ id: 'web-2', type: 'image', imageType: 'web' })
        }
        
        if (analysisData.instagram?.bestModelImage) {
          tasks.push({ id: 'ins-1', type: 'image', imageType: 'ins' })
          tasks.push({ id: 'ins-2', type: 'image', imageType: 'ins' })
        }
        
        if (analysisData.productPage?.productImage) {
          tasks.push({ id: 'product', type: 'image', imageType: 'product' })
        }
        
        if (analysisData.video?.prompt) {
          tasks.push({ id: 'video', type: 'video' })
        }

        // Send initial task list
        send({ type: 'init', tasks: tasks.map(t => ({ id: t.id, title: t.title, type: t.type })) })

        const results: { images: { id: string; title: string; url: string }[]; video?: string } = { images: [] }

        // Execute tasks sequentially
        for (const task of tasks) {
          send({ type: 'progress', taskId: task.id, status: 'generating' })
          
          try {
            if (task.type === 'image' && task.imageType) {
              let referenceImage: string
              
              if (task.imageType === 'web') {
                referenceImage = analysisData.productPage.modelImage
              } else if (task.imageType === 'ins') {
                referenceImage = analysisData.instagram.bestModelImage
              } else {
                referenceImage = analysisData.productPage.productImage
              }
              
              const imageUrl = await generateImage(
                productImage,
                referenceImage,
                task.imageType,
                brandSummary,
                styleKeywords
              )
              
              results.images.push({ id: task.id, url: imageUrl })
              send({ type: 'progress', taskId: task.id, status: 'completed', result: imageUrl })
              
            } else if (task.type === 'video') {
              const videoUrl = await generateVideo(
                analysisData.video.prompt,
                brandSummary
              )
              
              if (videoUrl) {
                results.video = videoUrl
                send({ type: 'progress', taskId: task.id, status: 'completed', result: videoUrl })
              } else {
                send({ type: 'progress', taskId: task.id, status: 'error', error: 'Video generation not available' })
              }
            }
          } catch (error) {
            console.error(`[Batch] Task ${task.id} failed:`, error)
            send({ type: 'progress', taskId: task.id, status: 'error', error: (error as Error).message })
          }
        }

        // Send final results with originals for comparison
        const finalResults = {
          ...results,
          originals: {
            webModelImage: analysisData.productPage?.modelImage,
            productImage: analysisData.productPage?.productImage,
            insImage: analysisData.instagram?.bestModelImage,
            videoUrl: analysisData.video?.videoUrl,
            videoPrompt: analysisData.video?.prompt
          }
        }
        
        send({ type: 'complete', results: finalResults })
        controller.close()

      } catch (error) {
        console.error('[Batch] Error:', error)
        send({ type: 'error', error: (error as Error).message })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
