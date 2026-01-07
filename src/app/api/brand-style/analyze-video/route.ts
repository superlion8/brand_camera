import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'

// Get TikTok video download URL using RapidAPI
async function getTikTokVideoUrl(url: string): Promise<{ videoUrl: string; coverUrl: string; duration: number }> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  
  if (!rapidApiKey) {
    throw new Error('RAPIDAPI_KEY is required for TikTok video analysis')
  }

  console.log('[Video] Fetching TikTok video URL via RapidAPI...')
  
  // Use GET request with URL as query parameter
  const apiUrl = `https://tiktok-download-video1.p.rapidapi.com/getVideo?url=${encodeURIComponent(url)}&hd=1`
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
    }
  })

  if (!response.ok) {
    console.error('[Video] RapidAPI error:', response.status, response.statusText)
    throw new Error(`Failed to get TikTok video URL: ${response.statusText}`)
  }

  const data = await response.json()
  console.log('[Video] RapidAPI response code:', data.code, 'msg:', data.msg)
  
  if (data.code !== 0) {
    throw new Error(`TikTok API error: ${data.msg}`)
  }
  
  // Prefer HD play, then regular play, then watermarked play
  const videoUrl = data.data?.hdplay || data.data?.play || data.data?.wmplay
  const coverUrl = data.data?.cover || data.data?.origin_cover
  const duration = data.data?.duration || 0
  
  if (!videoUrl) {
    throw new Error('No video URL found in RapidAPI response')
  }

  console.log('[Video] Got video URL, duration:', duration, 'seconds')
  
  return { videoUrl, coverUrl, duration }
}

// Download video to buffer
async function downloadVideoToBuffer(videoUrl: string): Promise<Buffer> {
  console.log('[Video] Downloading video...')
  
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  console.log('[Video] Downloaded video size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB')
  
  // Vercel has payload limits, check size
  if (buffer.length > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('Video file too large (max 50MB)')
  }

  return buffer
}

// Analyze video using Gemini 3 Flash Preview
async function analyzeVideoWithGemini(videoBuffer: Buffer): Promise<string> {
  console.log('[Video] Analyzing video with Gemini 3 Flash Preview...')
  
  const genAI = getGenAIClient()
  
  const base64Video = videoBuffer.toString('base64')
  
  const prompt = `你是一位短视频创作专家。请仔细观看这个视频，分析它的：
- 视频风格和氛围
- 拍摄手法和镜头运动
- 主体的动作和表现方式
- 背景环境和光线
- 视频节奏和剪辑风格

然后，反推出一段英文提示词，用于让 AI 生成类似风格的短视频。

要求：
1. 提示词应该是通用的，不要包含具体的商品名称或品牌
2. 提示词需要描述视频的核心特征，让 AI 能生成类似风格的新视频
3. 直接输出提示词，不要包含其他解释文字

格式示例：
"A casual lifestyle video showing a person trying on clothes, natural lighting, handheld camera movement, warm and authentic atmosphere, quick transitions, trendy editing style..."`

  const result = await genAI.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'video/mp4',
              data: base64Video
            }
          }
        ]
      }
    ]
  })

  const responseText = extractText(result) || ''
  
  // Clean up the response
  let cleanPrompt = responseText
    .replace(/^["']|["']$/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  
  if (!cleanPrompt) {
    throw new Error('Failed to generate video prompt')
  }
  
  console.log('[Video] Generated prompt:', cleanPrompt.slice(0, 100) + '...')
  
  return cleanPrompt
}

// Fallback for platforms without RapidAPI support
async function analyzeVideoFallback(url: string): Promise<string> {
  const genAI = getGenAIClient()
  
  // For YouTube, we can get thumbnail and analyze
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (youtubeMatch) {
    const thumbnailUrl = `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`
    try {
      const response = await fetch(thumbnailUrl)
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        
        const result = await genAI.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: 'user',
              parts: [
                { text: '根据这个视频缩略图，推测这个视频的风格，并生成一段英文提示词用于 AI 生成类似风格的短视频。直接输出提示词。' },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64
                  }
                }
              ]
            }
          ]
        })
        
        return extractText(result) || 'A casual UGC-style video showcasing a fashion product'
      }
    } catch {
      // Fallback
    }
  }
  
  // Generic fallback based on platform
  if (url.includes('instagram.com')) {
    return 'An Instagram Reels style video, aesthetic lifestyle content, smooth transitions, trendy editing style, warm color grading, vertical format, engaging hooks'
  }
  
  return 'A casual UGC-style video showcasing a fashion product, natural lighting, authentic lifestyle atmosphere, relatable content creator vibe, vertical format'
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log('[Brand Style] Analyzing video:', url)
    
    let prompt: string
    
    // Check if it's a TikTok URL
    if (url.includes('tiktok.com')) {
      try {
        // Get video download URL via RapidAPI
        const { videoUrl, duration } = await getTikTokVideoUrl(url)
        
        console.log('[Video] Video duration:', duration, 'seconds')
        
        // Download video to buffer
        const videoBuffer = await downloadVideoToBuffer(videoUrl)
        
        // Analyze with Gemini
        prompt = await analyzeVideoWithGemini(videoBuffer)
        
      } catch (error) {
        console.warn('[Brand Style] TikTok video analysis failed:', error)
        // Check if it's because of missing API key
        if ((error as Error).message.includes('RAPIDAPI_KEY')) {
          return NextResponse.json(
            { error: '需要配置 RAPIDAPI_KEY 才能分析 TikTok 视频' },
            { status: 400 }
          )
        }
        // Fallback to generic prompt
        prompt = await analyzeVideoFallback(url)
      }
    } else {
      // For other platforms, use fallback
      prompt = await analyzeVideoFallback(url)
    }

    console.log('[Brand Style] Video analysis complete')

    return NextResponse.json({
      prompt,
      success: true
    })

  } catch (error) {
    console.error('[Brand Style] Error analyzing video:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}


