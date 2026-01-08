import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Try to get product data from Shopify JSON API
async function tryShopifyJsonApi(url: string): Promise<{
  success: boolean
  images: string[]
  title: string
  description: string
} | null> {
  try {
    // Extract product handle from various Shopify URL formats
    // e.g., /products/product-name or /collections/xxx/products/product-name
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/products\/([^\/\?]+)/)
    if (!pathMatch) return null
    
    const productHandle = pathMatch[1]
    const jsonUrl = `${urlObj.origin}/products/${productHandle}.json`
    
    console.log('[Brand Style] Trying Shopify JSON API:', jsonUrl)
    
    const response = await fetch(jsonUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      cache: 'no-store',
    })
    
    if (!response.ok) {
      console.log('[Brand Style] Shopify JSON API not available:', response.status)
      return null
    }
    
    const data = await response.json()
    const product = data.product
    
    if (!product || !product.images || product.images.length === 0) {
      console.log('[Brand Style] No product images in Shopify JSON')
      return null
    }
    
    // Extract image URLs
    const images = product.images.map((img: { src: string }) => 
      img.src.replace(/\\\//g, '/')
    )
    
    console.log('[Brand Style] Shopify JSON API success! Found', images.length, 'images')
    console.log('[Brand Style] Product title:', product.title)
    
    return {
      success: true,
      images,
      title: product.title || '',
      description: product.body_html?.replace(/<[^>]*>/g, ' ').slice(0, 500) || ''
    }
  } catch (e) {
    console.log('[Brand Style] Shopify JSON API error:', (e as Error).message)
    return null
  }
}

// Try to extract Open Graph images from HTML (works for most e-commerce sites)
async function tryOpenGraphImages(url: string): Promise<string[]> {
  try {
    console.log('[Brand Style] Trying to extract Open Graph images...')
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })
    
    if (!response.ok) {
      console.log('[Brand Style] Failed to fetch page:', response.status)
      return []
    }
    
    const html = await response.text()
    const images: string[] = []
    const seen = new Set<string>()
    
    // Extract og:image meta tags
    const ogRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi
    let match
    while ((match = ogRegex.exec(html)) !== null) {
      const url = match[1]
      if (!seen.has(url)) {
        seen.add(url)
        images.push(url)
      }
    }
    
    // Also try the reverse order (content before property)
    const ogRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi
    while ((match = ogRegex2.exec(html)) !== null) {
      const url = match[1]
      if (!seen.has(url)) {
        seen.add(url)
        images.push(url)
      }
    }
    
    // Extract product images from JSON-LD structured data
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(match[1])
        // Handle single object or array
        const items = Array.isArray(jsonData) ? jsonData : [jsonData]
        for (const item of items) {
          if (item['@type'] === 'Product' && item.image) {
            const productImages = Array.isArray(item.image) ? item.image : [item.image]
            for (const img of productImages) {
              const imgUrl = typeof img === 'string' ? img : img.url
              if (imgUrl && !seen.has(imgUrl)) {
                seen.add(imgUrl)
                images.push(imgUrl)
              }
            }
          }
        }
      } catch {
        // JSON parse error, skip
      }
    }
    
    // Extract high-res product images from common patterns
    const productImgRegex = /<img[^>]+src=["']([^"']+(?:product|item|goods|main)[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi
    while ((match = productImgRegex.exec(html)) !== null) {
      const url = match[1]
      if (!seen.has(url) && !url.includes('thumb') && !url.includes('icon')) {
        seen.add(url)
        images.push(url.startsWith('//') ? 'https:' + url : url)
      }
    }
    
    console.log('[Brand Style] Open Graph/JSON-LD extracted', images.length, 'images')
    return images.slice(0, 10)
  } catch (e) {
    console.log('[Brand Style] Open Graph extraction error:', (e as Error).message)
    return []
  }
}

// Use Jina Reader to extract web page content (fallback)
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

// Image with surrounding context for LLM analysis
interface ImageWithContext {
  url: string
  context: string
  alt: string
}

// Step 1: Extract all image URLs with their surrounding context from FULL page
function extractImagesWithContext(pageContent: string): ImageWithContext[] {
  const results: ImageWithContext[] = []
  const seen = new Set<string>()
  
  const normalizeUrl = (rawUrl: string): string => {
    // Handle escaped slashes from JSON: \/ -> /
    let url = rawUrl.replace(/\\\//g, '/').replace(/\\"/g, '')
    // Handle double-escaped: \\/ -> /
    url = url.replace(/\\\\/g, '')
    // Handle protocol-relative URLs
    if (url.startsWith('//')) url = 'https:' + url
    return url
  }
  
  const shouldSkip = (url: string): boolean => {
    const lowerUrl = url.toLowerCase()
    // Skip obvious UI elements
    if (lowerUrl.includes('logo') && !lowerUrl.includes('catalog')) return true
    if (lowerUrl.includes('favicon')) return true
    if (lowerUrl.includes('icon') && !lowerUrl.includes('collection')) return true
    if (lowerUrl.includes('/flag')) return true
    if (lowerUrl.includes('payment')) return true
    if (lowerUrl.includes('badge')) return true
    if (lowerUrl.endsWith('.svg')) return true
    // Skip tiny images
    if (/[_x-](?:16|24|32|48|64)(?:x|_|\.|-|$)/i.test(url)) return true
    return false
  }
  
  const addImage = (url: string, context: string, alt: string) => {
    const normalized = normalizeUrl(url)
    if (!normalized.startsWith('http')) return
    if (shouldSkip(normalized)) return
    
    const baseUrl = normalized.split('?')[0]
    if (seen.has(baseUrl)) return
    seen.add(baseUrl)
    
    results.push({
      url: normalized,
      context: context.slice(0, 200).replace(/\s+/g, ' ').trim(),
      alt: alt.slice(0, 100)
    })
  }
  
  // Debug: Log a sample of the content
  console.log('[Brand Style] Page content length:', pageContent.length)
  
  let match
  
  // Pattern 1: Markdown images - both ![alt](url) and [![alt](url)] formats
  const mdRegex = /(.{0,100})\[?!\[([^\]]*)\]\(((?:https?:)?\/\/[^\s\)]+)\)/g
  let mdCount = 0
  while ((match = mdRegex.exec(pageContent)) !== null) {
    mdCount++
    const [, before, alt, url] = match
    const afterIdx = match.index + match[0].length
    const after = pageContent.slice(afterIdx, afterIdx + 100)
    addImage(url, `${before} [IMAGE: ${alt}] ${after}`, alt)
  }
  console.log('[Brand Style] Markdown pattern matched:', mdCount)
  
  // Pattern 2: Escaped JSON image URLs (Shopify format): "\/\/domain.com\/..." or "//domain.com/..."
  const jsonImgRegex = /"(\\?\/\\?\/[^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/gi
  let jsonCount = 0
  while ((match = jsonImgRegex.exec(pageContent)) !== null) {
    jsonCount++
    const url = match[1]
    const startIdx = Math.max(0, match.index - 150)
    const endIdx = Math.min(pageContent.length, match.index + match[0].length + 150)
    const context = pageContent.slice(startIdx, endIdx)
    addImage(url, context, '')
  }
  console.log('[Brand Style] JSON escaped URL pattern matched:', jsonCount)
  
  // Pattern 3: Direct HTTPS image URLs
  const httpsRegex = /(https:\/\/[^\s<>"'\)\]\\]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s<>"'\)\]\\]*)?)/gi
  let httpsCount = 0
  while ((match = httpsRegex.exec(pageContent)) !== null) {
    httpsCount++
    const url = match[1]
    const startIdx = Math.max(0, match.index - 100)
    const endIdx = Math.min(pageContent.length, match.index + match[0].length + 100)
    const context = pageContent.slice(startIdx, endIdx)
    const normalized = normalizeUrl(url)
    if (!seen.has(normalized.split('?')[0])) {
      addImage(url, context, '')
    }
  }
  console.log('[Brand Style] HTTPS URL pattern matched:', httpsCount)
  
  // Pattern 4: Shopify CDN URLs (with or without extension)
  const shopifyRegex = /((?:https?:)?\/\/[^\s<>"'\)\]\\]*(?:cdn\.shopify\.com|shopify\.com\/cdn)[^\s<>"'\)\]\\]*)/gi
  let shopifyCount = 0
  while ((match = shopifyRegex.exec(pageContent)) !== null) {
    shopifyCount++
    const url = match[1]
    const startIdx = Math.max(0, match.index - 100)
    const endIdx = Math.min(pageContent.length, match.index + match[0].length + 100)
    const context = pageContent.slice(startIdx, endIdx)
    const normalized = normalizeUrl(url)
    if (!seen.has(normalized.split('?')[0])) {
      addImage(url, context, '')
    }
  }
  console.log('[Brand Style] Shopify CDN pattern matched:', shopifyCount)
  
  console.log('[Brand Style] Total unique images extracted:', results.length)
  if (results.length > 0) {
    console.log('[Brand Style] First image:', results[0].url.slice(0, 80))
  }
  
  return results.slice(0, 30) // Limit to 30 images
}

// Step 2: Use LLM to analyze images with context and identify product images
async function extractProductImageUrls(pageContent: string, pageUrl: string): Promise<string[]> {
  const genAI = getGenAIClient()
  
  // Extract all images with context from FULL page (no truncation)
  const imagesWithContext = extractImagesWithContext(pageContent)
  
  if (imagesWithContext.length === 0) {
    console.log('[Brand Style] No images found in page')
    return []
  }
  
  // Format images for LLM
  const imageList = imagesWithContext.map((img, i) => 
    `[${i + 1}] URL: ${img.url}\n    Alt: ${img.alt || '(无)'}\n    上下文: ${img.context}`
  ).join('\n\n')
  
  const prompt = `你是电商网页分析专家。以下是从商品详情页（${pageUrl}）提取的图片列表。

每张图片包含：
- URL：图片地址
- Alt：图片描述文本
- 上下文：图片在页面中前后的文字

🎯 任务：根据【上下文】和【Alt 文本】判断哪些是主商品图片。

主商品图片特征：
- 上下文包含商品名称、价格、尺码、颜色选择等
- Alt 文本描述商品（如 "Cashmere Sweater", "产品图"）
- URL 包含 product、item、files 等关键词
- 通常是页面中间的大图

排除：
- 导航栏、页头、页脚区域的图片
- 上下文包含 "navigation"、"footer"、"menu"、"相关商品"、"推荐"
- Logo、图标、国旗、支付方式图片

图片列表：
${imageList}

输出 JSON（必须返回至少 1 个 URL）：
{
  "productImageUrls": ["url1", "url2", ...],
  "reasoning": "简短说明判断依据"
}`

  console.log('[Brand Style] Asking LLM to identify product images...')
  
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })

    const responseText = extractText(result) || ''
    console.log('[Brand Style] LLM response:', responseText.slice(0, 500))
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const urls = (parsed.productImageUrls || parsed.productImages || []) as string[]
      
      // Normalize URLs
      const normalizedUrls = urls.map(url => {
        let normalized = url.replace(/\\\//g, '/')
        if (normalized.startsWith('//')) normalized = 'https:' + normalized
        return normalized
      }).filter(url => url.startsWith('http'))
      
      if (normalizedUrls.length > 0) {
        console.log('[Brand Style] LLM identified', normalizedUrls.length, 'product images')
        console.log('[Brand Style] Reasoning:', parsed.reasoning)
        return normalizedUrls
      }
    }
  } catch (e) {
    console.error('[Brand Style] LLM error:', e)
  }
  
  // Fallback: return first few non-logo images
  console.log('[Brand Style] LLM failed, using fallback')
  return imagesWithContext.slice(0, 5).map(img => img.url)
}

// Step 2: Load images and use VLM to select best model/product images
async function analyzeImages(imageUrls: string[], language: string = 'zh'): Promise<{
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

  // VLM analysis - use language-specific instructions
  const langInstructions = getLanguageInstructions(language)
  const prompt = `You are a fashion e-commerce expert. These are product detail page images.

Please analyze and select:
1. **Best Model Image** (modelImageIndex): Image showing a model wearing/displaying the product, choose the clearest front-facing one
2. **Best Product Image** (productImageIndex): Pure product image (no model), if available
3. **Brand Style**: Analyze the brand's visual style

IMPORTANT: Output brandSummary and brandKeywords in ${langInstructions.outputLang} language.

Output JSON:
{
  "modelImageIndex": 0-${loadedImages.length - 1} or -1,
  "productImageIndex": 0-${loadedImages.length - 1} or -1,
  "brandSummary": "${langInstructions.exampleSummary}",
  "brandKeywords": ${JSON.stringify(langInstructions.exampleKeywords)}
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

// Get language-specific prompt instructions
function getLanguageInstructions(language: string): { outputLang: string, exampleSummary: string, exampleKeywords: string[] } {
  switch (language) {
    case 'en':
      return {
        outputLang: 'English',
        exampleSummary: 'Brand style description (within 50 words)',
        exampleKeywords: ['keyword1', 'keyword2', 'keyword3']
      }
    case 'ko':
      return {
        outputLang: 'Korean',
        exampleSummary: '브랜드 스타일 설명 (50자 이내)',
        exampleKeywords: ['키워드1', '키워드2', '키워드3']
      }
    default: // zh
      return {
        outputLang: 'Chinese',
        exampleSummary: '品牌风格描述（50字内）',
        exampleKeywords: ['关键词1', '关键词2', '关键词3']
      }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, language = 'zh' } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log('[Brand Style] Reading product page:', url, 'Language:', language)
    
    let imageUrls: string[] = []
    let pageContent = ''
    
    // Step 1: Try Shopify JSON API first (most reliable for Shopify sites)
    const shopifyData = await tryShopifyJsonApi(url)
    if (shopifyData && shopifyData.images.length > 0) {
      imageUrls = shopifyData.images
      console.log('[Brand Style] Using Shopify API images:', imageUrls.length)
    } else {
      // Step 2: Try Open Graph / JSON-LD (works for most e-commerce sites)
      const ogImages = await tryOpenGraphImages(url)
      if (ogImages.length > 0) {
        imageUrls = ogImages
        console.log('[Brand Style] Using Open Graph/JSON-LD images:', imageUrls.length)
      } else {
        // Step 3: Fallback to Jina Reader + LLM
        console.log('[Brand Style] Falling back to Jina Reader...')
        pageContent = await readWebPage(url)
        
        console.log('[Brand Style] Using LLM to identify product images...')
        imageUrls = await extractProductImageUrls(pageContent, url)
      }
    }
    
    if (imageUrls.length === 0) {
      throw new Error('未能从页面识别出商品图片，请确认链接是商品详情页')
    }
    console.log('[Brand Style] Found', imageUrls.length, 'product images')

    // Step 4: Load images and analyze with VLM
    console.log('[Brand Style] Loading and analyzing images...')
    const analysis = await analyzeImages(imageUrls, language)
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

