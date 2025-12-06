import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { createClient } from '@/lib/supabase/server'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'

// 将 URL 转换为 base64（服务端版本）
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    return `data:image/jpeg;base64,${base64}`
  } catch (error: any) {
    console.error('[urlToBase64] Error:', error.message)
    throw error
  }
}

export const maxDuration = 300 // 5 minutes

// 专业棚拍 Prompts
const PROMPTS = {
  // 简单模式 - 有背景
  simpleWithBg: (productPlaceholder: string) => `
为${productPlaceholder}生成高级质感全身棚拍图。模特使用提供的模特图片，背景使用提供的背景图片。

商品的质感、颜色、纹理细节、版型等必须保持严格一致。

如果服饰是半身，请你作为一个高端奢侈品品牌设计师，为模特做全身的造型搭配，你需要关注包括款式，颜色，版型的和谐和设计感。要突出高级质感。
`,
  
  // 简单模式 - 无背景（AI生成背景）
  simpleNoBg: (productPlaceholder: string) => `
为${productPlaceholder}生成高级质感全身棚拍图。模特使用提供的模特图片。

背景请你参考商品适合的风格，使用一个棚拍常用的背景。

商品的质感、颜色、纹理细节、版型等必须保持严格一致。

如果服饰是半身，请你作为一个高端奢侈品品牌设计师，为模特做全身的造型搭配，你需要关注包括款式，颜色，版型的和谐和设计感。要突出高级质感。
`,

  // 扩展模式 - 生成拍摄指令
  instructGen: (productPlaceholder: string) => `
你现在是一个专门拍摄电商商品棚拍图的职业摄影师，请你基于你要拍摄的${productPlaceholder}，和展示这个商品的模特，为这个模特选择一身合适商品风格的服装造型搭配，搭配要和谐、有风格、有高级感；

再为这个模特和这身装扮选择一个合适的影棚拍摄背景和拍摄pose，输出1段拍摄指令。

拍摄背景不要出现打光灯等拍摄设施，按成片图的标准来塑造。

请你严格用英文按照下面这个格式来写，不需要输出其他额外的东西：

{{clothing}}：

{{background}}：

{{model_pose}}：

{{Camera Position}}:

{{Composition}}：

{{Camera Setting}}：
`,

  // 扩展模式 - 根据指令生成图片（有背景）
  instructExecWithBg: (instructPrompt: string, productPlaceholder: string) => `
请为这个模特拍摄一张身穿${productPlaceholder}的专业影棚商品棚拍图。背景使用提供的背景图片。

商品的质感、颜色、纹理细节、版型等必须保持严格一致。

拍摄指令：${instructPrompt}
`,

  // 扩展模式 - 根据指令生成图片（无背景）
  instructExecNoBg: (instructPrompt: string, productPlaceholder: string) => `
请为这个模特拍摄一张身穿${productPlaceholder}的专业影棚商品棚拍图。

商品的质感、颜色、纹理细节、版型等必须保持严格一致。

拍摄指令：${instructPrompt}
`,
}

// 模型配置
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'
const VLM_MODEL = 'gemini-3-pro-preview' // 用于生成拍摄指令

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productImage, // 单个商品（向后兼容）
      productImages, // 多个商品数组
      modelImage,
      backgroundImage, // 可选，用户选择了才有
      mode, // 'simple' | 'extended'
      index = 0,
      taskId,
      // 模特/背景信息（用于保存到数据库）
      modelIsRandom = true,
      bgIsRandom = true,
      modelName = '专业模特',
      bgName = '影棚背景',
      modelUrl,
      bgUrl,
      modelIsPreset = true,
      bgIsPreset = true,
    } = body
    
    // 支持多商品：优先使用 productImages，如果没有则使用 productImage
    const products = productImages && Array.isArray(productImages) && productImages.length > 0 
      ? productImages 
      : productImage 
        ? [productImage] 
        : []
    
    if (products.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少商品图片数据',
        index,
        modelType: null,
      }, { status: 400 })
    }
    
    // 生成商品占位符：{{product1}}/{{product2}}/.../{{productn}}
    const productPlaceholder = products.length === 1 
      ? '这个商品' 
      : products.map((_, i) => `{{product${i + 1}}}`).join('/')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const startTime = Date.now()
    const hasBg = !!backgroundImage
    const label = `[ProStudio-${mode}${hasBg ? '+bg' : ''}-${index}]`

    console.log(`${label} Starting generation...`)
    console.log(`${label} products count: ${products.length}`)
    console.log(`${label} modelImage: ${modelImage ? `${modelImage.substring(0, 50)}...` : 'null/undefined'}`)
    console.log(`${label} backgroundImage: ${backgroundImage ? `${backgroundImage.substring(0, 50)}...` : 'none (AI will generate)'}`)

    const genai = getGenAIClient()
    let result: { image: string; model: 'pro' | 'flash' } | null = null
    let usedPrompt = ''
    let generationMode: 'simple' | 'extended' = mode === 'extended' ? 'extended' : 'simple'

    // 准备所有商品图片数据 - 如果是 URL，先转换为 base64
    const productImagesData: string[] = []
    for (const product of products) {
      let productImageData: string
      if (product?.startsWith('http://') || product?.startsWith('https://')) {
        const base64Data = await urlToBase64(product)
        productImageData = base64Data.split(',')[1]
      } else if (product?.startsWith('data:')) {
        productImageData = product.split(',')[1]
      } else {
        productImageData = product
      }
      productImagesData.push(productImageData)
    }
    
    if (productImagesData.length === 0) {
      console.error(`${label} Missing productImagesData`)
      return NextResponse.json({ 
        success: false, 
        error: '缺少商品图片数据',
        index,
        modelType: null,
      }, { status: 400 })
    }

    let modelImageData: string
    if (modelImage?.startsWith('http://') || modelImage?.startsWith('https://')) {
      const base64Data = await urlToBase64(modelImage)
      modelImageData = base64Data.split(',')[1]
    } else if (modelImage?.startsWith('data:')) {
      modelImageData = modelImage.split(',')[1]
    } else {
      modelImageData = modelImage
    }

    let bgImageData: string | undefined
    if (backgroundImage) {
      if (backgroundImage.startsWith('http://') || backgroundImage.startsWith('https://')) {
        const base64Data = await urlToBase64(backgroundImage)
        bgImageData = base64Data.split(',')[1]
      } else if (backgroundImage.startsWith('data:')) {
        bgImageData = backgroundImage.split(',')[1]
      } else {
        bgImageData = backgroundImage
      }
    }

    // 验证必需的图片数据
    if (productImagesData.length === 0) {
      console.error(`${label} Missing productImagesData`)
      return NextResponse.json({ 
        success: false, 
        error: '缺少商品图片数据',
        index,
        modelType: null,
      }, { status: 400 })
    }

    if (!modelImageData) {
      console.error(`${label} Missing modelImageData`)
      return NextResponse.json({ 
        success: false, 
        error: '缺少模特图片数据',
        index,
        modelType: null,
      }, { status: 400 })
    }

    // Helper function to generate with fallback
    const generateWithFallback = async (contents: any[]): Promise<{ image: string; model: 'pro' | 'flash' } | null> => {
      // Try primary model
      try {
        console.log(`${label} Trying ${PRIMARY_IMAGE_MODEL}...`)
        const response = await genai.models.generateContent({
          model: PRIMARY_IMAGE_MODEL,
          contents: [{ role: 'user', parts: contents }],
          config: {
            responseModalities: ['IMAGE'],
            safetySettings,
            imageSize: '2K',
          } as any,
        })

        const imageData = extractImage(response)
        if (imageData) {
          console.log(`${label} Success with ${PRIMARY_IMAGE_MODEL}`)
          return { image: imageData, model: 'pro' }
        }
        throw new Error('No image in response')
      } catch (error: any) {
        console.error(`${label} Primary model failed:`, error.message)
      }

      // Fallback
      try {
        console.log(`${label} Trying fallback ${FALLBACK_IMAGE_MODEL}...`)
        const response = await genai.models.generateContent({
          model: FALLBACK_IMAGE_MODEL,
          contents: [{ role: 'user', parts: contents }],
          config: {
            responseModalities: ['IMAGE'],
            safetySettings,
          },
        })
        
        const imageData = extractImage(response)
        if (imageData) {
          console.log(`${label} Success with fallback`)
          return { image: imageData, model: 'flash' }
        }
      } catch (fallbackError: any) {
        console.error(`${label} Fallback model also failed:`, fallbackError.message)
      }

      return null
    }

    if (mode === 'simple') {
      // 简单模式：根据是否有背景选择不同的 prompt
      usedPrompt = hasBg ? PROMPTS.simpleWithBg(productPlaceholder) : PROMPTS.simpleNoBg(productPlaceholder)
      
      const contents = [
        { text: usedPrompt },
        // 添加所有商品图片
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
      ]
      
      // 如果有背景图，添加到 contents
      if (bgImageData) {
        contents.push({ inlineData: { mimeType: 'image/jpeg', data: bgImageData } })
      }

      result = await generateWithFallback(contents)

    } else if (mode === 'extended') {
      // 扩展模式：先生成拍摄指令，再生成图片
      generationMode = 'extended'
      
      // Step 1: 生成拍摄指令
      const instructContents = [
        { text: PROMPTS.instructGen(productPlaceholder) },
        // 添加所有商品图片
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
      ]

      let instructPrompt = ''
      try {
        console.log(`${label} Generating instruct prompt with ${VLM_MODEL}...`)
        const instructResponse = await genai.models.generateContent({
          model: VLM_MODEL,
          contents: [{ role: 'user', parts: instructContents }],
          config: {
            safetySettings,
          },
        })
        instructPrompt = extractText(instructResponse) || ''
        console.log(`${label} Generated instruct prompt:`, instructPrompt.substring(0, 200))
      } catch (error: any) {
        console.error(`${label} Failed to generate instruct:`, error.message)
        instructPrompt = 'Professional studio shot with elegant pose and soft lighting.'
      }

      // Step 2: 根据指令生成图片
      usedPrompt = hasBg ? PROMPTS.instructExecWithBg(instructPrompt, productPlaceholder) : PROMPTS.instructExecNoBg(instructPrompt, productPlaceholder)
      
      const execContents = [
        { text: usedPrompt },
        // 添加所有商品图片
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
      ]
      
      // 如果有背景图，添加到 contents
      if (bgImageData) {
        execContents.push({ inlineData: { mimeType: 'image/jpeg', data: bgImageData } })
      }

      result = await generateWithFallback(execContents)
    }

    const duration = Date.now() - startTime

    if (!result) {
      console.error(`${label} Generation failed after ${duration}ms`)
      return NextResponse.json(
        { success: false, error: 'RESOURCE_BUSY', index },
        { status: 503 }
      )
    }

    console.log(`${label} Generated in ${duration}ms using ${result.model}`)

    // 必须有 taskId 才能上传
    if (!taskId) {
      console.error(`${label} No taskId provided, cannot upload`)
      return NextResponse.json({
        success: false,
        error: '缺少任务ID',
        index,
      }, { status: 400 })
    }

    // 上传到 Storage（必须成功）
    const base64Image = `data:image/png;base64,${result.image}`
    const uploaded = await uploadImageToStorage(base64Image, userId, `prostudio_${taskId}_${index}`)
    
    if (!uploaded) {
      console.error(`${label} Failed to upload image to storage`)
      return NextResponse.json({
        success: false,
        error: '图片上传失败，请重试',
        index,
      }, { status: 500 })
    }

    console.log(`${label} Uploaded to storage: ${uploaded.substring(0, 80)}...`)
    
    // 只在第一张图时上传输入图片（避免重复上传）
    let inputImageUrlToSave: string | undefined
    let productImageUrlsToSave: string[] = []
    let modelImageUrlToSave: string | undefined
    let bgImageUrlToSave: string | undefined
    
    if (index === 0) {
      // 上传所有商品图
      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        if (product) {
          const productUrl = await uploadImageToStorage(product, userId, `prostudio_${taskId}_product${i + 1}`)
          if (productUrl) {
            productImageUrlsToSave.push(productUrl)
            // 第一张商品图作为主输入图
            if (i === 0) inputImageUrlToSave = productUrl
          }
        }
      }
      // 上传模特图
      if (modelImage) {
        const uploadedModelUrl = await uploadImageToStorage(modelImage, userId, `prostudio_${taskId}_model`)
        if (uploadedModelUrl) modelImageUrlToSave = uploadedModelUrl
      }
      // 上传背景图（如果有）
      if (backgroundImage) {
        const uploadedBgUrl = await uploadImageToStorage(backgroundImage, userId, `prostudio_${taskId}_bg`)
        if (uploadedBgUrl) bgImageUrlToSave = uploadedBgUrl
      }
    }
    
    // 保存到数据库
    await appendImageToGeneration({
      taskId,
      userId,
      imageIndex: index,
      imageUrl: uploaded,
      modelType: result.model,
      genMode: generationMode,
      prompt: usedPrompt,
      taskType: 'pro_studio',
      inputImageUrl: inputImageUrlToSave,
      inputParams: index === 0 ? {
        // 商品原图也保存到 inputParams（支持多商品）
        productImage: inputImageUrlToSave, // 第一张商品图作为主图
        productImages: productImageUrlsToSave, // 所有商品图
        modelImage: modelImageUrlToSave || modelUrl,
        backgroundImage: bgImageUrlToSave || bgUrl,
        hasBg,
        mode,
        // 保存模特/背景选择信息
        model: modelName,
        background: bgName,
        modelIsUserSelected: !modelIsRandom,
        bgIsUserSelected: !bgIsRandom,
        perImageModels: [{
          name: modelName,
          imageUrl: modelImageUrlToSave || modelUrl,
          isRandom: modelIsRandom,
          isPreset: modelIsRandom ? true : modelIsPreset,
        }],
        perImageBackgrounds: hasBg ? [{
          name: bgName,
          imageUrl: bgImageUrlToSave || bgUrl,
          isRandom: bgIsRandom,
          isPreset: bgIsRandom ? true : bgIsPreset,
        }] : [],
      } : undefined,
    })

    return NextResponse.json({
      success: true,
      image: uploaded,
      index,
      modelType: result.model,
      genMode: generationMode,
      prompt: usedPrompt,
      duration,
    })

  } catch (error: any) {
    console.error('[ProStudio] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Generation failed' },
      { status: 500 }
    )
  }
}
