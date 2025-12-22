import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { PRODUCT_PROMPT, buildInstructPrompt, buildModelPrompt } from '@/prompts'
import { stripBase64Prefix } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { uploadImageToStorage, appendImageToGeneration, markImageFailed } from '@/lib/supabase/generationService'
import { 
  getRandomPresetBase64, 
  imageToBase64 
} from '@/lib/presets/serverPresets'

export const maxDuration = 300 // 5 minutes (Pro plan) - includes image upload

// 确保图片数据是 base64 格式（支持 URL 和 base64 输入）
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  return await imageToBase64(image)
}

// Model names
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'
const VLM_MODEL = 'gemini-3-pro-preview'

// Retry config - Pro 失败直接降级，不重试
const PRIMARY_RETRY_COUNT = 0
const PRIMARY_RETRY_DELAY_MS = 0

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRateLimitError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || ''
  return msg.includes('429') || 
         msg.includes('rate') || 
         msg.includes('quota') ||
         msg.includes('exhausted') ||
         msg.includes('resource')
}

interface ImageResult {
  image: string
  model: 'pro' | 'flash'
}

async function generateImageWithFallback(
  client: ReturnType<typeof getGenAIClient>,
  parts: any[],
  label: string
): Promise<ImageResult | null> {
  const startTime = Date.now()
  
  for (let attempt = 0; attempt <= PRIMARY_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${label}] Retry ${attempt}/${PRIMARY_RETRY_COUNT}...`)
        await delay(PRIMARY_RETRY_DELAY_MS * attempt)
      }
      
      console.log(`[${label}] Trying ${PRIMARY_IMAGE_MODEL}...`)
      const response = await client.models.generateContent({
        model: PRIMARY_IMAGE_MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          safetySettings,
        },
      })
      
      const result = extractImage(response)
      if (result) {
        console.log(`[${label}] Success with ${PRIMARY_IMAGE_MODEL} in ${Date.now() - startTime}ms`)
        return { image: result, model: 'pro' }
      }
      throw new Error('No image in response')
    } catch (err: any) {
      console.log(`[${label}] ${PRIMARY_IMAGE_MODEL} failed: ${err?.message}`)
      if (!isRateLimitError(err) || attempt === PRIMARY_RETRY_COUNT) break
    }
  }
  
  // Fallback
  try {
    console.log(`[${label}] Trying fallback ${FALLBACK_IMAGE_MODEL}...`)
    const response = await client.models.generateContent({
      model: FALLBACK_IMAGE_MODEL,
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
    console.error(`[${label}] Fallback failed: ${err?.message}`)
  }
  
  return null
}

async function generateInstructions(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  modelImageData: string,
  backgroundImageData: string,
  label: string
): Promise<string | null> {
  try {
    const instructPrompt = buildInstructPrompt()
    
    // Input: product, model, background
    const parts: any[] = [
      { text: instructPrompt },
      { inlineData: { mimeType: 'image/jpeg', data: productImageData } },  // {{product}}
      { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },    // {{model}}
      { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
    ]
    
    console.log(`[${label}] Generating photography instructions with VLM...`)
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{ role: 'user', parts }],
      config: { safetySettings },
    })
    
    const result = extractText(response)
    if (result) {
      console.log(`[${label}] Instructions generated (${result.length} chars)`)
    }
    return result
  } catch (err: any) {
    console.error(`[${label}] Instructions error:`, err?.message)
    return null
  }
}

// 服装项接口
interface OutfitItems {
  inner?: string   // 内衬
  top?: string     // 上衣
  pants?: string   // 裤子
  hat?: string     // 帽子
  shoes?: string   // 鞋子
}

// 构建服装描述
function buildOutfitDescription(hasItems: { inner: boolean; top: boolean; pants: boolean; hat: boolean; shoes: boolean }): string {
  const items: string[] = []
  if (hasItems.inner) items.push('{{内衬}}')
  if (hasItems.top) items.push('{{上衣}}')
  if (hasItems.pants) items.push('{{裤子}}')
  if (hasItems.hat) items.push('{{帽子}}')
  if (hasItems.shoes) items.push('{{鞋子}}')
  return items.join('、') || '{{product}}'
}

// Simple prompt for model generation (简单版 - outfit 模式)
function buildSimpleOutfitPrompt(outfitDesc: string): string {
  return `请为${outfitDesc}这些商品生成一个模特实拍图，环境参考{{background}}，模特参考{{model}}，但不能长得和图一完全一样，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格`
}

// Simple prompt for model generation (简单版 - 兼容旧模式)
const SIMPLE_MODEL_PROMPT = `请为{{product}}生成一个模特实拍图，环境参考{{background}}，模特参考{{model}}，但不能长得和图一完全一样，效果要生活化一些，随意一些，符合小红书和 INS 的韩系审美风格`

// Extended mode - Step 1: 生成拍摄指令 (outfit 模式)
function buildOutfitInstructPrompt(outfitDesc: string): string {
  return `你是一个擅长拍摄小红书/instagram等社媒生活感照片的电商摄影师。

你先要理解${outfitDesc}这些商品的版型和风格，

然后根据模特图{{model}}、背景图{{background}}，输出一段韩系审美、小红书和ins的，适合模特展示商品的拍摄指令，要求是随意一点、有生活感，是生活中用手机随手拍出来的效果。请使用以下格式用英文输出：

- composition：

- model pose：

- model expression：

- lighting and color:

输出的内容要尽量简单，不要包含太复杂的信息尽量控制在200字以内；`
}

// Extended mode - Step 2: 图片生成 prompt (outfit 模式)
function buildOutfitImagePrompt(outfitDesc: string, instructPrompt: string | null): string {
  return `take authentic photo of a new model that looks like {{model}}, but do not have the exact same look. 

the new model shows the products ${outfitDesc}, use instagram friendly composition, 要随意一点、有生活感，像是生活中用手机随手拍出来的图片.

the background should be consistent with {{background}}.

The color/size/design/detial must be exactly consistent with products. 

${instructPrompt ? `photo shot instruction: ${instructPrompt}` : ''}

negatives: exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look.`
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
      type, // 'product' | 'model'
      index, // 0 or 1
      taskId, // 任务 ID，用于数据库写入
      productImage, 
      productImage2, 
      modelImage, 
      modelStyle, 
      modelGender, 
      backgroundImage, 
      vibeImage,
      simpleMode, // New: use simple prompt for model generation
      // 新增：用于数据库写入的参数
      inputParams, // 生成参数（modelStyle, modelGender 等）
      // 新增：outfit 模式的服装项
      outfitItems, // { inner, top, pants, hat, shoes }
    } = body
    
    // outfit 模式检查
    const hasOutfitItems = outfitItems && (outfitItems.inner || outfitItems.top || outfitItems.pants || outfitItems.hat || outfitItems.shoes)
    
    if (!productImage && !hasOutfitItems) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    if (!type || (type !== 'product' && type !== 'model')) {
      return NextResponse.json({ success: false, error: '无效的生成类型' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const label = `${type === 'product' ? 'Product' : 'Model'} ${(index || 0) + 1}${simpleMode ? ' (Simple)' : ''}${hasOutfitItems ? ' (Outfit)' : ''}`
    
    // 所有图片都支持 URL 格式（后端转换），减少前端请求体大小
    const productImageData = await ensureBase64Data(productImage)
    const productImage2Data = productImage2 ? await ensureBase64Data(productImage2) : null
    const vibeImageData = vibeImage ? await ensureBase64Data(vibeImage) : null
    
    // 处理模特图片：支持 URL、base64、或随机选择
    let modelImageData: string | null = null
    let actualModelUrl: string | undefined = inputParams?.modelUrl
    let actualModelName: string = inputParams?.model || '模特'
    let actualModelIsRandom = inputParams?.modelIsRandom ?? true
    
    if (modelImage && modelImage !== 'random' && modelImage !== true) {
      modelImageData = await ensureBase64Data(modelImage)
      if (modelImageData) actualModelIsRandom = false
    }
    
    // 如果没有模特数据且是模特类型，使用随机预设
    if (!modelImageData && type === 'model') {
      console.log(`[${label}] Getting random model...`)
      const randomModel = await getRandomPresetBase64('models', 5)
      if (randomModel) {
        modelImageData = randomModel.base64
        actualModelUrl = randomModel.url
        actualModelName = randomModel.fileName.replace(/\.[^.]+$/, '')
        actualModelIsRandom = true
        console.log(`[${label}] Got random model: ${randomModel.fileName}`)
      }
    }
    
    // 处理背景图片：支持 URL、base64、或随机选择
    let backgroundImageData: string | null = null
    let actualBgUrl: string | undefined = inputParams?.backgroundUrl
    let actualBgName: string = inputParams?.background || '背景'
    let actualBgIsRandom = inputParams?.bgIsRandom ?? true
    
    if (backgroundImage && backgroundImage !== 'random' && backgroundImage !== true) {
      backgroundImageData = await ensureBase64Data(backgroundImage)
      if (backgroundImageData) actualBgIsRandom = false
    }
    
    // 如果没有背景数据且是模特类型，使用随机预设
    if (!backgroundImageData && type === 'model') {
      console.log(`[${label}] Getting random background...`)
      const randomBg = await getRandomPresetBase64('backgrounds', 5)
      if (randomBg) {
        backgroundImageData = randomBg.base64
        actualBgUrl = randomBg.url
        actualBgName = randomBg.fileName.replace(/\.[^.]+$/, '')
        actualBgIsRandom = true
        console.log(`[${label}] Got random background: ${randomBg.fileName}`)
      }
    }
    
    // outfit 模式：转换各服装项
    let outfitImagesData: { inner?: string; top?: string; pants?: string; hat?: string; shoes?: string } = {}
    if (hasOutfitItems) {
      console.log(`[${label}] Processing outfit items...`)
      if (outfitItems.inner) outfitImagesData.inner = await ensureBase64Data(outfitItems.inner) || undefined
      if (outfitItems.top) outfitImagesData.top = await ensureBase64Data(outfitItems.top) || undefined
      if (outfitItems.pants) outfitImagesData.pants = await ensureBase64Data(outfitItems.pants) || undefined
      if (outfitItems.hat) outfitImagesData.hat = await ensureBase64Data(outfitItems.hat) || undefined
      if (outfitItems.shoes) outfitImagesData.shoes = await ensureBase64Data(outfitItems.shoes) || undefined
    }
    
    // 检查是否有有效的商品图片
    const hasAnyProduct = productImageData || outfitImagesData.inner || outfitImagesData.top || outfitImagesData.pants || outfitImagesData.hat || outfitImagesData.shoes
    if (!hasAnyProduct) {
      return NextResponse.json({ success: false, error: '商品图片格式无效' }, { status: 400 })
    }
    
    let result: ImageResult | null = null
    let usedPrompt: string = ''
    let generationMode: 'extended' | 'simple' = 'extended'
    
    if (type === 'product') {
      // Generate product image
      console.log(`[${label}] Generating product image...`)
      usedPrompt = PRODUCT_PROMPT
      const parts: any[] = [
        { text: PRODUCT_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
      ]
      if (productImage2Data) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImage2Data } })
      }
      
      result = await generateImageWithFallback(client, parts, label)
      
    } else if (simpleMode && modelImageData && backgroundImageData) {
      // Simple mode: Direct prompt with model and background reference (简单版)
      console.log(`[${label}] Generating with simple prompt...`)
      generationMode = 'simple'
      
      // 判断是否使用 outfit 模式
      const hasOutfit = outfitImagesData.inner || outfitImagesData.top || outfitImagesData.pants || outfitImagesData.hat || outfitImagesData.shoes
      
      if (hasOutfit) {
        // Outfit 模式：使用新的 prompt 和多商品图片
        const outfitDesc = buildOutfitDescription({
          inner: !!outfitImagesData.inner,
          top: !!outfitImagesData.top,
          pants: !!outfitImagesData.pants,
          hat: !!outfitImagesData.hat,
          shoes: !!outfitImagesData.shoes,
        })
        usedPrompt = buildSimpleOutfitPrompt(outfitDesc)
        
        const parts: any[] = [{ text: usedPrompt }]
        // 按顺序添加商品图片：内衬、上衣、裤子、帽子、鞋子
        if (outfitImagesData.inner) parts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.inner } })
        if (outfitImagesData.top) parts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.top } })
        if (outfitImagesData.pants) parts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.pants } })
        if (outfitImagesData.hat) parts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.hat } })
        if (outfitImagesData.shoes) parts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.shoes } })
        // 添加背景和模特
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }) // {{background}}
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } }) // {{model}}
        
        console.log(`[${label}] Using outfit mode with ${Object.values(outfitImagesData).filter(Boolean).length} items`)
        result = await generateImageWithFallback(client, parts, label)
      } else {
        // 兼容旧模式：使用单一 product 图片
        usedPrompt = SIMPLE_MODEL_PROMPT
      const parts: any[] = [
        { text: SIMPLE_MODEL_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } }, // {{product}}
        { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } }, // {{model}}
      ]
      result = await generateImageWithFallback(client, parts, label)
      }
      
    } else {
      // Extended mode: 2-step process (扩展版)
      // Step 1: Generate photography instructions with VLM
      // Step 2: Generate image with the instructions
      
      if (!modelImageData || !backgroundImageData) {
        return NextResponse.json({ 
          success: false, 
          error: '扩展模式需要模特和背景图片' 
        }, { status: 400 })
      }
      
      // 判断是否使用 outfit 模式
      const hasOutfit = outfitImagesData.inner || outfitImagesData.top || outfitImagesData.pants || outfitImagesData.hat || outfitImagesData.shoes
      
      if (hasOutfit) {
        // Outfit 模式扩展版
        const outfitDesc = buildOutfitDescription({
          inner: !!outfitImagesData.inner,
          top: !!outfitImagesData.top,
          pants: !!outfitImagesData.pants,
          hat: !!outfitImagesData.hat,
          shoes: !!outfitImagesData.shoes,
        })
        
        // Step 1: 生成拍摄指令
        console.log(`[${label}] Step 1: Generating outfit instructions...`)
        const instructParts: any[] = [{ text: buildOutfitInstructPrompt(outfitDesc) }]
        // 添加商品图片
        if (outfitImagesData.inner) instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.inner } })
        if (outfitImagesData.top) instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.top } })
        if (outfitImagesData.pants) instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.pants } })
        if (outfitImagesData.hat) instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.hat } })
        if (outfitImagesData.shoes) instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.shoes } })
        // 添加模特和背景
        instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
        instructParts.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
        
        let instructPrompt: string | null = null
        try {
          const instructResponse = await client.models.generateContent({
            model: VLM_MODEL,
            contents: [{ role: 'user', parts: instructParts }],
            config: { safetySettings },
          })
          instructPrompt = extractText(instructResponse)
          console.log(`[${label}] Instructions generated: ${instructPrompt?.substring(0, 200)}...`)
        } catch (err: any) {
          console.error(`[${label}] Instructions error:`, err?.message)
        }
        
        // Step 2: 生成图片
        const imagePrompt = buildOutfitImagePrompt(outfitDesc, instructPrompt)
        usedPrompt = instructPrompt 
          ? `[Photography Instructions]\n${instructPrompt}\n\n[Image Generation Prompt]\n${imagePrompt}`
          : imagePrompt
        
        const imageParts: any[] = []
        // 添加商品图片
        if (outfitImagesData.inner) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.inner } })
        if (outfitImagesData.top) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.top } })
        if (outfitImagesData.pants) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.pants } })
        if (outfitImagesData.hat) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.hat } })
        if (outfitImagesData.shoes) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: outfitImagesData.shoes } })
        // 添加模特和背景
        imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
        imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } })
        // 添加 prompt
        imageParts.push({ text: imagePrompt })
        
        console.log(`[${label}] Step 2: Generating outfit image...`)
        result = await generateImageWithFallback(client, imageParts, label)
        
      } else {
        // 兼容旧模式
      console.log(`[${label}] Step 1: Generating instructions...`)
      const instructPrompt = await generateInstructions(
          client, productImageData!, modelImageData, backgroundImageData, label
      )
      
      // Step 2: Generate image
      const modelPrompt = buildModelPrompt({
        instructPrompt: instructPrompt || undefined,
      })
      
      // Save the full prompt used
      usedPrompt = modelPrompt
      if (instructPrompt) {
        usedPrompt = `[Photography Instructions]\n${instructPrompt}\n\n[Image Generation Prompt]\n${modelPrompt}`
      }
      
      // Parts order: product, model, background, prompt
      const parts: any[] = [
        { inlineData: { mimeType: 'image/jpeg', data: productImageData } },  // {{product}}
        { inlineData: { mimeType: 'image/jpeg', data: modelImageData } },    // {{model}}
        { inlineData: { mimeType: 'image/jpeg', data: backgroundImageData } }, // {{background}}
        { text: modelPrompt },
      ]
      
      console.log(`[${label}] Step 2: Generating model image...`)
      result = await generateImageWithFallback(client, parts, label)
      }
    }
    
    const duration = Date.now() - startTime
    
    if (!result) {
      console.log(`[${label}] Failed in ${duration}ms`)
      
      // 标记图片失败（如果有 taskId）
      if (taskId) {
        await markImageFailed({
          taskId,
          userId,
          imageIndex: index || 0,
          error: 'RESOURCE_BUSY',
        })
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'RESOURCE_BUSY',
        type,
        index,
        duration,
      }, { status: 503 })
    }
    
    console.log(`[${label}] Generated in ${duration}ms, uploading to storage...`)
    
    // 必须有 taskId 才能上传
    if (!taskId) {
      console.error(`[${label}] No taskId provided, cannot upload`)
      return NextResponse.json({
        success: false,
        error: '缺少任务ID',
        type,
        index,
      }, { status: 400 })
    }
    
    // 上传图片到 Storage（必须成功）
    const base64Image = `data:image/png;base64,${result.image}`
    const uploaded = await uploadImageToStorage(base64Image, userId, `output_${index || 0}`)
    
    if (!uploaded) {
      console.error(`[${label}] Failed to upload image to storage`)
      return NextResponse.json({
        success: false,
        error: '图片上传失败，请重试',
        type,
        index,
      }, { status: 500 })
    }
    
    console.log(`[${label}] Uploaded to storage: ${uploaded.substring(0, 80)}...`)
    
    // 只在第一张图时保存商品图 URL（避免重复）
    let inputImageUrl: string | undefined
    const productImageUrls: string[] = [] // 收集所有商品图 URL
    
    if (index === 0) {
      // 收集所有商品图并上传
      const allInputs = [
        productImage,
        productImage2,
        outfitItems?.inner,
        outfitItems?.top,
        outfitItems?.pants,
        outfitItems?.hat,
        outfitItems?.shoes,
      ].filter(Boolean) as string[]
      
      for (const input of allInputs) {
        let uploadedUrl: string | undefined
        
        if (input.startsWith('http')) {
          uploadedUrl = input
        } else if (input.startsWith('data:') || input.length > 1000) {
          // 如果是 base64，上传到 storage
          const uploaded = await uploadImageToStorage(input, userId, 'input_product')
          if (uploaded) uploadedUrl = uploaded
        }
        
        if (uploadedUrl) {
          productImageUrls.push(uploadedUrl)
          // 第一张商品图作为主输入图
          if (!inputImageUrl) {
            inputImageUrl = uploadedUrl
            console.log(`[${label}] Primary product image: ${uploadedUrl.substring(0, 80)}...`)
          }
        }
      }
      
      console.log(`[${label}] Collected ${productImageUrls.length} product images`)
    }
    
    // 写入数据库 - 合并 productImages 到 inputParams
    const enrichedInputParams = index === 0 ? {
      ...inputParams,
      productImages: productImageUrls, // 添加所有商品图 URL
    } : inputParams
    
    const saveResult = await appendImageToGeneration({
      taskId,
      userId,
      imageIndex: index || 0,
      imageUrl: uploaded,
      modelType: result.model,
      genMode: generationMode,
      prompt: usedPrompt,
      taskType: type === 'product' ? 'product_studio' : 'model_studio',
      inputParams: enrichedInputParams,
      inputImageUrl, // 传递商品图 URL
    })
    
    if (saveResult.success) {
      console.log(`[${label}] Saved to database, dbId: ${saveResult.dbId}`)
    } else {
      console.warn(`[${label}] Failed to save to database, but image is uploaded`)
    }
    
    const totalDuration = Date.now() - startTime
    console.log(`[${label}] Completed in ${totalDuration}ms (gen: ${duration}ms)`)
    
    return NextResponse.json({
      success: true,
      type,
      index,
      image: uploaded, // 只返回 Storage URL，不返回 base64
      modelType: result.model,
      generationMode, // 'extended' or 'simple'
      prompt: usedPrompt,
      duration: totalDuration,
      savedToDb: !!taskId, // 告诉前端是否已保存到数据库
      ...(saveResult.dbId ? { dbId: saveResult.dbId } : {}), // 返回数据库 UUID 用于收藏
    })
    
  } catch (error: any) {
    console.error('[Single] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'RESOURCE_BUSY' 
    }, { status: 500 })
  }
}

