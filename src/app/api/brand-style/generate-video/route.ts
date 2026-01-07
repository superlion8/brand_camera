import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
  })
}

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

// Helper to convert image to base64 URL
async function getImageBase64Url(imageSource: string): Promise<string> {
  if (imageSource.startsWith('data:')) {
    return imageSource
  }
  
  const response = await fetch(imageSource)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  
  return `data:${mimeType};base64,${base64}`
}

// Upload video to Supabase
async function uploadVideoToSupabase(videoUrl: string): Promise<string> {
  const supabase = getSupabase()
  
  // Download video from OpenAI
  const response = await fetch(videoUrl)
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, buffer, {
      contentType: 'video/mp4',
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

// Poll for video completion
async function waitForVideoCompletion(openai: OpenAI, videoId: string, maxWaitMs: number = 300000): Promise<string> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds
  
  while (Date.now() - startTime < maxWaitMs) {
    const video = await openai.videos.retrieve(videoId)
    
    console.log(`[Sora] Video status: ${video.status}`)
    
    if (video.status === 'completed') {
      // Get the video URL
      // @ts-ignore
      if (video.url) {
        // @ts-ignore
        return video.url
      }
      throw new Error('Video completed but no URL provided')
    }
    
    if (video.status === 'failed') {
      // @ts-ignore
      throw new Error(`Video generation failed: ${video.error?.message || 'Unknown error'}`)
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error('Video generation timed out')
}

export async function POST(request: NextRequest) {
  try {
    const { productImage, prompt, brandSummary } = await request.json()

    if (!productImage || !prompt) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        videoUrl: null,
        message: 'Video generation requires OPENAI_API_KEY to be configured.',
        success: false
      })
    }

    console.log('[Sora] Starting video generation...')

    // Prepare product image
    const productImageUrl = await getImageBase64Url(productImage)

    // Build video prompt
    const videoPrompt = `${prompt}

Product: A fashion item (clothing/accessory) as shown in the reference image.
Style: ${brandSummary || 'Modern, trendy, lifestyle-focused'}

Requirements:
- Feature the product naturally in a lifestyle context
- UGC/creator style - authentic and relatable
- Smooth camera movement
- Good lighting
- Vertical format (9:16) for social media`

    // Create video with Sora 2 API
    const openai = getOpenAI()
    const video = await openai.videos.create({
      model: 'sora-2',
      prompt: videoPrompt,
      size: '720x1280', // Vertical format (9:16)
      seconds: '4', // '4', '8', or '12' seconds
    })

    console.log(`[Sora] Video created with ID: ${video.id}`)

    // Wait for video to complete
    const videoUrl = await waitForVideoCompletion(openai, video.id)

    // Upload to Supabase for persistent storage
    console.log('[Sora] Uploading video to storage...')
    const storedVideoUrl = await uploadVideoToSupabase(videoUrl)

    console.log('[Sora] Video generation complete')

    return NextResponse.json({
      videoUrl: storedVideoUrl,
      success: true
    })

  } catch (error) {
    console.error('[Sora] Error generating video:', error)
    
    const errorMessage = (error as Error).message
    
    // Handle specific errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return NextResponse.json(
        { error: 'Video generation rate limit reached. Please try again later.' },
        { status: 429 }
      )
    }
    
    if (errorMessage.includes('not available') || errorMessage.includes('model')) {
      return NextResponse.json(
        { error: 'Sora video generation is not available. Please check your API access.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
