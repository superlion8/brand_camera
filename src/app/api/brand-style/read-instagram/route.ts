import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Primary method: Use RapidAPI instagram-scraper-stable-api to get Instagram post data
async function fetchInstagramViaRapidAPI(url: string): Promise<{ images: string[]; caption: string }> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) {
    throw new Error('RAPIDAPI_KEY not configured')
  }

  console.log('[Instagram] Using RapidAPI to fetch:', url)
  
  // Build API URL with encoded Instagram URL
  const encodedUrl = encodeURIComponent(url.split('?')[0])
  const apiUrl = `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data.php?reel_post_code_or_url=${encodedUrl}&type=post`
  
  const response = await fetch(apiUrl, {
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'instagram-scraper-stable-api.p.rapidapi.com'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Instagram] RapidAPI error:', response.status, errorText)
    throw new Error(`RapidAPI request failed: ${response.status}`)
  }

  const data = await response.json()
  console.log('[Instagram] RapidAPI response received, shortcode:', data.shortcode)
  
  const images: string[] = []
  let caption = ''

  // Get caption
  if (data.edge_media_to_caption?.edges?.[0]?.node?.text) {
    caption = data.edge_media_to_caption.edges[0].node.text
  }

  // Handle carousel (multiple images) or single image
  if (data.edge_sidecar_to_children?.edges) {
    // Carousel post with multiple images
    console.log('[Instagram] Carousel post with', data.edge_sidecar_to_children.edges.length, 'items')
    for (const edge of data.edge_sidecar_to_children.edges) {
      const node = edge.node
      if (node.display_url) {
        images.push(node.display_url)
      } else if (node.display_resources?.length > 0) {
        // Get highest resolution
        const highRes = node.display_resources[node.display_resources.length - 1]
        images.push(highRes.src)
      }
    }
  } else if (data.display_url) {
    // Single image post
    console.log('[Instagram] Single image post')
    images.push(data.display_url)
  } else if (data.display_resources?.length > 0) {
    // Fallback to display_resources
    const highRes = data.display_resources[data.display_resources.length - 1]
    images.push(highRes.src)
  } else if (data.thumbnail_src) {
    // Last fallback
    images.push(data.thumbnail_src)
  }

  console.log('[Instagram] Extracted', images.length, 'images from RapidAPI')
  
  if (images.length === 0) {
    throw new Error('No images found in RapidAPI response')
  }

  return { images, caption }
}

// Fallback method: Use embed page (may not work on all servers due to TLS fingerprinting)
async function fetchInstagramPost(url: string): Promise<{ images: string[]; caption: string }> {
  console.log('[Instagram] Fetching post via embed page:', url)
  
  // Clean URL and convert to embed URL
  let cleanUrl = url.split('?')[0]
  if (!cleanUrl.endsWith('/')) cleanUrl += '/'
  const embedUrl = cleanUrl + 'embed/'
  
  console.log('[Instagram] Embed URL:', embedUrl)
  
  try {
    // Fetch the Instagram embed page with comprehensive browser-like headers
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store',
    })

    console.log('[Instagram] Response status:', response.status)
    
    if (!response.ok) {
      console.error('[Instagram] Failed to fetch embed page:', response.status, response.statusText)
      throw new Error(`Failed to fetch Instagram embed page: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[Instagram] Got embed HTML, length:', html.length)
    
    // Debug: Check if we got a login page
    if (html.includes('Log into Instagram') || html.includes('login')) {
      console.log('[Instagram] Got login page instead of embed content')
    }
    
    const images: string[] = []
    let caption = ''

    // Extract all Instagram CDN image URLs from the embed page
    // Match URLs from instagram CDN (fbcdn.net or cdninstagram.com)
    const cdnRegex = /(https:\/\/[^"'\s,]+(?:instagram|fbcdn)[^"'\s,]+\.(?:jpg|jpeg|png|webp)[^"'\s,]*)/gi
    let match
    let totalMatches = 0
    while ((match = cdnRegex.exec(html)) !== null) {
      totalMatches++
      let imgUrl = match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&')
      
      // Filter out static resources (icons, logos), small images (profile pics), and duplicates
      if (imgUrl.includes('static.cdninstagram.com') || // static resources (logos, icons)
          imgUrl.includes('rsrc.php') ||                 // static resources
          imgUrl.includes('s150x150') || 
          imgUrl.includes('s240x240') ||
          imgUrl.includes('_a.jpg')) { // profile pics
        console.log('[Instagram] Filtered out:', imgUrl.slice(0, 60) + '...')
        continue
      }
      
      // Check for duplicates by comparing the base URL without size params
      const baseUrl = imgUrl.split('?')[0].slice(-50)
      if (!images.some(existing => existing.split('?')[0].slice(-50) === baseUrl)) {
        images.push(imgUrl)
        console.log('[Instagram] Found image:', imgUrl.slice(0, 80) + '...')
      }
    }
    
    console.log('[Instagram] Total regex matches:', totalMatches, 'Valid images:', images.length)

    // Extract caption from the embed page
    const captionMatch = html.match(/class="Caption"[^>]*>([^<]+)</i) ||
                         html.match(/"caption":\s*"([^"]+)"/i)
    if (captionMatch) {
      caption = captionMatch[1].replace(/\\n/g, ' ').replace(/\\u[\dA-Fa-f]{4}/g, '')
    }

    console.log('[Instagram] Extracted', images.length, 'images from embed page')
    
    if (images.length === 0) {
      // Debug: print first 500 chars of HTML to see what we got
      console.log('[Instagram] HTML preview:', html.slice(0, 500))
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
    // Try RapidAPI first (most reliable), then fall back to embed page
    console.log('[Brand Style] Reading Instagram post:', url)
    let images: string[] = []
    let caption = ''
    
    try {
      const result = await fetchInstagramViaRapidAPI(url)
      images = result.images
      caption = result.caption
      console.log('[Brand Style] RapidAPI success, found', images.length, 'images')
    } catch (rapidApiError) {
      console.log('[Brand Style] RapidAPI failed, trying embed page:', rapidApiError)
      try {
        const result = await fetchInstagramPost(url)
        images = result.images
        caption = result.caption
        console.log('[Brand Style] Embed page success, found', images.length, 'images')
      } catch (embedError) {
        console.error('[Brand Style] All methods failed')
        throw new Error('无法获取 Instagram 帖子图片，请检查链接或稍后重试')
      }
    }

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

