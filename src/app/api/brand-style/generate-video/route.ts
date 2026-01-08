import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Together AI API base URL
const TOGETHER_API_BASE = 'https://api.together.ai/v1'

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

// Upload video to Supabase
async function uploadVideoToSupabase(videoData: Buffer, mimeType: string): Promise<string> {
  const supabase = getSupabase()
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, videoData, {
      contentType: mimeType,
      upsert: false
    })
  
  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage
    .from('generations')
    .getPublicUrl(filename)
  
  return urlData.publicUrl
}

// Create video generation job with Together AI
async function createVideoJob(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${TOGETHER_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/sora-2',
      prompt: prompt,
      // height: 1280,
      // width: 720,
      seconds: '6', // 6 seconds video
      fps: 24,
      // steps: 30,
      output_format: 'MP4',
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Together] Create video error:', errorText)
    throw new Error(`Together AI error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('[Together] Video job created:', data.id)
  return data.id
}

// Poll for video generation completion
async function pollVideoJob(videoId: string, apiKey: string): Promise<string> {
  const maxAttempts = 120 // 10 minutes max wait time (5s intervals)
  const pollInterval = 5000 // 5 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`[Together] Polling video status (attempt ${i + 1}/${maxAttempts})...`)
    
    const response = await fetch(`${TOGETHER_API_BASE}/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to poll video: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log(`[Together] Video status: ${data.status}`)
    
    if (data.status === 'completed') {
      const videoUrl = data.outputs?.video_url
      if (!videoUrl) {
        throw new Error('No video URL in completed response')
      }
      return videoUrl
    }
    
    if (data.status === 'failed') {
      const errorMsg = data.error?.message || 'Unknown error'
      throw new Error(`Video generation failed: ${errorMsg}`)
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error('Video generation timed out')
}

// Download video from URL
async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl)
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`)
  }
  
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer)
}

export async function POST(request: NextRequest) {
  try {
    const { productImage, prompt, brandSummary } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing required prompt' }, { status: 400 })
    }

    console.log('[Together] Starting video generation with Sora 2...')

    // Check for Together AI API key
    const apiKey = process.env.TOGETHER_API_KEY
    if (!apiKey) {
      console.log('[Together] No Together AI API key configured')
      return NextResponse.json({
        error: 'Video generation requires Together AI API key. Please set TOGETHER_API_KEY.',
        videoUrl: null,
        success: false
      })
    }

    // Build video prompt
    // 用户要求：使用反推的 vid_prompt，结合 product 信息
    const videoPrompt = `${prompt}

商品信息：展示一件时尚商品
品牌风格：${brandSummary || '现代、时尚、生活方式导向'}

视频要求：
- UGC/创作者风格 - 真实自然
- 9:16 竖版比例（适合社交媒体）
- 流畅的镜头运动
- 自然光效
- 时长 5-8 秒
- 高质量、专业感

注意：不要描述人物的穿着，专注于动作、环境和拍摄手法。`

    // Create video job
    const videoId = await createVideoJob(videoPrompt, apiKey)
    
    // Poll for completion
    const videoUrl = await pollVideoJob(videoId, apiKey)
    console.log('[Together] Video generated:', videoUrl)

    // Download and re-upload to Supabase for persistent storage
    console.log('[Together] Downloading video...')
    const videoBuffer = await downloadVideo(videoUrl)
    console.log('[Together] Video downloaded, size:', videoBuffer.length)

    // Upload to Supabase
    console.log('[Together] Uploading video to Supabase...')
    const storedVideoUrl = await uploadVideoToSupabase(videoBuffer, 'video/mp4')

    console.log('[Together] Video generation complete:', storedVideoUrl)

    return NextResponse.json({
      videoUrl: storedVideoUrl,
      success: true
    })

  } catch (error) {
    console.error('[Together] Error generating video:', error)
    
    const errorMessage = (error as Error).message
    
    // Handle specific errors gracefully
    if (errorMessage.includes('not found') || 
        errorMessage.includes('not available') || 
        errorMessage.includes('not supported') ||
        errorMessage.includes('TOGETHER_API_KEY')) {
      return NextResponse.json({
        error: 'Video generation is not available. ' + errorMessage,
        videoUrl: null,
        success: false
      })
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
