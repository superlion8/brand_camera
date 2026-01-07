import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Extract Instagram post ID from URL
function extractPostId(url: string): string | null {
  // Handle various Instagram URL formats
  // https://www.instagram.com/p/ABC123/
  // https://www.instagram.com/reel/ABC123/
  // https://instagram.com/p/ABC123/?img_index=1
  const patterns = [
    /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/[^\/]+\/(?:p|reel)\/([A-Za-z0-9_-]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

// Fetch Instagram post data using RapidAPI
async function fetchInstagramPost(url: string): Promise<{ images: string[]; caption: string }> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  
  if (!rapidApiKey) {
    // Fallback: Try to use Jina Reader for Instagram
    console.log('[Instagram] No RapidAPI key, trying Jina Reader fallback...')
    return fetchInstagramViaJina(url)
  }

  const postId = extractPostId(url)
  if (!postId) {
    throw new Error('Invalid Instagram URL')
  }

  try {
    const response = await fetch(
      `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${encodeURIComponent(url)}`,
      {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`RapidAPI error: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Extract images from response
    const images: string[] = []
    
    if (data.data?.carousel_media) {
      // Carousel post with multiple images
      for (const item of data.data.carousel_media) {
        if (item.image_versions2?.candidates?.[0]?.url) {
          images.push(item.image_versions2.candidates[0].url)
        }
      }
    } else if (data.data?.image_versions2?.candidates?.[0]?.url) {
      // Single image post
      images.push(data.data.image_versions2.candidates[0].url)
    }

    const caption = data.data?.caption?.text || ''

    return { images, caption }

  } catch (error) {
    console.error('[Instagram] RapidAPI error, trying fallback:', error)
    return fetchInstagramViaJina(url)
  }
}

// Fallback: Use Jina Reader to extract Instagram content
async function fetchInstagramViaJina(url: string): Promise<{ images: string[]; caption: string }> {
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

