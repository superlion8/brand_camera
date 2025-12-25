import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { generateId } from '@/lib/utils'
import { uploadGeneratedImageServer } from '@/lib/supabase/storage-server'

export const maxDuration = 180 // 3 minutes

// 反推 Prompt
const ANALYZE_REFERENCE_PROMPT = `你是一位顶尖时尚杂志的选角导演。请忽略输入图片中的排版、拼接、穿搭或背景元素，只聚焦于画面中的模特本人的特征。

请提取以下维度的视觉特征，并整合成一段连贯的英文描述（Subject Description）：
1. Look & Face: 具体的面部轮廓、五官特征、发型发色。
2. Body & Fit: 模特的身材比例（需强调是标准的时尚模特身材）。
3. Vibe: 模特展现出的冷峻、高级或独特的氛围感。
  
输出约束（必须严格遵守）：
1. 禁止描述构图： 你的输出文本中绝对不要包含 "view", "angle", "split", "collage", "camera" 等关于画面构图的词汇，只描述"人"。
2. 英文输出： 为了更好的生图效果，请直接输出英文描述。
  
输出格式 JSON：
{
  "analysis_summary": "中文简报（用于人类阅读）",
  "subject_description": "English description of the model's physical appearance and vibe only."
}`

// 生成模特图片的 Prompt
const GENERATE_MODEL_PROMPT = `[Role: World-Class E-commerce Photographer & Retoucher]

# Input
- Model Description: {subject_description}
- User Additional Requirements: {user_prompt}

# Task
Generate a high-fidelity e-commerce fashion model portrait based on the model description.

# Execution Steps
1. Subject Construction (Priority High): Create a model that strictly matches the description provided. Maintain anatomical integrity with proper 8-head figure proportions.
2. Pose & Expression: Natural, confident model pose suitable for fashion photography. Professional yet approachable expression.
3. Studio Setup:
   - Lighting: Professional studio lighting promoting form and texture.
   - Background: Clean, neutral studio background.
   - Framing: Full body or 3/4 body vertical composition (9:16 ratio).

# Quality Constraints
- Maintain anatomical integrity. No weird hands, distorted legs, or incorrect head-to-body ratios.
- Photorealistic, 8k resolution.
- The model should look like a real fashion model ready for a photoshoot.

# Output
The final image only.`

// Helper to ensure base64 data
async function ensureBase64Data(image: string): Promise<string> {
  if (image.startsWith('data:')) {
    return image.split(',')[1] || image
  }
  if (image.startsWith('http')) {
    console.log('[GenerateModel] Fetching image from URL:', image)
    
    // 尝试获取图片，如果 .png 失败则尝试 .jpg
    let response = await fetch(image)
    
    if (!response.ok && image.endsWith('.png')) {
      const jpgUrl = image.replace('.png', '.jpg')
      console.log('[GenerateModel] PNG failed, trying JPG:', jpgUrl)
      response = await fetch(jpgUrl)
    }
    
    if (!response.ok) {
      console.error('[GenerateModel] Failed to fetch image:', response.status, response.statusText)
      throw new Error(`无法获取参考图片: ${response.status}`)
    }
    
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength === 0) {
      throw new Error('获取的图片为空')
    }
    
    console.log('[GenerateModel] Image fetched, size:', buffer.byteLength)
    return Buffer.from(buffer).toString('base64')
  }
  return image
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
      referenceImage,      // 参考模特图（模式1）或选中的模特图（模式2）
      userPrompt,          // 用户额外输入
      subjectDescription,  // 已有的 subject_description（可选，跳过反推）
    } = body
    
    if (!referenceImage) {
      return NextResponse.json({ success: false, error: '缺少参考模特图' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    let finalSubjectDescription = subjectDescription
    let analysisSummary = ''
    
    // Step 1: 如果没有提供 subjectDescription，先反推模特信息
    if (!finalSubjectDescription) {
      console.log('[GenerateModel] Analyzing reference image...')
      
      const imageData = await ensureBase64Data(referenceImage)
      
      const analyzeResponse = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          role: 'user',
          parts: [
            { text: ANALYZE_REFERENCE_PROMPT },
            { text: '\n\n[参考模特图]:' },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData,
              },
            },
          ],
        }],
        config: { safetySettings },
      })
      
      const textResult = extractText(analyzeResponse)
      
      if (!textResult) {
        return NextResponse.json({ success: false, error: '模特分析失败，请重试' }, { status: 500 })
      }
      
      // Parse JSON response
      try {
        const jsonMatch = textResult.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const analysisResult = JSON.parse(jsonMatch[0])
          finalSubjectDescription = analysisResult.subject_description
          analysisSummary = analysisResult.analysis_summary || ''
        }
      } catch (parseError) {
        console.error('[GenerateModel] Failed to parse analysis:', textResult)
        return NextResponse.json({ success: false, error: 'AI 分析格式错误，请重试' }, { status: 500 })
      }
      
      if (!finalSubjectDescription) {
        return NextResponse.json({ success: false, error: '无法提取模特描述，请重试' }, { status: 500 })
      }
      
      console.log('[GenerateModel] Analysis complete:', analysisSummary?.substring(0, 50) + '...')
    }
    
    // Step 2: 生成新模特图片
    console.log('[GenerateModel] Generating new model image...')
    
    // 拼接 subject_description 和 user_prompt
    const finalPrompt = GENERATE_MODEL_PROMPT
      .replace('{subject_description}', finalSubjectDescription)
      .replace('{user_prompt}', userPrompt || 'No additional requirements.')
    
    const generateResponse = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{
        role: 'user',
        parts: [{ text: finalPrompt }],
      }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const imageResult = extractImage(generateResponse)
    
    if (!imageResult) {
      return NextResponse.json({ success: false, error: 'AI 图片生成失败，请重试' }, { status: 500 })
    }
    
    // Upload to storage
    const generationId = generateId()
    const base64Url = `data:image/png;base64,${imageResult}`
    const uploadedUrl = await uploadGeneratedImageServer(base64Url, generationId, 0, userId)
    
    if (!uploadedUrl) {
      console.error('[GenerateModel] Failed to upload to storage')
      return NextResponse.json({ success: false, error: '图片上传失败，请重试' }, { status: 500 })
    }
    
    console.log('[GenerateModel] Success, uploaded to storage:', uploadedUrl)
    
    return NextResponse.json({
      success: true,
      imageUrl: uploadedUrl,
      generationId,
      analysisSummary,
      subjectDescription: finalSubjectDescription,
    })
    
  } catch (error: any) {
    console.error('[GenerateModel] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '图片生成失败，请重试'
    }, { status: 500 })
  }
}

