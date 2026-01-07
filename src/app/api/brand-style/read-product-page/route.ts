import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Use Jina Reader to extract web page content
async function readWebPage(url: string): Promise<{ markdown: string; images: string[] }> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'Accept': 'application/json',
      'X-Return-Format': 'markdown',
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to read web page: ${response.statusText}`)
  }
  
  const text = await response.text()
  
  // Extract image URLs from markdown
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g
  const images: string[] = []
  let match
  while ((match = imageRegex.exec(text)) !== null) {
    images.push(match[1])
  }
  
  // Also try to find direct image URLs
  const directImageRegex = /(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|webp|gif))/gi
  while ((match = directImageRegex.exec(text)) !== null) {
    if (!images.includes(match[1])) {
      images.push(match[1])
    }
  }
  
  return { markdown: text, images }
}

// Use VLM to analyze images and find best model/product images
async function analyzeImages(images: string[]): Promise<{
  modelImage: string | null
  productImage: string | null
  brandSummary: string
  brandKeywords: string[]
}> {
  if (images.length === 0) {
    throw new Error('No images found on the page')
  }

  // Limit to first 10 images for analysis
  const imagesToAnalyze = images.slice(0, 10)
  
  const genAI = getGenAIClient()
  
  // Create image parts for the prompt
  const imageParts = await Promise.all(
    imagesToAnalyze.map(async (url, index) => {
      try {
        const response = await fetch(url)
        if (!response.ok) return null
        const buffer = await response.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = response.headers.get('content-type') || 'image/jpeg'
        return {
          inlineData: {
            mimeType,
            data: base64
          }
        }
      } catch {
        return null
      }
    })
  )
  
  const validImageParts = imageParts.filter(p => p !== null)
  
  if (validImageParts.length === 0) {
    throw new Error('Failed to load any images')
  }

  const prompt = `你是一位时尚电商专家。请分析这些商品页面的图片，找出：

1. **最佳模特图**: 找出一张最典型的单人模特正面展示商品的图片（模特穿着/展示商品，背景清晰，构图专业）
2. **最佳商品图**: 找出一张最典型的无模特纯商品棚拍图（如果存在的话）
3. **品牌风格**: 总结这个品牌的视觉风格和调性

请以 JSON 格式输出：
{
  "modelImageIndex": 0-9 的数字，表示最佳模特图的索引，如果没有则为 -1,
  "productImageIndex": 0-9 的数字，表示最佳商品图的索引，如果没有则为 -1,
  "brandSummary": "品牌风格的简短描述（50字以内）",
  "brandKeywords": ["关键词1", "关键词2", "关键词3"]
}`

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...validImageParts
        ]
      }
    ]
  })

  const responseText = extractText(result) || ''
  
  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse VLM response')
  }
  
  const parsed = JSON.parse(jsonMatch[0])
  
  return {
    modelImage: parsed.modelImageIndex >= 0 ? imagesToAnalyze[parsed.modelImageIndex] : imagesToAnalyze[0],
    productImage: parsed.productImageIndex >= 0 ? imagesToAnalyze[parsed.productImageIndex] : null,
    brandSummary: parsed.brandSummary || '',
    brandKeywords: parsed.brandKeywords || []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Step 1: Read web page content
    console.log('[Brand Style] Reading product page:', url)
    const { markdown, images } = await readWebPage(url)
    console.log('[Brand Style] Found', images.length, 'images')

    // Step 2: Analyze images with VLM
    console.log('[Brand Style] Analyzing images with VLM...')
    const analysis = await analyzeImages(images)
    console.log('[Brand Style] Analysis complete')

    return NextResponse.json({
      images,
      modelImage: analysis.modelImage,
      productImage: analysis.productImage,
      brandSummary: analysis.brandSummary,
      brandKeywords: analysis.brandKeywords,
      rawContent: markdown.slice(0, 2000) // Truncate for response size
    })

  } catch (error) {
    console.error('[Brand Style] Error reading product page:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

