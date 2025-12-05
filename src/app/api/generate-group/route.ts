import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { createClient } from '@/lib/supabase/server'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'

export const maxDuration = 300 // 5 minutes

// VLM model for generating pose instructions
const VLM_MODEL = 'gemini-3-pro-preview'
// Image generation models
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Pose instruction interface
interface PoseInstruction {
  id: number
  product_focus: string
  pose_instruction: string
  camera_position: string
  composition: string
}

// Prompts
const PROMPTS = {
  // 随意拍 - 生成5个pose指令（JSON格式）
  randomPoseGen: `
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
- **Consistency:** Maintain the original lighting, environment, and model styling. Do not introduce new props or change the background.
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

  // 随意拍 - 根据pose生成图片
  randomPoseExec: (poseInstruct: PoseInstruction) => `
请为这个模特拍摄一张专业影棚商品棚拍图。保持商品的质感、颜色、纹理细节、版型严格一致。

拍摄指令：
- 产品重点: ${poseInstruct.product_focus}
- 姿势: ${poseInstruct.pose_instruction}
- 相机位置: ${poseInstruct.camera_position}
- 构图: ${poseInstruct.composition}
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

// Parse pose instructions from VLM response (JSON format)
function parsePoseInstructions(text: string): PoseInstruction[] {
  const defaultPoses: PoseInstruction[] = [
    { id: 1, product_focus: 'Front view of the product', pose_instruction: 'Face the camera directly with a natural stance', camera_position: 'Eye-level, frontal view', composition: 'Full body shot, center composed' },
    { id: 2, product_focus: 'Side profile of the product', pose_instruction: 'Turn 45 degrees to the right, hands relaxed', camera_position: 'Eye-level, 3/4 view', composition: 'Medium shot, rule of thirds' },
    { id: 3, product_focus: 'Back detail of the product', pose_instruction: 'Turn to show back, look over shoulder', camera_position: 'Eye-level, back view', composition: 'Full body shot, center composed' },
    { id: 4, product_focus: 'Detail shot', pose_instruction: 'Slight lean forward to highlight texture', camera_position: 'Slightly elevated angle', composition: 'Medium close-up shot' },
    { id: 5, product_focus: 'Dynamic angle', pose_instruction: 'Walking pose with natural movement', camera_position: 'Eye-level, slight angle', composition: 'Full body shot with movement' },
  ]

  try {
    // Clean up the text - remove markdown code blocks if present
    let jsonText = text.trim()
    
    // Remove markdown code block wrapper if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    
    // Try to find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }
    
    const parsed = JSON.parse(jsonText) as PoseInstruction[]
    
    // Validate the parsed result
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure each item has required fields
      const validPoses = parsed.filter(p => 
        p && typeof p === 'object' && 
        (p.pose_instruction || p.product_focus)
      ).map((p, idx) => ({
        id: p.id || idx + 1,
        product_focus: p.product_focus || 'Product highlight',
        pose_instruction: p.pose_instruction || 'Natural pose',
        camera_position: p.camera_position || 'Eye-level view',
        composition: p.composition || 'Center composed',
      }))
      
      if (validPoses.length >= 5) {
        console.log('[GroupShoot] Successfully parsed JSON poses:', validPoses.length)
        return validPoses.slice(0, 5)
      }
      
      // Fill with defaults if we have some but not enough
      while (validPoses.length < 5) {
        validPoses.push(defaultPoses[validPoses.length])
      }
      return validPoses
    }
  } catch (error: any) {
    console.error('[GroupShoot] JSON parse error:', error.message)
    console.log('[GroupShoot] Raw text:', text.substring(0, 500))
  }
  
  // Return default poses if parsing failed
  console.log('[GroupShoot] Using default poses')
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
      },
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
        const { startImage, mode, taskId } = body

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          send({ type: 'error', error: 'Unauthorized' })
          controller.close()
          return
        }

        const userId = user.id
        const genai = getGenAIClient()

        // Prepare image data
        const imageData = startImage?.startsWith('data:') 
          ? startImage.split(',')[1] 
          : startImage

        if (mode === 'random') {
          // ========== 随意拍模式 ==========
          console.log('[GroupShoot] Starting random mode...')
          
          // Step 1: Generate pose instructions using VLM (JSON format)
          send({ type: 'status', message: '正在分析图片生成pose指令...' })
          
          let poseInstructions: PoseInstruction[] = []
          try {
            console.log('[GroupShoot] Generating pose instructions with JSON format...')
            const instructResponse = await genai.models.generateContent({
              model: VLM_MODEL,
              contents: [{ role: 'user', parts: [
                { text: PROMPTS.randomPoseGen },
                { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              ] }],
              config: { safetySettings },
            })
            
            const instructText = extractText(instructResponse) || ''
            console.log('[GroupShoot] VLM response (first 800 chars):', instructText.substring(0, 800))
            
            poseInstructions = parsePoseInstructions(instructText)
            console.log('[GroupShoot] Parsed poses:', poseInstructions.length, 'First:', JSON.stringify(poseInstructions[0]))
          } catch (error: any) {
            console.error('[GroupShoot] Failed to generate poses:', error.message)
            // Use default poses (already returned by parsePoseInstructions on error)
            poseInstructions = parsePoseInstructions('')
          }

          // Step 2: Generate 5 images based on pose instructions
          for (let i = 0; i < 5; i++) {
            send({ type: 'progress', index: i })
            
            const poseInstruct = poseInstructions[i]
            const posePrompt = PROMPTS.randomPoseExec(poseInstruct)
            
            console.log(`[GroupShoot-Random-${i}] Pose: ${poseInstruct.pose_instruction.substring(0, 100)}...`)
            
            const contents = [
              { text: posePrompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageData } },
            ]

            const result = await generateImageWithFallback(genai, contents, `[GroupShoot-Random-${i}]`)
            
            if (result) {
              const base64Image = `data:image/png;base64,${result.image}`
              
              // Upload to storage
              let uploadedUrl = base64Image
              if (taskId) {
                const uploaded = await uploadImageToStorage(base64Image, userId, `group_${taskId}_${i}`)
                if (uploaded) {
                  uploadedUrl = uploaded
                  
                  // Store the structured pose instruction as prompt
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
                  })
                }
              }
              
              send({ type: 'image', index: i, image: uploadedUrl, modelType: result.model })
            } else {
              send({ type: 'error', index: i, error: '生成失败' })
            }
          }

        } else if (mode === 'multiangle') {
          // ========== 多角度模式 ==========
          console.log('[GroupShoot] Starting multiangle mode...')
          
          const anglePrompts = [
            { prompt: PROMPTS.multiFront, label: '正面' },
            { prompt: PROMPTS.multiLeft, label: '左侧' },
            { prompt: PROMPTS.multiRight, label: '右侧' },
            { prompt: PROMPTS.multiBack, label: '背面' },
          ]

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
              
              // Upload to storage
              let uploadedUrl = base64Image
              if (taskId) {
                const uploaded = await uploadImageToStorage(base64Image, userId, `group_${taskId}_${i}`)
                if (uploaded) {
                  uploadedUrl = uploaded
                  
                  await appendImageToGeneration({
                    taskId,
                    userId,
                    imageIndex: i,
                    imageUrl: uploaded,
                    modelType: result.model,
                    genMode: 'simple',
                    prompt: prompt,
                    taskType: 'group_shoot',
                  })
                }
              }
              
              send({ type: 'image', index: i, image: uploadedUrl, modelType: result.model })
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

