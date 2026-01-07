import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: NextRequest) {
  try {
    const { productPageData, instagramData, videoData } = await request.json()

    console.log('[Brand Style] Generating brand summary...')

    const prompt = `你是一位品牌策略专家。基于以下品牌素材分析，请生成一份品牌风格摘要。

## 官网分析
- 品牌描述: ${productPageData.brandSummary || '未提供'}
- 品牌关键词: ${productPageData.brandKeywords?.join(', ') || '未提供'}

## Instagram 风格
- 已分析图片数量: ${instagramData.images?.length || 0}
- 内容描述: ${instagramData.caption?.slice(0, 200) || '未提供'}

## UGC 视频风格
- 视频提示词: ${videoData.prompt || '未提供'}

请输出 JSON 格式：
{
  "summary": "品牌风格的综合描述（100字以内，中文）",
  "styleKeywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "targetAudience": "目标受众描述",
  "visualStyle": "视觉风格特点",
  "contentTone": "内容调性"
}`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })

    const responseText = result.text || ''
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse summary response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      summary: parsed.summary || '时尚、年轻、充满活力的品牌风格',
      styleKeywords: parsed.styleKeywords || ['时尚', '年轻', '活力', '品质', '潮流'],
      targetAudience: parsed.targetAudience || '',
      visualStyle: parsed.visualStyle || '',
      contentTone: parsed.contentTone || ''
    })

  } catch (error) {
    console.error('[Brand Style] Error generating summary:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

