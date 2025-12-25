import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 120 // 2 minutes

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

// Helper to ensure base64 data
async function ensureBase64Data(image: string): Promise<string> {
  if (image.startsWith('data:')) {
    return image.split(',')[1] || image
  }
  if (image.startsWith('http')) {
    const response = await fetch(image)
    const buffer = await response.arrayBuffer()
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
  
  try {
    const body = await request.json()
    const { referenceImage } = body
    
    if (!referenceImage) {
      return NextResponse.json({ success: false, error: '缺少参考模特图' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const imageData = await ensureBase64Data(referenceImage)
    
    console.log('[AnalyzeReference] Calling Gemini Flash to analyze reference model...')
    
    const response = await client.models.generateContent({
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
      config: {
        safetySettings,
      },
    })
    
    const textResult = extractText(response)
    
    if (!textResult) {
      return NextResponse.json({ success: false, error: 'AI 分析失败，请重试' }, { status: 500 })
    }
    
    // Parse JSON response
    let analysisResult
    try {
      const jsonMatch = textResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('[AnalyzeReference] Failed to parse AI response:', textResult)
      return NextResponse.json({ success: false, error: 'AI 返回格式错误，请重试' }, { status: 500 })
    }
    
    if (!analysisResult.subject_description) {
      return NextResponse.json({ success: false, error: 'AI 返回格式错误：缺少模特描述' }, { status: 500 })
    }
    
    console.log('[AnalyzeReference] Success:', analysisResult.analysis_summary?.substring(0, 50) + '...')
    
    return NextResponse.json({
      success: true,
      analysisSummary: analysisResult.analysis_summary || '',
      subjectDescription: analysisResult.subject_description,
    })
    
  } catch (error: any) {
    console.error('[AnalyzeReference] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '分析失败，请重试'
    }, { status: 500 })
  }
}

