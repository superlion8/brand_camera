import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { buildEditPrompt, EDIT_PROMPT_PREFIX } from '@/prompts'
import { generateId } from '@/lib/utils'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'
import { requireAuth } from '@/lib/auth'
import { imageToBase64 } from '@/lib/presets/serverPresets'

export const maxDuration = 300 // 5 minutes (Pro plan)

// 确保图片数据是 base64 格式
async function ensureBase64Data(image: string): Promise<string> {
  const result = await imageToBase64(image)
  return result || ''
}

// Model name
const IMAGE_MODEL = 'gemini-3-pro-image-preview'

// Supported aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
// Supported resolutions: 1K, 2K, 4K
type Resolution = '1K' | '2K' | '4K'

interface ImageResult {
  image: string
  model: 'pro'
}

interface GenerationOptions {
  aspectRatio?: AspectRatio
  resolution?: Resolution
}

async function generateImage(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string,
  options?: GenerationOptions
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  // Build config for gemini-3-pro-image-preview
  const config: any = {
    responseModalities: ['IMAGE'],
    safetySettings,
  }
  
  // Add aspectRatio if specified
  if (options?.aspectRatio) {
    config.aspectRatio = options.aspectRatio
  }
  
  // Add imageSize (1K, 2K, 4K)
  config.imageSize = options?.resolution || '1K'
  
  console.log(`[${label}] Config: aspectRatio=${options?.aspectRatio}, imageSize=${config.imageSize}`)
  
  try {
    console.log(`[${label}] Calling ${IMAGE_MODEL}...`)
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config,
    })
    
    const result = extractImage(response)
    if (result) {
      console.log(`[${label}] Success in ${Date.now() - startTime}ms`)
      return { image: result, model: 'pro' }
    }
    console.error(`[${label}] No image in response`)
    return null
  } catch (err: any) {
    console.error(`[${label}] Failed: ${err?.message}`)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Check authentication (supports Cookie and Bearer token)
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  const userId = authResult.user.id
  
  try {
    const body = await request.json()
    const { 
      inputImage,  // 兼容旧版单图
      inputImages, // 新版多图支持
      modelImage, 
      modelStyle, 
      modelGender, 
      backgroundImage, 
      vibeImage, 
      customPrompt,
      taskId, // 任务 ID，用于数据库写入
      aspectRatio, // 宽高比: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
      resolution,  // 分辨率: '1K' | '2K' | '4K'
    } = body
    
    // 兼容处理：支持单图 inputImage 和多图 inputImages
    const images: string[] = inputImages || (inputImage ? [inputImage] : [])
    
    if (images.length === 0) {
      return NextResponse.json({ success: false, error: '缺少输入图片' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    
    // Build prompt with image reference support for multi-image
    let prompt = ''
    const imageCount = images.length
    
    if (customPrompt) {
      // 多图时添加引用说明前缀
      if (imageCount > 1) {
        const imageRefs = images.map((_, i) => `图${i + 1}`).join('、')
        prompt = `${EDIT_PROMPT_PREFIX}

以下是用户提供的 ${imageCount} 张图片，分别标记为：${imageRefs}。
用户可以在指令中用"图1"、"图2"等来引用对应的图片。

用户指令：${customPrompt}`
      } else {
        prompt = EDIT_PROMPT_PREFIX + customPrompt
      }
    } else {
      prompt = buildEditPrompt({
        hasModel: !!modelImage,
        modelStyle,
        modelGender,
        hasBackground: !!backgroundImage,
        hasVibe: !!vibeImage,
      })
    }
    
    const parts: any[] = []
    
    // Add model reference image first if provided
    if (modelImage) {
      const modelData = await ensureBase64Data(modelImage)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: modelData,
        },
      })
    }
    
    // Add prompt
    parts.push({ text: prompt })
    
    // Add all input images with labels (convert URL to base64 if needed)
    for (let i = 0; i < images.length; i++) {
      const inputData = await ensureBase64Data(images[i])
      // Add image label for multi-image case
      if (imageCount > 1) {
        parts.push({ text: `\n[图${i + 1}]:` })
      }
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: inputData,
        },
      })
    }
    
    // Add background reference
    if (backgroundImage) {
      const bgData = await ensureBase64Data(backgroundImage)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: bgData,
        },
      })
    }
    
    // Add vibe reference
    if (vibeImage) {
      const vibeData = await ensureBase64Data(vibeImage)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: vibeData,
        },
      })
    }
    
    console.log(`[Edit] Generating edited image with ${images.length} input image(s), aspectRatio=${aspectRatio}, resolution=${resolution}...`)
    const result = await generateImage(client, parts, 'Edit', {
      aspectRatio: aspectRatio as AspectRatio | undefined,
      resolution: (resolution || '1K') as Resolution,
    })
    const duration = Date.now() - startTime
    
    if (!result) {
      // 标记失败
      if (taskId) {
        await markImageFailed({
          taskId,
        userId,
          imageIndex: 0,
          error: 'RESOURCE_BUSY',
        })
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY' 
      }, { status: 503 })
    }
    
    console.log(`[Edit] Generated in ${duration}ms, uploading to storage...`)
    
    const base64Image = `data:image/png;base64,${result.image}`
    let uploadedUrl = base64Image
    const generationId = taskId || generateId()
    
    // 上传到 Storage
    const storageUrl = await uploadImageToStorage(base64Image, userId, 'edit_0')
    if (storageUrl) {
      uploadedUrl = storageUrl
      console.log('[Edit] Successfully uploaded to storage')
      
      // 写入数据库
      if (taskId) {
        // 上传所有输入图到存储，获取 URL 列表
        const inputImageUrls: string[] = []
        for (let i = 0; i < images.length; i++) {
          const img = images[i]
          if (img?.startsWith('http')) {
            inputImageUrls.push(img)
          } else if (img) {
            const inputUrl = await uploadImageToStorage(
              img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
              userId,
              `edit_input_${i}`
            )
            if (inputUrl) inputImageUrls.push(inputUrl)
          }
        }
        
        const saveResult = await appendImageToGeneration({
          taskId,
          userId,
          imageIndex: 0,
          imageUrl: storageUrl,
          modelType: result.model,
          genMode: 'extended',
          prompt: prompt,
          taskType: 'edit',
          inputImageUrl: inputImageUrls[0], // 第一张图存到 input_image_url
          inputParams: {
            modelStyle,
            modelGender,
            customPrompt,
            inputImageCount: images.length,
            inputImages: inputImageUrls, // 所有输入图 URL 存到 inputParams
            hasModel: !!modelImage,
            hasBackground: !!backgroundImage,
            hasVibe: !!vibeImage,
            aspectRatio,
            resolution,
          },
        })
        
        if (saveResult.success) {
          console.log(`[Edit] Saved to database, dbId: ${saveResult.dbId}, inputImages: ${images.length}`)
        } else {
          console.warn('[Edit] Failed to save to database')
        }
      }
    } else {
      console.warn('[Edit] Upload failed, returning base64')
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`[Edit] Completed in ${totalDuration}ms`)
    
    return NextResponse.json({
      success: true,
      image: uploadedUrl,
      modelType: result.model,
      generationId,
      savedToDb: !!taskId,
    })
    
  } catch (error: any) {
    console.error('[Edit] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '编辑失败' 
    }, { status: 500 })
  }
}
