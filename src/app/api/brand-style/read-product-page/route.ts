import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Use Jina Reader to extract web page content
async function readWebPage(url: string): Promise<{ markdown: string; images: string[] }> {
  const jinaUrl = `https://r.jina.ai/${url}`
  console.log('[Brand Style] Fetching from Jina:', jinaUrl)
  
  // Try Jina Reader - simple request without extra headers that might cause issues
  const response = await fetch(jinaUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/plain',
    },
    // Disable Next.js fetch cache
    cache: 'no-store',
  })
  
  console.log('[Brand Style] Jina response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[Brand Style] Jina error response:', errorText.slice(0, 500))
    
    // Provide more helpful error messages
    if (response.status === 451) {
      throw new Error('该网站阻止了自动访问。请尝试其他品牌网站链接')
    }
    if (response.status === 403) {
      throw new Error('访问被拒绝，请尝试其他链接')
    }
    if (response.status === 422) {
      throw new Error('URL 格式无效，请检查链接')
    }
    throw new Error(`无法读取网页 (${response.status}): ${errorText.slice(0, 100)}`)
  }
  
  const text = await response.text()
  console.log('[Brand Style] Jina response length:', text.length)
  
  // Extract image URLs from markdown - multiple patterns
  const images: string[] = []
  
  // Helper to normalize URL and add to list
  const addImage = (rawUrl: string) => {
    // Handle escaped slashes from JSON (\/\/ -> //)
    let url = rawUrl.replace(/\\\//g, '/')
    // Handle protocol-relative URLs (// -> https://)
    if (url.startsWith('//')) {
      url = 'https:' + url
    }
    // Dedupe by base URL (without query params)
    const baseUrl = url.split('?')[0]
    if (!images.some(img => img.split('?')[0] === baseUrl) && isValidProductImage(url)) {
      images.push(url)
    }
  }
  
  // Pattern 1: Markdown image syntax (https:// or //)
  const markdownImageRegex = /!\[.*?\]\(((?:https?:)?\/\/[^\s\)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = markdownImageRegex.exec(text)) !== null) {
    addImage(match[1])
  }
  
  // Pattern 2: Direct image URLs (jpg, png, webp, gif) with https:// or //
  const directImageRegex = /((?:https?:)?\/\/[^\s<>"'\)]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s<>"']*)?)/gi
  while ((match = directImageRegex.exec(text)) !== null) {
    addImage(match[1])
  }
  
  // Pattern 3: JSON escaped URLs from Shopify data (\"images\":[\"\/\/wittmore.com/cdn/shop/files/..."])
  const jsonImageRegex = /\\?"(?:images|src|featured_image)\\?":\s*\\?"(\\\/\\\/[^"]+)\\?"/gi
  while ((match = jsonImageRegex.exec(text)) !== null) {
    addImage(match[1])
  }
  
  // Pattern 4: JSON image arrays ["\/\/wittmore.com/cdn/shop/files/..."]
  const jsonArrayRegex = /\\?"images\\?":\s*\[((?:"[^"]+",?\s*)+)\]/gi
  while ((match = jsonArrayRegex.exec(text)) !== null) {
    const arrayContent = match[1]
    const urlMatches = arrayContent.match(/\\?"(\\\/\\\/[^"]+)\\?"/g)
    if (urlMatches) {
      for (const urlMatch of urlMatches) {
        const cleanUrl = urlMatch.replace(/\\?"/g, '')
        addImage(cleanUrl)
      }
    }
  }
  
  // Pattern 5: Shopify CDN URLs with various formats
  const shopifyRegex = /((?:https?:)?\\?\/\\?\/[^\s<>"']*(?:cdn\.shopify\.com|wittmore\.com)\/cdn\/shop\/files\/[^\s<>"'\\]+\.(?:jpg|jpeg|png|webp|gif))/gi
  while ((match = shopifyRegex.exec(text)) !== null) {
    addImage(match[1])
  }
  
  console.log('[Brand Style] Extracted', images.length, 'images')
  if (images.length > 0) {
    console.log('[Brand Style] First few images:', images.slice(0, 3))
  }
  return { markdown: text, images }
}

// Filter out non-product images (icons, logos, etc.)
function isValidProductImage(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  // Skip small images, icons, logos
  if (lowerUrl.includes('icon') || lowerUrl.includes('logo') || lowerUrl.includes('favicon')) {
    return false
  }
  // Skip very small dimensions if in URL
  if (/[_x](?:16|24|32|48|64|100)(?:x|_|\.)/.test(lowerUrl)) {
    return false
  }
  return true
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

  // IMPORTANT: Only analyze the FIRST 5 images
  // Product main images are always at the top of the page
  // Images after that are usually "related products" which we should ignore
  const imagesToAnalyze = images.slice(0, 5)
  console.log('[Brand Style] Analyzing first', imagesToAnalyze.length, 'images (ignoring related products)')
  
  const genAI = getGenAIClient()
  
  // Create image parts for the prompt
  const imageParts = await Promise.all(
    imagesToAnalyze.map(async (url, index) => {
      try {
        console.log(`[Brand Style] Loading image ${index}:`, url.slice(0, 80))
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

  const prompt = `你是一位时尚电商专家。这些是同一个商品详情页的图片（按页面顺序排列）。

重要提示：这些图片都是同一个商品的不同展示图，请从中选择：

1. **最佳模特图**: 找出一张最典型的单人模特正面全身展示该商品的图片
   - 必须是模特穿着/展示商品
   - 优先选择正面、全身、清晰的图片
   
2. **最佳商品图**: 找出一张纯商品图（无模特），如果存在的话

3. **品牌风格**: 总结这个品牌的视觉风格

输出 JSON：
{
  "modelImageIndex": 0-${validImageParts.length - 1} 的数字，表示最佳模特图索引，-1表示无,
  "productImageIndex": 0-${validImageParts.length - 1} 的数字，表示最佳商品图索引，-1表示无,
  "brandSummary": "品牌风格描述（50字内）",
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
  
  // Ensure index is within valid range
  const modelIdx = parsed.modelImageIndex
  const productIdx = parsed.productImageIndex
  
  const modelImage = (modelIdx >= 0 && modelIdx < imagesToAnalyze.length) 
    ? imagesToAnalyze[modelIdx] 
    : imagesToAnalyze[0] // Default to first image
    
  const productImage = (productIdx >= 0 && productIdx < imagesToAnalyze.length)
    ? imagesToAnalyze[productIdx]
    : null
    
  console.log('[Brand Style] Selected model image index:', modelIdx)
  console.log('[Brand Style] Selected product image index:', productIdx)
  
  return {
    modelImage,
    productImage,
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

