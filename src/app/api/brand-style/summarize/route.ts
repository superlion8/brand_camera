import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Get language-specific prompt and defaults
function getLanguageConfig(language: string) {
  switch (language) {
    case 'en':
      return {
        outputLang: 'English',
        summaryExample: 'A comprehensive brand style description (within 100 words)',
        keywordsExample: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5'],
        defaultSummary: 'Fashion-forward, youthful, and vibrant brand style',
        defaultKeywords: ['Fashion', 'Youthful', 'Vibrant', 'Quality', 'Trendy'],
        notProvided: 'Not provided'
      }
    case 'ko':
      return {
        outputLang: 'Korean',
        summaryExample: '브랜드 스타일 종합 설명 (100자 이내)',
        keywordsExample: ['키워드1', '키워드2', '키워드3', '키워드4', '키워드5'],
        defaultSummary: '패셔너블하고 젊고 활기찬 브랜드 스타일',
        defaultKeywords: ['패션', '젊음', '활력', '품질', '트렌디'],
        notProvided: '제공되지 않음'
      }
    default: // zh
      return {
        outputLang: 'Chinese',
        summaryExample: '品牌风格的综合描述（100字以内）',
        keywordsExample: ['关键词1', '关键词2', '关键词3', '关键词4', '关键词5'],
        defaultSummary: '时尚、年轻、充满活力的品牌风格',
        defaultKeywords: ['时尚', '年轻', '活力', '品质', '潮流'],
        notProvided: '未提供'
      }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productPageData, instagramData, videoData, language = 'zh' } = await request.json()

    console.log('[Brand Style] Generating brand summary...')
    console.log('[Brand Style] Language:', language)
    console.log('[Brand Style] Data available:', {
      hasProductPage: !!productPageData,
      hasInstagram: !!instagramData,
      hasVideo: !!videoData
    })

    const langConfig = getLanguageConfig(language)

    const prompt = `You are a brand strategy expert. Based on the following brand material analysis, generate a brand style summary.

## Website Analysis
- Brand Description: ${productPageData?.brandSummary || langConfig.notProvided}
- Brand Keywords: ${productPageData?.brandKeywords?.join(', ') || langConfig.notProvided}

## Instagram Style
- Number of images analyzed: ${instagramData?.images?.length || 0}
- Content Description: ${instagramData?.caption?.slice(0, 200) || langConfig.notProvided}

## UGC Video Style
- Video Prompt: ${videoData?.prompt || langConfig.notProvided}

IMPORTANT: Output ALL text content in ${langConfig.outputLang} language.

Output JSON format:
{
  "summary": "${langConfig.summaryExample}",
  "styleKeywords": ${JSON.stringify(langConfig.keywordsExample)},
  "targetAudience": "Target audience description in ${langConfig.outputLang}",
  "visualStyle": "Visual style characteristics in ${langConfig.outputLang}",
  "contentTone": "Content tone in ${langConfig.outputLang}"
}`

    const genAI = getGenAIClient()
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })

    const responseText = extractText(result) || ''
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse summary response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      summary: parsed.summary || langConfig.defaultSummary,
      styleKeywords: parsed.styleKeywords || langConfig.defaultKeywords,
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

