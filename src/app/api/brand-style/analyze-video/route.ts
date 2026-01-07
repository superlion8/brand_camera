import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText } from '@/lib/genai'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

// Download video using yt-dlp
async function downloadVideo(url: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), 'brand-style-videos')
  await mkdir(tempDir, { recursive: true })
  
  const outputPath = path.join(tempDir, `video_${Date.now()}.mp4`)
  
  try {
    // Use yt-dlp to download video
    // yt-dlp supports TikTok, YouTube, Instagram Reels, etc.
    await execAsync(
      `yt-dlp -f "best[ext=mp4]/best" --no-playlist -o "${outputPath}" "${url}"`,
      { timeout: 60000 } // 60 second timeout
    )
    
    return outputPath
  } catch (error) {
    console.error('[Video Download] yt-dlp error:', error)
    throw new Error('Failed to download video. Make sure yt-dlp is installed.')
  }
}

// Extract frames from video for analysis
async function extractFrames(videoPath: string, numFrames: number = 5): Promise<string[]> {
  const tempDir = path.join(os.tmpdir(), 'brand-style-frames')
  await mkdir(tempDir, { recursive: true })
  
  const framePattern = path.join(tempDir, `frame_${Date.now()}_%d.jpg`)
  
  try {
    // Use ffmpeg to extract frames at regular intervals
    await execAsync(
      `ffmpeg -i "${videoPath}" -vf "select='not(mod(n\\,30))'" -frames:v ${numFrames} -q:v 2 "${framePattern}"`,
      { timeout: 30000 }
    )
    
    // Get list of extracted frames
    const frames: string[] = []
    for (let i = 1; i <= numFrames; i++) {
      const framePath = framePattern.replace('%d', i.toString())
      try {
        const { readFile } = await import('fs/promises')
        const buffer = await readFile(framePath)
        const base64 = buffer.toString('base64')
        frames.push(`data:image/jpeg;base64,${base64}`)
        // Clean up frame file
        await unlink(framePath).catch(() => {})
      } catch {
        // Frame might not exist
      }
    }
    
    return frames
  } catch (error) {
    console.error('[Frame Extraction] ffmpeg error:', error)
    throw new Error('Failed to extract video frames. Make sure ffmpeg is installed.')
  }
}

// Analyze video frames and generate prompt using VLM
async function analyzeVideoFrames(frames: string[]): Promise<string> {
  if (frames.length === 0) {
    throw new Error('No frames to analyze')
  }

  const genAI = getGenAIClient()
  
  const imageParts = frames.map(frame => {
    const base64Data = frame.replace(/^data:image\/\w+;base64,/, '')
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data
      }
    }
  })

  const prompt = `你是一位短视频创作专家。请分析这些视频帧，反推出创作这条 UGC 风格短视频的提示词。

请输出一段英文提示词，用于让 AI 生成类似风格的短视频。提示词应该包含：
- 视频的整体风格和氛围
- 拍摄手法和镜头运动
- 主体的动作和表现方式
- 背景环境和光线
- 视频节奏和剪辑风格

请直接输出提示词，不要包含其他解释文字。格式示例：
"A casual lifestyle video showing a person trying on clothes, natural lighting, handheld camera movement, warm and authentic atmosphere..."

注意：提示词应该是通用的，不要包含具体的商品名称或品牌，因为我们要用这个提示词为新商品生成视频。`

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }
    ]
  })

  const responseText = extractText(result) || ''
  
  // Clean up the response
  let cleanPrompt = responseText
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\n+/g, ' ')        // Replace newlines with spaces
    .trim()
  
  if (!cleanPrompt) {
    cleanPrompt = 'A casual UGC-style video showcasing a fashion product, handheld camera, natural lighting, authentic lifestyle atmosphere'
  }
  
  return cleanPrompt
}

// Fallback: Analyze video URL without downloading (using thumbnails)
async function analyzeVideoFallback(url: string): Promise<string> {
  // Try to get thumbnail from the video URL
  let thumbnailUrl: string | null = null
  
  // TikTok thumbnail pattern
  if (url.includes('tiktok.com')) {
    // TikTok doesn't easily expose thumbnails, use generic prompt
    return 'A trendy TikTok-style UGC video showing product demonstration, vertical format, quick cuts, engaging camera angles, authentic creator vibe'
  }
  
  // YouTube thumbnail
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (youtubeMatch) {
    thumbnailUrl = `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`
  }
  
  // Instagram Reels - try to analyze via page content
  if (url.includes('instagram.com')) {
    return 'An Instagram Reels style video, aesthetic lifestyle content, smooth transitions, trendy editing style, warm color grading'
  }
  
  if (thumbnailUrl) {
    try {
      const response = await fetch(thumbnailUrl)
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return analyzeVideoFrames([`data:image/jpeg;base64,${base64}`])
      }
    } catch {
      // Fallback to generic prompt
    }
  }
  
  return 'A casual UGC-style video showcasing a fashion product, natural lighting, authentic lifestyle atmosphere, relatable content creator vibe'
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log('[Brand Style] Analyzing video:', url)
    
    let prompt: string
    let videoPath: string | null = null
    
    try {
      // Try to download and analyze video
      console.log('[Brand Style] Downloading video...')
      videoPath = await downloadVideo(url)
      
      console.log('[Brand Style] Extracting frames...')
      const frames = await extractFrames(videoPath)
      
      console.log('[Brand Style] Analyzing frames with VLM...')
      prompt = await analyzeVideoFrames(frames)
      
      // Clean up video file
      if (videoPath) {
        await unlink(videoPath).catch(() => {})
      }
      
    } catch (downloadError) {
      console.warn('[Brand Style] Video download failed, using fallback:', downloadError)
      // Fallback to analyzing without download
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

