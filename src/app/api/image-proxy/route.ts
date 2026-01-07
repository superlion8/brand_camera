import { NextRequest, NextResponse } from 'next/server'

// Proxy external images (Instagram CDN, etc.) to avoid CORS/hotlink issues
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    // Validate URL is from allowed domains
    const urlObj = new URL(url)
    const allowedDomains = [
      'cdninstagram.com',
      'instagram.com',
      'fbcdn.net',
      'shopify.com',
      'wittmore.com'
    ]
    
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain))
    if (!isAllowed) {
      return new NextResponse('Domain not allowed', { status: 403 })
    }

    // Fetch the image with appropriate headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
      },
    })

    if (!response.ok) {
      console.error('[Image Proxy] Failed to fetch:', response.status, url.slice(0, 80))
      return new NextResponse('Failed to fetch image', { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[Image Proxy] Error:', error)
    return new NextResponse('Failed to proxy image', { status: 500 })
  }
}

