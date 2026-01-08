import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Use Jina Reader to extract web page content
async function readWebPage(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  console.log('[Brand Style] Fetching from Jina:', jinaUrl)
  
  const response = await fetch(jinaUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/plain',
    },
    cache: 'no-store',
  })
  
  console.log('[Brand Style] Jina response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[Brand Style] Jina error response:', errorText.slice(0, 500))
    
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
  return text
}

// Step 1: Use VLM to extract product image URLs from page content
async function extractProductImageUrls(pageContent: string, pageUrl: string): Promise<string[]> {
  const genAI = getGenAIClient()
  
  // Truncate content if too long (keep first 15000 chars which usually contains product info)
  const truncatedContent = pageContent.slice(0, 15000)
  
  const prompt = `你是一位电商网页分析专家。以下是一个商品详情页的内容（来自 ${pageUrl}）。

请从内容中找出【主商品】的图片 URL。

⚠️ 重要规则：
1. 只提取主商品的图片（模特穿着/展示商品的图，或纯商品图）
2. 忽略以下类型的图片：
   - 国旗、货币选择器、语言切换图标
   - 网站 logo、favicon、社交媒体图标
   - 导航栏图片、banner 广告
   - "相关商品"、"推荐商品" 区域的图片
   - 尺寸很小的图片（如 16x16, 32x32, 100x100）
3. 图片 URL 通常包含 cdn、shopify、或商品相关关键词
4. 优先选择高清大图（URL 中可能有 1080、2000 等尺寸参数）

请输出 JSON 格式（不要输出其他内容）：
{
  "productImages": ["url1", "url2", "url3"],
  "reasoning": "简短说明你是如何判断这些是主商品图片的"
}

网页内容：
${truncatedContent}`

  console.log('[Brand Style] Asking VLM to extract product image URLs...')
  
  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  })

  const responseText = extractText(result) || ''
  console.log('[Brand Style] VLM response:', responseText.slice(0, 500))
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[Brand Style] Failed to parse VLM response')
    return []
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const urls = (parsed.productImages || []) as string[]
    
    // Normalize URLs
    const normalizedUrls = urls.map(url => {
      // Handle escaped slashes
      let normalized = url.replace(/\\\//g, '/')
      // Handle protocol-relative URLs
      if (normalized.startsWith('//')) {
        normalized = 'https:' + normalized
      }
      return normalized
    }).filter(url => url.startsWith('http'))
    
    console.log('[Brand Style] VLM extracted', normalizedUrls.length, 'product image URLs')
    console.log('[Brand Style] Reasoning:', parsed.reasoning)
    
    return normalizedUrls
  } catch (e) {
    console.error('[Brand Style] JSON parse error:', e)
    return []
  }
}

// Step 2: Load images and use VLM to select best model/product images
async function analyzeImages(imageUrls: string[]): Promise<{
  images: string[]
  modelImage: string | null
  productImage: string | null
  brandSummary: string
  brandKeywords: string[]
}> {
  if (imageUrls.length === 0) {
    throw new Error('未找到商品图片，请尝试其他链接')
  }

  // Take first 5 images max
  const imagesToAnalyze = imageUrls.slice(0, 5)
  console.log('[Brand Style] Loading', imagesToAnalyze.length, 'product images for analysis')
  
  const genAI = getGenAIClient()
  
  // Load images with browser-like headers
  const loadedImages: { url: string; part: { inlineData: { mimeType: string; data: string } } }[] = []
  
  for (let i = 0; i < imagesToAnalyze.length; i++) {
    const url = imagesToAnalyze[i]
    try {
      console.log(`[Brand Style] Loading image ${i}:`, url.slice(0, 100))
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': new URL(url).origin + '/',
        },
        cache: 'no-store',
      })
      
      if (!response.ok) {
        console.log(`[Brand Style] Image ${i} fetch failed: ${response.status}`)
        continue
      }
      
      const buffer = await response.arrayBuffer()
      
      // Skip too small or too large
      if (buffer.byteLength < 1000 || buffer.byteLength > 10 * 1024 * 1024) {
        console.log(`[Brand Style] Image ${i} size invalid: ${buffer.byteLength} bytes`)
        continue
      }
      
      // Check magic bytes
      const bytes = new Uint8Array(buffer.slice(0, 4))
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
      const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      
      if (!isJpeg && !isPng && !isGif && !isWebp) {
        console.log(`[Brand Style] Image ${i} invalid format`)
        continue
      }
      
      let mimeType = 'image/jpeg'
      if (isPng) mimeType = 'image/png'
      else if (isGif) mimeType = 'image/gif'
      else if (isWebp) mimeType = 'image/webp'
      
      const base64 = Buffer.from(buffer).toString('base64')
      console.log(`[Brand Style] Image ${i} loaded: ${mimeType}, ${buffer.byteLength} bytes`)
      
      loadedImages.push({
        url,
        part: { inlineData: { mimeType, data: base64 } }
      })
    } catch (err) {
      console.log(`[Brand Style] Image ${i} error:`, (err as Error).message)
    }
  }
  
  console.log(`[Brand Style] Successfully loaded ${loadedImages.length} images`)
  
  if (loadedImages.length === 0) {
    throw new Error('无法加载商品图片，该网站可能有图片防盗链保护')
  }

  // VLM analysis
  const prompt = `你是时尚电商专家。这些是商品详情页的主商品图片。

请分析并选出：
1. **最佳模特图** (modelImageIndex): 模特穿着/展示商品的图片，选最清晰的正面图
2. **最佳商品图** (productImageIndex): 纯商品图（无模特），如果有的话
3. **品牌风格**: 分析品牌视觉风格

输出 JSON：
{
  "modelImageIndex": 0-${loadedImages.length - 1} 或 -1,
  "productImageIndex": 0-${loadedImages.length - 1} 或 -1,
  "brandSummary": "品牌风格描述（50字内）",
  "brandKeywords": ["关键词1", "关键词2", "关键词3"]
}`

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        ...loadedImages.map(img => img.part)
      ]
    }]
  })

  const responseText = extractText(result) || ''
  console.log('[Brand Style] VLM analysis response:', responseText.slice(0, 300))
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('VLM 分析失败')
  }
  
  const parsed = JSON.parse(jsonMatch[0])
  const modelIdx = parsed.modelImageIndex
  const productIdx = parsed.productImageIndex
  
  const modelImage = (modelIdx >= 0 && modelIdx < loadedImages.length) 
    ? loadedImages[modelIdx].url 
    : loadedImages[0].url
    
  const productImage = (productIdx >= 0 && productIdx < loadedImages.length)
    ? loadedImages[productIdx].url
    : null
    
  console.log('[Brand Style] Selected model image:', modelIdx)
  console.log('[Brand Style] Selected product image:', productIdx)
  
  return {
    images: loadedImages.map(img => img.url),
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

    // Step 1: Read web page content with Jina
    console.log('[Brand Style] Reading product page:', url)
    const pageContent = await readWebPage(url)

    // Step 2: Use VLM to extract product image URLs from page content
    console.log('[Brand Style] Using VLM to identify product images...')
    const imageUrls = await extractProductImageUrls(pageContent, url)
    
    if (imageUrls.length === 0) {
      throw new Error('未能从页面识别出商品图片，请确认链接是商品详情页')
    }
    console.log('[Brand Style] VLM identified', imageUrls.length, 'product images')

    // Step 3: Load images and analyze with VLM
    console.log('[Brand Style] Loading and analyzing images...')
    const analysis = await analyzeImages(imageUrls)
    console.log('[Brand Style] Analysis complete')

    return NextResponse.json({
      images: analysis.images,
      modelImage: analysis.modelImage,
      productImage: analysis.productImage,
      brandSummary: analysis.brandSummary,
      brandKeywords: analysis.brandKeywords,
      rawContent: pageContent.slice(0, 2000)
    })

  } catch (error) {
    console.error('[Brand Style] Error reading product page:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

