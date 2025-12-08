import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { createClient } from '@/lib/supabase/server'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'

// 将 URL 转换为 base64（服务端版本，带重试）
async function urlToBase64(url: string, maxRetries = 2): Promise<string> {
  const cleanUrl = url.trim()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[urlToBase64] Attempt ${attempt}/${maxRetries}, Fetching:`, cleanUrl.substring(0, 100) + '...')
      
      const response = await fetch(cleanUrl, {
        // 添加超时控制
        signal: AbortSignal.timeout(30000), // 30秒超时
      })
      
      if (!response.ok) {
        console.error(`[urlToBase64] HTTP Error (attempt ${attempt}):`, response.status, response.statusText, 'URL:', cleanUrl)
        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }
        // 等待一小段时间后重试
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
        continue
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      console.log('[urlToBase64] Success, base64 length:', base64.length)
      return `data:image/jpeg;base64,${base64}`
    } catch (error: any) {
      console.error(`[urlToBase64] Error (attempt ${attempt}):`, error.message, 'URL:', cleanUrl.substring(0, 100))
      if (attempt === maxRetries) {
        throw error
      }
      // 等待一小段时间后重试
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  
  throw new Error('Failed to fetch image after all retries')
}

export const maxDuration = 300 // 5 minutes

// 构建服装描述（只列出非空的部分）
function buildOutfitDescription(outfitItems: OutfitItems): string {
  const items: string[] = []
  if (outfitItems.inner) items.push('{{内衬}}')
  if (outfitItems.top) items.push('{{上衣}}')
  if (outfitItems.pants) items.push('{{裤子}}')
  if (outfitItems.hat) items.push('{{帽子}}')
  if (outfitItems.shoes) items.push('{{鞋子}}')
  return items.join('、')
}

// 服装项类型
interface OutfitItems {
  inner?: string   // 内衬
  top?: string     // 上衣
  pants?: string   // 裤子
  hat?: string     // 帽子
  shoes?: string   // 鞋子
}

// 专业棚拍 Prompts - 优化版本
const PROMPTS = {
  // 极简模式 - 有背景
  simpleWithBg: (outfitDesc: string) => `
你是一位顶级时尚商业摄影师。请基于提供的参考图：{{model}}（模特）以及商品图：${outfitDesc}，拍摄一张极具质感的全身商业棚拍大片。

【核心要求】

1. 商品还原（最高优先级）：必须严格保留上传商品图的材质、颜色、Logo、纹理细节和版型。不要改变商品原本的设计。

2. 造型补全：如果用户只上传了部分衣物，请根据已上传商品的风格（街头/商务/休闲等），自动搭配缺失部分的衣物，确保整体造型和谐、时尚且符合模特气质。

3. 背景与光影：请使用提供的{{background}}完美融合。使用专业布光（如蝴蝶光或伦布朗光），强调衣物的面料质感和模特的轮廓。

4. 构图：全身照，构图饱满。

5. 负向约束：画面中严禁出现柔光箱、三脚架、灯架等任何摄影棚设备。背景必须干净。

请直接生成最终成片。
`,
  
  // 极简模式 - 无背景（AI生成背景）
  simpleNoBg: (outfitDesc: string) => `
你是一位顶级时尚商业摄影师。请基于提供的参考图：{{model}}（模特）以及商品图：${outfitDesc}，拍摄一张极具质感的全身商业棚拍大片。

【核心要求】

1. 商品还原（最高优先级）：必须严格保留上传商品图的材质、颜色、Logo、纹理细节和版型。不要改变商品原本的设计。

2. 造型补全：如果用户只上传了部分衣物，请根据已上传商品的风格（街头/商务/休闲等），自动搭配缺失部分的衣物，确保整体造型和谐、时尚且符合模特气质。

3. 背景与光影：请根据服装风格生成一个纯净、高级的商业影棚背景。使用专业布光（如蝴蝶光或伦布朗光），强调衣物的面料质感和模特的轮廓。

4. 构图：全身照，构图饱满。

5. 负向约束：画面中严禁出现柔光箱、三脚架、灯架等任何摄影棚设备。背景必须干净。

请直接生成最终成片。
`,

  // 扩展模式 - 生成拍摄指令（英文输出更稳定）
  instructGen: (outfitDesc: string) => `
You are a Creative Director for a high-end fashion e-commerce brand.

Your task is to design a photography plan based on the uploaded product images: ${outfitDesc} and the model: {{model}}.

Analyze the style, material, and vibe of the products.

1. Styling: If some clothing items are missing, define what the model should wear to complement the uploaded items perfectly.

2. Atmosphere: Decide on the lighting mood and background suitable for these specific items.

3. Posing: Suggest a pose that highlights the best features of clothes.

Strictly, no studio equipment (such as softboxes, tripods, or light stands) should be visible in the frame. The background must be clean.

Output strictly in English using the following format. Do not output any intro/outro text:

{{clothing}}: [Describe the styling details for any missing items to complete the look. E.g., "White crew socks, silver minimalistic rings"]

{{background}}: [Describe the studio setting, color palette, and texture.]

{{model_pose}}: [Describe the pose precisely. E.g., "Standing slightly sideways, hands in pockets, looking away from camera"]

{{Camera Position}}: [E.g., "Eye-level", "Low angle"]

{{Composition}}: [E.g., "Full body shot, centered"]

{{Lighting}}: [Describe the lighting setup. E.g., "Softbox lighting from left, high contrast"]
`,

  // 扩展模式 - 根据指令生成图片（有背景）
  instructExecWithBg: (instructPrompt: string, outfitDesc: string) => `
你是一台执行力极高的AI图像生成引擎。请根据以下指令和视觉输入生成一张专业级时尚电商棚拍图。

【视觉输入】
- 模特参考：{{model}}
- 必须穿着的商品：${outfitDesc}
- 背景参考：{{background}}

【执行指令】
${instructPrompt}

【严格约束】
1. 所见即所得：上传的商品图片是绝对真理。必须100%保留其版型、图案、褶皱逻辑和材质反光属性。严禁"重新设计"或"幻觉"出不存在的细节。

2. 融合度：模特穿着商品时，必须呈现自然的布料物理垂坠感和身体包裹感（Fit & Drape），不能看起来像是简单的贴图。

3. 纯净度：画面仅包含模特和环境，严禁出现任何摄影器材（灯架、相机、反光板等）。

4. 画质：8k分辨率，超高清，锐利的焦点，真实的皮肤纹理。

5. 负向约束：画面中严禁出现柔光箱、三脚架、灯架等任何摄影棚设备。背景必须干净。

开始生成。
`,

  // 扩展模式 - 根据指令生成图片（无背景）
  instructExecNoBg: (instructPrompt: string, outfitDesc: string) => `
你是一台执行力极高的AI图像生成引擎。请根据以下指令和视觉输入生成一张专业级时尚电商棚拍图。

【视觉输入】
- 模特参考：{{model}}
- 必须穿着的商品：${outfitDesc}

【执行指令】
${instructPrompt}

【严格约束】
1. 所见即所得：上传的商品图片是绝对真理。必须100%保留其版型、图案、褶皱逻辑和材质反光属性。严禁"重新设计"或"幻觉"出不存在的细节。

2. 融合度：模特穿着商品时，必须呈现自然的布料物理垂坠感和身体包裹感（Fit & Drape），不能看起来像是简单的贴图。

3. 纯净度：画面仅包含模特和环境，严禁出现任何摄影器材（灯架、相机、反光板等）。

4. 画质：8k分辨率，超高清，锐利的焦点，真实的皮肤纹理。

5. 负向约束：画面中严禁出现柔光箱、三脚架、灯架等任何摄影棚设备。背景必须干净。

开始生成。
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
      productImages, // 多个商品数组（向后兼容）
      // 新的服装项格式
      outfitItems, // { inner?, top?, pants?, hat?, shoes? }
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
    
    // 解析服装项（支持新旧两种格式）
    let outfit: OutfitItems = {}
    let products: string[] = []
    
    if (outfitItems && typeof outfitItems === 'object') {
      // 新格式：独立的服装项
      outfit = outfitItems as OutfitItems
      // 收集非空的服装项到 products 数组（保持顺序：内衬、上衣、裤子、帽子、鞋子）
      if (outfit.inner) products.push(outfit.inner)
      if (outfit.top) products.push(outfit.top)
      if (outfit.pants) products.push(outfit.pants)
      if (outfit.hat) products.push(outfit.hat)
      if (outfit.shoes) products.push(outfit.shoes)
    } else {
      // 旧格式：productImages 或 productImage
      products = productImages && Array.isArray(productImages) && productImages.length > 0 
        ? productImages 
        : productImage 
          ? [productImage] 
          : []
    }
    
    if (products.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少商品图片数据',
        index,
        modelType: null,
      }, { status: 400 })
    }
    
    // 生成服装描述（用于 prompt）
    const outfitDescription = buildOutfitDescription(outfit)

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
      if (!product) {
        console.warn(`${label} Skipping empty product`)
        continue
      }
      let productImageData: string
      if (product.startsWith('http://') || product.startsWith('https://')) {
        console.log(`${label} Converting product URL to base64:`, product.substring(0, 80))
        const base64Data = await urlToBase64(product)
        productImageData = base64Data.split(',')[1]
      } else if (product.startsWith('data:')) {
        productImageData = product.split(',')[1]
      } else {
        // 假设是纯 base64
        productImageData = product
      }
      if (productImageData && productImageData.length > 100) {
        productImagesData.push(productImageData)
      } else {
        console.warn(`${label} Skipping invalid product data, length:`, productImageData?.length || 0)
      }
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

    let modelImageData: string = ''
    if (modelImage) {
      if (modelImage.startsWith('http://') || modelImage.startsWith('https://')) {
        console.log(`${label} Converting model URL to base64:`, modelImage.substring(0, 80))
        const base64Data = await urlToBase64(modelImage)
        modelImageData = base64Data.split(',')[1]
      } else if (modelImage.startsWith('data:')) {
        modelImageData = modelImage.split(',')[1]
      } else {
        modelImageData = modelImage
      }
    }

    let bgImageData: string | undefined
    if (backgroundImage) {
      if (backgroundImage.startsWith('http://') || backgroundImage.startsWith('https://')) {
        console.log(`${label} Converting background URL to base64:`, backgroundImage.substring(0, 80))
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
      // 极简模式：根据是否有背景选择不同的 prompt
      // 如果没有服装描述（旧格式兼容），使用默认描述
      const effectiveOutfitDesc = outfitDescription || '这些商品'
      usedPrompt = hasBg ? PROMPTS.simpleWithBg(effectiveOutfitDesc) : PROMPTS.simpleNoBg(effectiveOutfitDesc)
      
      const contents: any[] = [
        { text: usedPrompt },
        // 先添加模特图片（对应 prompt 中的 {{model}}）
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
        // 再按顺序添加服装图片（对应 prompt 中的 {{内衬}}、{{上衣}}、{{裤子}}、{{帽子}}、{{鞋子}}）
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
      ]
      
      // 如果有背景图，添加到 contents（对应 prompt 中的 {{background}}）
      if (bgImageData) {
        contents.push({ inlineData: { mimeType: 'image/jpeg', data: bgImageData } })
      }

      result = await generateWithFallback(contents)

    } else if (mode === 'extended') {
      // 扩展模式：先生成拍摄指令，再生成图片
      generationMode = 'extended'
      const effectiveOutfitDesc = outfitDescription || '这些商品'
      
      // Step 1: 生成拍摄指令
      const instructContents: any[] = [
        { text: PROMPTS.instructGen(effectiveOutfitDesc) },
        // 先添加模特图片
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
        // 再添加所有服装图片
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
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
      usedPrompt = hasBg ? PROMPTS.instructExecWithBg(instructPrompt, effectiveOutfitDesc) : PROMPTS.instructExecNoBg(instructPrompt, effectiveOutfitDesc)
      
      const execContents: any[] = [
        { text: usedPrompt },
        // 先添加模特图片
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },
        // 再添加服装图片
        ...productImagesData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
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
