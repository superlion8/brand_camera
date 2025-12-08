import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { createClient } from '@/lib/supabase/server'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { stripBase64Prefix } from '@/lib/utils'

export const maxDuration = 300 // 5 minutes

// 将 URL 转换为 base64（服务端版本）
async function urlToBase64(url: string, maxRetries = 2): Promise<string> {
  const cleanUrl = url.trim()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[urlToBase64] Attempt ${attempt}/${maxRetries}, Fetching:`, cleanUrl.substring(0, 100) + '...')
      const response = await fetch(cleanUrl, {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        console.error(`[urlToBase64] HTTP Error (attempt ${attempt}):`, response.status, response.statusText, 'URL:', cleanUrl)
        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
        continue
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      console.log('[urlToBase64] Success, base64 length:', buffer.toString('base64').length)
      return buffer.toString('base64')
    } catch (error: any) {
      console.error(`[urlToBase64] Error (attempt ${attempt}):`, error.message, 'URL:', cleanUrl.substring(0, 100))
      if (attempt === maxRetries) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw new Error('Failed to fetch image after all retries')
}

// 确保图片数据是 base64 格式（支持 URL 和 base64 输入）
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return await urlToBase64(image)
  }
  return stripBase64Prefix(image)
}

// VLM model for generating pose instructions
const VLM_MODEL = 'gemini-3-pro-preview'
// Image generation models
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Pose instruction interface - Studio mode
interface StudioPoseInstruction {
  id: number
  product_focus: string
  pose_instruction: string
  camera_position: string
  composition: string
}

// Pose instruction interface - Lifestyle mode (Instagram style)
interface LifestylePoseInstruction {
  slide_number: number
  shot_type: string
  pose_instruction: string
  facial_expression: string
  camera_position: string
  composition: string
}

// Prompts
const PROMPTS = {
  // ========== 棚拍模式 (Studio) ==========
  
  // 棚拍-随意拍 - 生成5个pose指令（JSON格式）
  studioRandomPoseGen: `
# Role

You are an expert e-commerce fashion photographer specializing in studio photography. Your goal is to direct models to showcase products (clothing, accessories, etc.) in the most appealing and commercial way, suitable for a brand's official website or online store.

# Input Analysis

Analyze the provided image. Identify:

1. The main product being sold.
2. The model's features and current vibe.
3. The lighting and environment (keep these consistent).

# Task

Based on your analysis, generate **5 distinct photography directives** to showcase the product from different angles or in different ways.

# Constraints

- **Product First:** Every pose must intentionally highlight the product details.
- **Inventory Consistency:** Work ONLY with the items present in the source image. **Do NOT introduce any new accessories or props.** For example, if the model is not holding a bag in the original image, do NOT write instructions like "holding a bag" or "clutching a purse". If there is no chair, do not ask them to "sit on a chair".
- **Environment Consistency:** Maintain the original lighting, environment, and background.
- **Natural & Professional:** Directives should be simple and achievable. Avoid overly dramatic, artistic, or weird poses that distract from the product.
- **Quantity:** Strictly output 5 variations.

# Output Format

Output **ONLY** a standard JSON array containing 5 objects. Do not wrap the JSON in markdown code blocks. Do not add conversational text.

Use this exact JSON schema:

[
  {
    "id": 1,
    "product_focus": "Briefly describe which part of the product is highlighted (e.g., 'Side profile of the dress', 'Texture of the bag')",
    "pose_instruction": "Specific, clear instruction for the model (e.g., 'Turn 45 degrees to the right, place left hand gently on the waist to reveal the sleeve detail.')",
    "camera_position": "Camera angle and distance (e.g., 'Eye-level, Frontal view')",
    "composition": "Framing details (e.g., 'Medium shot, center composed')"
  }
]
`,

  // 棚拍-随意拍 - 根据pose生成图片
  studioRandomPoseExec: (poseInstruct: StudioPoseInstruction) => `
请为这个模特拍摄一张专业影棚商品棚拍图。保持商品的质感、颜色、纹理细节、版型严格一致。

拍摄指令：
- 产品重点: ${poseInstruct.product_focus}
- 姿势: ${poseInstruct.pose_instruction}
- 相机位置: ${poseInstruct.camera_position}
- 构图: ${poseInstruct.composition}
`,

  // ========== 生活模式 (Lifestyle / Instagram) ==========
  
  // 生活-随意拍 - 生成5个pose指令（JSON格式）
  lifestyleRandomPoseGen: `
# Role

You are a top-tier Social Media Photographer and Art Director specializing in the "Instagram Aesthetic" (Ins style). You excel at capturing candid, mood-driven, and engaging lifestyle portraits.

# Input Analysis

Analyze the provided image. Identify:

1. The model's styling, mood, and current action.
2. The environment's atmosphere (lighting, background).
3. The potential "story" or "vibe" suitable for this setting.

# Task

Design a cohesive **5-photo Instagram Carousel (Slide)** sequence based on the original image's context.

The sequence should offer visual variety (mixing wide shots, close-ups, and different angles) to keep the viewer engaged, while maintaining the same lighting and location.

# Constraints

- **Vibe:** Focus on "natural," "effortless," and "candid" aesthetics. Avoid stiff, studio-like commercial posing.
- **Variety:** Do not repeat the same composition 5 times. Mix detail shots, body shots, and dynamic movement.
- **Consistency:** Keep the lighting and environment fixed.
- **Quantity:** Strictly output 5 variations.

# Output Format

Output **ONLY** a standard JSON array containing 5 objects. Do not use markdown code blocks.

Use this exact JSON schema:

[
  {
    "slide_number": 1,
    "shot_type": "The type of shot (e.g., 'Cover Shot - Eye Contact', 'Candid Laugh', 'Detail/Texture', 'Motion/Walking')",
    "pose_instruction": "Specific instruction for the model. Focus on natural movement and interaction with the environment.",
    "facial_expression": "Description of the model's expression (e.g., 'Looking away softly', 'Big genuine smile', 'Neutral chic')",
    "camera_position": "Angle and framing (e.g., 'Low angle, wide lens', 'Close-up on face, shallow depth of field')",
    "composition": "Framing details (e.g., 'Rule of thirds, negative space on the left')"
  }
]
`,

  // 生活-随意拍 - 根据pose生成图片
  lifestyleRandomPoseExec: (poseInstruct: LifestylePoseInstruction) => `
Take an authentic photo of the character, use instagram friendly composition. The character should have identical face, features, skin tone, hairstyle, body proportions, clothing and vibe.

拍摄指令：
- Shot Type: ${poseInstruct.shot_type}
- Pose: ${poseInstruct.pose_instruction}
- Expression: ${poseInstruct.facial_expression}
- Camera Position: ${poseInstruct.camera_position}
- Composition: ${poseInstruct.composition}

Negatives: beauty-filter/airbrushed skin; poreless look, exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look
`,

  // 多角度 - 正面
  multiFront: `
请为这个模特拍摄一张正面全身的专业影棚商品棚拍图。
模特面向镜头，姿态自然优雅，展示商品的正面效果。
保持商品的质感、颜色、纹理细节、版型严格一致。
保持相同的光影和背景。
`,

  // 多角度 - 左侧
  multiLeft: `
请为这个模特拍摄一张左侧面全身的专业影棚商品棚拍图。
模特左侧面对镜头，姿态自然优雅，展示商品的左侧效果。
保持商品的质感、颜色、纹理细节、版型严格一致。
保持相同的光影和背景。
`,

  // 多角度 - 右侧
  multiRight: `
请为这个模特拍摄一张右侧面全身的专业影棚商品棚拍图。
模特右侧面对镜头，姿态自然优雅，展示商品的右侧效果。
保持商品的质感、颜色、纹理细节、版型严格一致。
保持相同的光影和背景。
`,

  // 多角度 - 背面
  multiBack: `
请为这个模特拍摄一张背面全身的专业影棚商品棚拍图。
模特背对镜头，姿态自然优雅，展示商品的背面效果。
保持商品的质感、颜色、纹理细节、版型严格一致。
保持相同的光影和背景。
`,
}

// Parse studio pose instructions from VLM response (JSON format)
function parseStudioPoseInstructions(text: string): StudioPoseInstruction[] {
  const defaultPoses: StudioPoseInstruction[] = [
    { id: 1, product_focus: 'Front view of the product', pose_instruction: 'Face the camera directly with a natural stance', camera_position: 'Eye-level, frontal view', composition: 'Full body shot, center composed' },
    { id: 2, product_focus: 'Side profile of the product', pose_instruction: 'Turn 45 degrees to the right, hands relaxed', camera_position: 'Eye-level, 3/4 view', composition: 'Medium shot, rule of thirds' },
    { id: 3, product_focus: 'Back detail of the product', pose_instruction: 'Turn to show back, look over shoulder', camera_position: 'Eye-level, back view', composition: 'Full body shot, center composed' },
    { id: 4, product_focus: 'Detail shot', pose_instruction: 'Slight lean forward to highlight texture', camera_position: 'Slightly elevated angle', composition: 'Medium close-up shot' },
    { id: 5, product_focus: 'Dynamic angle', pose_instruction: 'Walking pose with natural movement', camera_position: 'Eye-level, slight angle', composition: 'Full body shot with movement' },
  ]

  try {
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }
    
    const parsed = JSON.parse(jsonText) as StudioPoseInstruction[]
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validPoses = parsed.filter(p => 
        p && typeof p === 'object' && (p.pose_instruction || p.product_focus)
      ).map((p, idx) => ({
        id: p.id || idx + 1,
        product_focus: p.product_focus || 'Product highlight',
        pose_instruction: p.pose_instruction || 'Natural pose',
        camera_position: p.camera_position || 'Eye-level view',
        composition: p.composition || 'Center composed',
      }))
      
      if (validPoses.length >= 5) {
        console.log('[GroupShoot-Studio] Successfully parsed JSON poses:', validPoses.length)
        return validPoses.slice(0, 5)
      }
      
      while (validPoses.length < 5) {
        validPoses.push(defaultPoses[validPoses.length])
      }
      return validPoses
    }
  } catch (error: any) {
    console.error('[GroupShoot-Studio] JSON parse error:', error.message)
    console.log('[GroupShoot-Studio] Raw text:', text.substring(0, 500))
  }
  
  console.log('[GroupShoot-Studio] Using default poses')
  return defaultPoses
}

// Parse lifestyle pose instructions from VLM response (JSON format)
function parseLifestylePoseInstructions(text: string): LifestylePoseInstruction[] {
  const defaultPoses: LifestylePoseInstruction[] = [
    { slide_number: 1, shot_type: 'Cover Shot - Eye Contact', pose_instruction: 'Look directly at camera with a soft smile', facial_expression: 'Confident yet approachable', camera_position: 'Eye-level, medium shot', composition: 'Center composed, negative space on sides' },
    { slide_number: 2, shot_type: 'Candid Laugh', pose_instruction: 'Natural laugh, looking slightly away', facial_expression: 'Big genuine smile', camera_position: 'Slightly low angle', composition: 'Rule of thirds' },
    { slide_number: 3, shot_type: 'Walking Motion', pose_instruction: 'Mid-stride walking pose', facial_expression: 'Neutral chic', camera_position: 'Side angle, wide shot', composition: 'Leading lines, full body' },
    { slide_number: 4, shot_type: 'Detail/Texture', pose_instruction: 'Close-up focusing on outfit details', facial_expression: 'Looking away softly', camera_position: 'Close-up, shallow depth', composition: 'Tight crop on detail' },
    { slide_number: 5, shot_type: 'Lifestyle Context', pose_instruction: 'Interact with environment naturally', facial_expression: 'Relaxed, genuine', camera_position: 'Medium wide shot', composition: 'Environmental context visible' },
  ]

  try {
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }
    
    const parsed = JSON.parse(jsonText) as LifestylePoseInstruction[]
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validPoses = parsed.filter(p => 
        p && typeof p === 'object' && (p.pose_instruction || p.shot_type)
      ).map((p, idx) => ({
        slide_number: p.slide_number || idx + 1,
        shot_type: p.shot_type || 'Lifestyle shot',
        pose_instruction: p.pose_instruction || 'Natural pose',
        facial_expression: p.facial_expression || 'Natural expression',
        camera_position: p.camera_position || 'Eye-level',
        composition: p.composition || 'Center composed',
      }))
      
      if (validPoses.length >= 5) {
        console.log('[GroupShoot-Lifestyle] Successfully parsed JSON poses:', validPoses.length)
        return validPoses.slice(0, 5)
      }
      
      while (validPoses.length < 5) {
        validPoses.push(defaultPoses[validPoses.length])
      }
      return validPoses
    }
  } catch (error: any) {
    console.error('[GroupShoot-Lifestyle] JSON parse error:', error.message)
    console.log('[GroupShoot-Lifestyle] Raw text:', text.substring(0, 500))
  }
  
  console.log('[GroupShoot-Lifestyle] Using default poses')
  return defaultPoses
}

// Generate image with fallback
async function generateImageWithFallback(
  genai: any,
  contents: any[],
  label: string
): Promise<{ image: string; model: 'pro' | 'flash' } | null> {
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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const body = await request.json()
        const { startImage, mode, styleMode = 'studio', taskId } = body

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          send({ type: 'error', error: 'Unauthorized' })
          controller.close()
          return
        }

        const userId = user.id
        const genai = getGenAIClient()
        const isLifestyle = styleMode === 'lifestyle'

        console.log(`[GroupShoot] Starting ${isLifestyle ? 'lifestyle' : 'studio'} mode, shoot mode: ${mode}`)

        // Prepare image data - 支持 URL 和 base64 格式
        const imageDataRaw = await ensureBase64Data(startImage)
        
        if (!imageDataRaw) {
          send({ type: 'error', error: '图片数据无效' })
          controller.close()
          return
        }
        
        // 类型保证：此处 imageData 一定是 string
        const imageData: string = imageDataRaw

        if (mode === 'random') {
          // ========== 随意拍模式 ==========
          console.log(`[GroupShoot] Starting random mode (${isLifestyle ? 'lifestyle' : 'studio'})...`)
          
          // Step 1: Generate pose instructions using VLM (JSON format)
          send({ type: 'status', message: isLifestyle ? '正在设计ins风格pose...' : '正在分析图片生成pose指令...' })
          
          if (isLifestyle) {
            // ===== 生活模式 =====
            let lifestylePoses: LifestylePoseInstruction[] = []
            try {
              console.log('[GroupShoot-Lifestyle] Generating lifestyle poses...')
              const instructResponse = await genai.models.generateContent({
                model: VLM_MODEL,
                contents: [{ role: 'user', parts: [
                  { text: PROMPTS.lifestyleRandomPoseGen },
                  { inlineData: { mimeType: 'image/jpeg', data: imageData } },
                ] }],
                config: { safetySettings },
              })
              
              const instructText = extractText(instructResponse) || ''
              console.log('[GroupShoot-Lifestyle] VLM response (first 800 chars):', instructText.substring(0, 800))
              
              lifestylePoses = parseLifestylePoseInstructions(instructText)
              console.log('[GroupShoot-Lifestyle] Parsed poses:', lifestylePoses.length)
            } catch (error: any) {
              console.error('[GroupShoot-Lifestyle] Failed to generate poses:', error.message)
              lifestylePoses = parseLifestylePoseInstructions('')
            }

            // Generate 5 images
            for (let i = 0; i < 5; i++) {
              send({ type: 'progress', index: i })
              
              const poseInstruct = lifestylePoses[i]
              const posePrompt = PROMPTS.lifestyleRandomPoseExec(poseInstruct)
              
              console.log(`[GroupShoot-Lifestyle-${i}] Shot: ${poseInstruct.shot_type}`)
              
              const contents = [
                { text: posePrompt },
                { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              ]

              const result = await generateImageWithFallback(genai, contents, `[GroupShoot-Lifestyle-${i}]`)
              
              if (result) {
                const base64Image = `data:image/png;base64,${result.image}`
                
                // 必须上传成功才返回
                if (!taskId) {
                  send({ type: 'error', index: i, error: '缺少任务ID' })
                  continue
                }
                
                const uploaded = await uploadImageToStorage(base64Image, userId, `group_${taskId}_${i}`)
                if (!uploaded) {
                  send({ type: 'error', index: i, error: '图片上传失败' })
                  continue
                }
                
                // 只在第一张图时上传输入图片
                let inputImageUrlToSave: string | undefined
                if (i === 0 && startImage) {
                  const inputUploaded = await uploadImageToStorage(startImage, userId, `group_${taskId}_input`)
                  if (inputUploaded) inputImageUrlToSave = inputUploaded
                }
                
                const promptForDb = `Shot Type: ${poseInstruct.shot_type}\nPose: ${poseInstruct.pose_instruction}\nExpression: ${poseInstruct.facial_expression}\nCamera: ${poseInstruct.camera_position}\nComposition: ${poseInstruct.composition}`
                
                await appendImageToGeneration({
                  taskId,
                  userId,
                  imageIndex: i,
                  imageUrl: uploaded,
                  modelType: result.model,
                  genMode: 'simple',
                  prompt: promptForDb,
                  taskType: 'group_shoot',
                  inputImageUrl: inputImageUrlToSave,
                  inputParams: i === 0 ? { 
                    styleMode: 'lifestyle', 
                    mode: 'random',
                    startImage: inputImageUrlToSave, // 保存输入图到 inputParams
                  } : undefined,
                })
                
                send({ type: 'image', index: i, image: uploaded, modelType: result.model })
              } else {
                send({ type: 'error', index: i, error: '生成失败' })
              }
            }
          } else {
            // ===== 棚拍模式 =====
            let studioPoses: StudioPoseInstruction[] = []
            try {
              console.log('[GroupShoot-Studio] Generating studio poses...')
              const instructResponse = await genai.models.generateContent({
                model: VLM_MODEL,
                contents: [{ role: 'user', parts: [
                  { text: PROMPTS.studioRandomPoseGen },
                  { inlineData: { mimeType: 'image/jpeg', data: imageData } },
                ] }],
                config: { safetySettings },
              })
              
              const instructText = extractText(instructResponse) || ''
              console.log('[GroupShoot-Studio] VLM response (first 800 chars):', instructText.substring(0, 800))
              
              studioPoses = parseStudioPoseInstructions(instructText)
              console.log('[GroupShoot-Studio] Parsed poses:', studioPoses.length)
            } catch (error: any) {
              console.error('[GroupShoot-Studio] Failed to generate poses:', error.message)
              studioPoses = parseStudioPoseInstructions('')
            }

            // Generate 5 images
            for (let i = 0; i < 5; i++) {
              send({ type: 'progress', index: i })
              
              const poseInstruct = studioPoses[i]
              const posePrompt = PROMPTS.studioRandomPoseExec(poseInstruct)
              
              console.log(`[GroupShoot-Studio-${i}] Focus: ${poseInstruct.product_focus}`)
              
              const contents = [
                { text: posePrompt },
                { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              ]

              const result = await generateImageWithFallback(genai, contents, `[GroupShoot-Studio-${i}]`)
              
              if (result) {
                const base64Image = `data:image/png;base64,${result.image}`
                
                // 必须上传成功才返回
                if (!taskId) {
                  send({ type: 'error', index: i, error: '缺少任务ID' })
                  continue
                }
                
                const uploaded = await uploadImageToStorage(base64Image, userId, `group_${taskId}_${i}`)
                if (!uploaded) {
                  send({ type: 'error', index: i, error: '图片上传失败' })
                  continue
                }
                
                // 只在第一张图时上传输入图片
                let inputImageUrlToSave: string | undefined
                if (i === 0 && startImage) {
                  const inputUploaded = await uploadImageToStorage(startImage, userId, `group_${taskId}_input`)
                  if (inputUploaded) inputImageUrlToSave = inputUploaded
                }
                
                const promptForDb = `产品重点: ${poseInstruct.product_focus}\n姿势: ${poseInstruct.pose_instruction}\n相机位置: ${poseInstruct.camera_position}\n构图: ${poseInstruct.composition}`
                
                await appendImageToGeneration({
                  taskId,
                  userId,
                  imageIndex: i,
                  imageUrl: uploaded,
                  modelType: result.model,
                  genMode: 'simple',
                  prompt: promptForDb,
                  taskType: 'group_shoot',
                  inputImageUrl: inputImageUrlToSave,
                  inputParams: i === 0 ? { 
                    styleMode: 'studio', 
                    mode: 'random',
                    startImage: inputImageUrlToSave, // 保存输入图到 inputParams
                  } : undefined,
                })
                
                send({ type: 'image', index: i, image: uploaded, modelType: result.model })
              } else {
                send({ type: 'error', index: i, error: '生成失败' })
              }
            }
          }

        } else if (mode === 'multiangle') {
          // ========== 多角度模式 ==========
          console.log(`[GroupShoot] Starting multiangle mode (${isLifestyle ? 'lifestyle' : 'studio'})...`)
          
          // 生活模式多角度 prompts
          const lifestyleAnglePrompts = [
            { prompt: `Take an authentic instagram-style photo of the character from the front. Natural, candid vibe. Character should have identical face, features, skin tone, hairstyle, body proportions, clothing. Keep same lighting and environment.\n\nNegatives: beauty-filter, CGI look, fake blur`, label: '正面' },
            { prompt: `Take an authentic instagram-style photo of the character from the left side (3/4 view). Natural, candid vibe. Character should have identical face, features, skin tone, hairstyle, body proportions, clothing. Keep same lighting and environment.\n\nNegatives: beauty-filter, CGI look, fake blur`, label: '左侧' },
            { prompt: `Take an authentic instagram-style photo of the character from the right side (3/4 view). Natural, candid vibe. Character should have identical face, features, skin tone, hairstyle, body proportions, clothing. Keep same lighting and environment.\n\nNegatives: beauty-filter, CGI look, fake blur`, label: '右侧' },
            { prompt: `Take an authentic instagram-style photo of the character from behind (back view). Natural, candid vibe. Character should have identical hairstyle, body proportions, clothing. Keep same lighting and environment.\n\nNegatives: beauty-filter, CGI look, fake blur`, label: '背面' },
          ]
          
          // 棚拍模式多角度 prompts
          const studioAnglePrompts = [
            { prompt: PROMPTS.multiFront, label: '正面' },
            { prompt: PROMPTS.multiLeft, label: '左侧' },
            { prompt: PROMPTS.multiRight, label: '右侧' },
            { prompt: PROMPTS.multiBack, label: '背面' },
          ]
          
          const anglePrompts = isLifestyle ? lifestyleAnglePrompts : studioAnglePrompts

          for (let i = 0; i < anglePrompts.length; i++) {
            send({ type: 'progress', index: i })
            
            const { prompt, label } = anglePrompts[i]
            const contents = [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageData } },
            ]

            const result = await generateImageWithFallback(genai, contents, `[GroupShoot-MultiAngle-${label}]`)
            
            if (result) {
              const base64Image = `data:image/png;base64,${result.image}`
              
              // 必须上传成功才返回
              if (!taskId) {
                send({ type: 'error', index: i, error: '缺少任务ID' })
                continue
              }
              
              const uploaded = await uploadImageToStorage(base64Image, userId, `group_${taskId}_${i}`)
              if (!uploaded) {
                send({ type: 'error', index: i, error: '图片上传失败' })
                continue
              }
              
              // 只在第一张图时上传输入图片
              let inputImageUrlToSave: string | undefined
              if (i === 0 && startImage) {
                const inputUploaded = await uploadImageToStorage(startImage, userId, `group_${taskId}_input`)
                if (inputUploaded) inputImageUrlToSave = inputUploaded
              }
              
              await appendImageToGeneration({
                taskId,
                userId,
                imageIndex: i,
                imageUrl: uploaded,
                modelType: result.model,
                genMode: 'simple',
                prompt: prompt,
                taskType: 'group_shoot',
                inputImageUrl: inputImageUrlToSave,
                inputParams: i === 0 ? { 
                  styleMode, 
                  mode: 'multiangle',
                  startImage: inputImageUrlToSave, // 保存输入图到 inputParams
                } : undefined,
              })
              
              send({ type: 'image', index: i, image: uploaded, modelType: result.model })
            } else {
              send({ type: 'error', index: i, error: '生成失败' })
            }
          }
        }

        send({ type: 'done' })
      } catch (error: any) {
        console.error('[GroupShoot] Error:', error)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Generation failed' })}\n\n`))
      } finally {
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

