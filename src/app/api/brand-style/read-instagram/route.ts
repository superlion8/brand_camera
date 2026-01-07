import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Fetch Instagram post data by scraping the page directly (no external API needed)
async function fetchInstagramPost(url: string): Promise<{ images: string[]; caption: string }> {
  console.log('[Instagram] Fetching post directly:', url)
  
  // Clean URL - remove query params for the fetch
  const cleanUrl = url.split('?')[0]
  
  try {
    // Fetch the Instagram page with browser-like headers
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      }
    })

    if (!response.ok) {
      console.error('[Instagram] Failed to fetch page:', response.status)
      throw new Error(`Failed to fetch Instagram page: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[Instagram] Got HTML, length:', html.length)
    
    const images: string[] = []
    let caption = ''

    // Method 1: Extract og:image meta tag (main image)
    const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) ||
                         html.match(/content="([^"]+)"\s+property="og:image"/i) ||
                         html.match(/og:image[^>]*content="([^"]+)"/i)
    
    if (ogImageMatch) {
      // Decode HTML entities
      const imageUrl = ogImageMatch[1].replace(/&amp;/g, '&')
      console.log('[Instagram] Found og:image:', imageUrl.slice(0, 100))
      images.push(imageUrl)
    }

    // Method 2: Extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i)
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1])
        if (jsonLd.image) {
          const ldImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
          for (const img of ldImages) {
            const imgUrl = typeof img === 'string' ? img : img.url
            if (imgUrl && !images.includes(imgUrl)) {
              images.push(imgUrl)
            }
          }
        }
        if (jsonLd.caption) {
          caption = jsonLd.caption
        }
      } catch (e) {
        console.log('[Instagram] Failed to parse JSON-LD')
      }
    }

    // Method 3: Extract additional images from page content
    // Look for Instagram CDN URLs in the HTML
    const cdnRegex = /(https:\/\/(?:scontent|instagram)[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*)/gi
    let match
    while ((match = cdnRegex.exec(html)) !== null) {
      let imgUrl = match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&')
      // Filter out small images (profile pics, icons)
      if (!imgUrl.includes('s150x150') && 
          !imgUrl.includes('s320x320') &&
          !imgUrl.includes('_n.jpg?_nc_cat') && // Skip if already in list
          !images.some(existing => existing.includes(imgUrl.split('?')[0].slice(-30)))) {
        images.push(imgUrl)
      }
    }

    // Method 4: Extract og:description for caption
    if (!caption) {
      const descMatch = html.match(/property="og:description"\s+content="([^"]+)"/i) ||
                        html.match(/content="([^"]+)"\s+property="og:description"/i)
      if (descMatch) {
        caption = descMatch[1].replace(/&amp;/g, '&').replace(/&#[0-9]+;/g, '')
      }
    }

    console.log('[Instagram] Extracted', images.length, 'images')
    
    if (images.length === 0) {
      throw new Error('No images found on Instagram page')
    }

    return { images, caption }

  } catch (error) {
    console.error('[Instagram] Direct fetch failed:', error)
    // Try Jina as last resort
    return fetchInstagramViaJina(url)
  }
}

// Fallback: Use Jina Reader to extract Instagram content
async function fetchInstagramViaJina(url: string): Promise<{ images: string[]; caption: string }> {
  console.log('[Instagram] Trying Jina Reader fallback...')
  
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'Accept': 'text/plain',
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to read Instagram page: ${response.statusText}`)
  }
  
  const text = await response.text()
  
  // Extract image URLs
  const imageRegex = /(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|webp))/gi
  const images: string[] = []
  let match
  while ((match = imageRegex.exec(text)) !== null) {
    // Filter for Instagram CDN images
    if (match[1].includes('instagram') || match[1].includes('cdninstagram') || match[1].includes('fbcdn')) {
      if (!images.includes(match[1])) {
        images.push(match[1])
      }
    }
  }
  
  return { images, caption: '' }
}

// Use VLM to find the best model image
async function findBestModelImage(images: string[]): Promise<string> {
  if (images.length === 0) {
    throw new Error('No images found in Instagram post')
  }
  
  if (images.length === 1) {
    return images[0]
  }

  const genAI = getGenAIClient()

  // Limit to first 10 images
  const imagesToAnalyze = images.slice(0, 10)
  
  // Create image parts
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
    return images[0] // Fallback to first image
  }

  const prompt = `你是一位时尚社交媒体专家。请分析这些 Instagram 图片，找出最适合作为模特展示参考的图片。

要求：
- 单人模特展示商品/服装
- 构图清晰，风格时尚
- 适合作为电商模特图的参考

请只输出一个数字（0-${validImageParts.length - 1}），表示最佳图片的索引。`

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

  const responseText = extractText(result) || '0'
  const index = parseInt(responseText.match(/\d+/)?.[0] || '0', 10)
  
  return imagesToAnalyze[Math.min(index, imagesToAnalyze.length - 1)]
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Step 1: Fetch Instagram post data
    console.log('[Brand Style] Reading Instagram post:', url)
    const { images, caption } = await fetchInstagramPost(url)
    console.log('[Brand Style] Found', images.length, 'images')

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found in Instagram post' },
        { status: 400 }
      )
    }

    // Step 2: Find best model image using VLM
    console.log('[Brand Style] Finding best model image...')
    const bestModelImage = await findBestModelImage(images)
    console.log('[Brand Style] Best model image found')

    return NextResponse.json({
      images,
      bestModelImage,
      caption
    })

  } catch (error) {
    console.error('[Brand Style] Error reading Instagram:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

