import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Fetch Instagram post data using the embed page (doesn't require login)
async function fetchInstagramPost(url: string): Promise<{ images: string[]; caption: string }> {
  console.log('[Instagram] Fetching post via embed page:', url)
  
  // Clean URL and convert to embed URL
  let cleanUrl = url.split('?')[0]
  if (!cleanUrl.endsWith('/')) cleanUrl += '/'
  const embedUrl = cleanUrl + 'embed/'
  
  try {
    // Fetch the Instagram embed page (doesn't require login)
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    if (!response.ok) {
      console.error('[Instagram] Failed to fetch embed page:', response.status)
      throw new Error(`Failed to fetch Instagram embed page: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[Instagram] Got embed HTML, length:', html.length)
    
    const images: string[] = []
    let caption = ''

    // Extract all Instagram CDN image URLs from the embed page
    // Match URLs from instagram CDN (fbcdn.net or cdninstagram.com)
    const cdnRegex = /(https:\/\/[^"'\s,]+(?:instagram|fbcdn)[^"'\s,]+\.(?:jpg|jpeg|png|webp)[^"'\s,]*)/gi
    let match
    while ((match = cdnRegex.exec(html)) !== null) {
      let imgUrl = match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&')
      
      // Filter out static resources (icons, logos), small images (profile pics), and duplicates
      if (imgUrl.includes('static.cdninstagram.com') || // static resources (logos, icons)
          imgUrl.includes('rsrc.php') ||                 // static resources
          imgUrl.includes('s150x150') || 
          imgUrl.includes('s240x240') ||
          imgUrl.includes('_a.jpg')) { // profile pics
        continue
      }
      
      // Check for duplicates by comparing the base URL without size params
      const baseUrl = imgUrl.split('?')[0].slice(-50)
      if (!images.some(existing => existing.split('?')[0].slice(-50) === baseUrl)) {
        images.push(imgUrl)
        console.log('[Instagram] Found image:', imgUrl.slice(0, 80) + '...')
      }
    }

    // Extract caption from the embed page
    const captionMatch = html.match(/class="Caption"[^>]*>([^<]+)</i) ||
                         html.match(/"caption":\s*"([^"]+)"/i)
    if (captionMatch) {
      caption = captionMatch[1].replace(/\\n/g, ' ').replace(/\\u[\dA-Fa-f]{4}/g, '')
    }

    console.log('[Instagram] Extracted', images.length, 'images from embed page')
    
    if (images.length === 0) {
      throw new Error('No images found in Instagram embed page')
    }

    // Prefer higher resolution images (filter out smaller versions)
    const filteredImages = filterHighResImages(images)
    console.log('[Instagram] After filtering:', filteredImages.length, 'high-res images')

    return { images: filteredImages, caption }

  } catch (error) {
    console.error('[Instagram] Embed fetch failed:', error)
    // Try Jina as last resort
    return fetchInstagramViaJina(url)
  }
}

// Filter to keep only the highest resolution version of each image
function filterHighResImages(images: string[]): string[] {
  const imageMap = new Map<string, string>()
  
  for (const url of images) {
    // Extract the unique image ID from the URL
    const idMatch = url.match(/\/([^\/]+)_n\.jpg/) || url.match(/\/(\d+_\d+)/)
    if (!idMatch) {
      imageMap.set(url, url)
      continue
    }
    
    const imageId = idMatch[1]
    const existing = imageMap.get(imageId)
    
    if (!existing) {
      imageMap.set(imageId, url)
    } else {
      // Prefer URLs with higher resolution indicators
      const hasHighRes = (u: string) => u.includes('1080') || u.includes('p750') || (!u.includes('p640') && !u.includes('s640'))
      if (hasHighRes(url) && !hasHighRes(existing)) {
        imageMap.set(imageId, url)
      }
    }
  }
  
  return Array.from(imageMap.values())
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

