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

// Prompts
const PROMPTS = {
  // 随意拍 - 生成5个pose指令
  randomPoseGen: `
你现在是一个专门拍摄电商商品棚拍图的职业摄影师，请你分析一下这个模特所展示的商品、模特所在的环境、模特的特征还有她现在在做的动作，让她换5个不同的展示商品的pose，适合作为电商平台或品牌官网展示的模特棚拍图，请你给出这5个pose的指令。

尽量避免指令过于复杂，导致在一张图片里传达了过多的信息、或者让模特做出过于dramatic的姿势，不要改变光影。

请你严格用英文按照下面这个格式来写，不需要输出其他额外的东西：

- Pose1:
- Camera Position1:
- Composition1:

- Pose2:
- Camera Position2:
- Composition2:

- Pose3:
- Camera Position3:
- Composition3:

- Pose4:
- Camera Position4:
- Composition4:

- Pose5:
- Camera Position5:
- Composition5:
`,

  // 随意拍 - 根据pose生成图片
  randomPoseExec: (poseInstruct: string) => `
请为这个模特拍摄一张专业影棚商品棚拍图。保持商品的质感、颜色、纹理细节、版型严格一致。

拍摄指令：${poseInstruct}
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

// Parse pose instructions from VLM response
function parsePoseInstructions(text: string): string[] {
  const poses: string[] = []
  
  // Try to parse structured format
  const poseRegex = /[-•]\s*Pose(\d+):\s*([^\n-•]+(?:\n(?![-•]\s*(?:Pose|Camera|Composition))[^\n-•]+)*)/gi
  const cameraRegex = /[-•]\s*Camera Position(\d+):\s*([^\n-•]+(?:\n(?![-•]\s*(?:Pose|Camera|Composition))[^\n-•]+)*)/gi
  const compositionRegex = /[-•]\s*Composition(\d+):\s*([^\n-•]+(?:\n(?![-•]\s*(?:Pose|Camera|Composition))[^\n-•]+)*)/gi
  
  const poseMap: { [key: number]: { pose?: string; camera?: string; composition?: string } } = {}
  
  let match
  while ((match = poseRegex.exec(text)) !== null) {
    const idx = parseInt(match[1])
    if (!poseMap[idx]) poseMap[idx] = {}
    poseMap[idx].pose = match[2].trim()
  }
  
  while ((match = cameraRegex.exec(text)) !== null) {
    const idx = parseInt(match[1])
    if (!poseMap[idx]) poseMap[idx] = {}
    poseMap[idx].camera = match[2].trim()
  }
  
  while ((match = compositionRegex.exec(text)) !== null) {
    const idx = parseInt(match[1])
    if (!poseMap[idx]) poseMap[idx] = {}
    poseMap[idx].composition = match[2].trim()
  }
  
  // Combine into pose instructions
  for (let i = 1; i <= 5; i++) {
    const p = poseMap[i]
    if (p && (p.pose || p.camera || p.composition)) {
      const parts: string[] = []
      if (p.pose) parts.push(`Pose: ${p.pose}`)
      if (p.camera) parts.push(`Camera Position: ${p.camera}`)
      if (p.composition) parts.push(`Composition: ${p.composition}`)
      poses.push(parts.join('\n'))
    }
  }
  
  // Fallback: if parsing failed, split by numbered sections
  if (poses.length < 5) {
    const fallbackPoses: string[] = []
    const sections = text.split(/(?:^|\n)(?:[-•]?\s*)?(?:\d+[\.\):]|Pose\s*\d+)/i)
    for (const section of sections) {
      const trimmed = section.trim()
      if (trimmed && trimmed.length > 20) {
        fallbackPoses.push(trimmed)
      }
    }
    if (fallbackPoses.length >= poses.length) {
      return fallbackPoses.slice(0, 5)
    }
  }
  
  // Fill missing poses with defaults
  while (poses.length < 5) {
    poses.push(`Pose ${poses.length + 1}: Natural standing pose with slight variation, looking at camera`)
  }
  
  return poses.slice(0, 5)
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
          
          // Step 1: Generate pose instructions using VLM
          send({ type: 'status', message: '正在分析图片生成pose指令...' })
          
          let poseInstructions: string[] = []
          try {
            console.log('[GroupShoot] Generating pose instructions...')
            const instructResponse = await genai.models.generateContent({
              model: VLM_MODEL,
              contents: [{ role: 'user', parts: [
                { text: PROMPTS.randomPoseGen },
                { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              ] }],
              config: { safetySettings },
            })
            
            const instructText = extractText(instructResponse) || ''
            console.log('[GroupShoot] VLM response:', instructText.substring(0, 500))
            
            poseInstructions = parsePoseInstructions(instructText)
            console.log('[GroupShoot] Parsed poses:', poseInstructions.length)
          } catch (error: any) {
            console.error('[GroupShoot] Failed to generate poses:', error.message)
            // Use default poses
            poseInstructions = [
              'Pose: Natural standing with hands on hips, Camera: Front view, eye level',
              'Pose: Walking pose with one foot forward, Camera: Slight angle from left',
              'Pose: Casual lean with weight on one leg, Camera: Front view',
              'Pose: Looking over shoulder, Camera: 3/4 view from right',
              'Pose: Dynamic pose with slight movement, Camera: Full body shot',
            ]
          }

          // Step 2: Generate 5 images based on pose instructions
          for (let i = 0; i < 5; i++) {
            send({ type: 'progress', index: i })
            
            const posePrompt = PROMPTS.randomPoseExec(poseInstructions[i])
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
                  
                  await appendImageToGeneration({
                    taskId,
                    userId,
                    imageIndex: i,
                    imageUrl: uploaded,
                    modelType: result.model,
                    genMode: 'simple',
                    prompt: posePrompt,
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

