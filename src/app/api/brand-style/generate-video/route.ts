import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
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
  // Download video from OpenAI
  const response = await fetch(videoUrl)
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  
  const supabase = getSupabase()
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

// Generate video using available API (Runway, Pika, or Sora when available)
async function generateVideoWithRunway(prompt: string, imageBase64: string): Promise<string | null> {
  const runwayApiKey = process.env.RUNWAY_API_KEY
  
  if (!runwayApiKey) {
    console.log('[Brand Style] No Runway API key, video generation skipped')
    return null
  }

  try {
    // Runway Gen-3 Alpha API
    const response = await fetch('https://api.runwayml.com/v1/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runwayApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gen-3-alpha',
        prompt: prompt,
        image: imageBase64,
        duration: 5,
        aspect_ratio: '9:16'
      })
    })

    if (!response.ok) {
      throw new Error(`Runway API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.output_url || data.video_url || null

  } catch (error) {
    console.error('[Brand Style] Runway API error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productImage, prompt, brandSummary } = await request.json()

    if (!productImage || !prompt) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    console.log('[Brand Style] Generating video...')

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
- 5 seconds duration`

    // Try to generate video with Runway
    const videoUrl = await generateVideoWithRunway(videoPrompt, productImageUrl)

    if (!videoUrl) {
      // Video generation not available, return placeholder message
      return NextResponse.json({
        videoUrl: null,
        message: 'Video generation is not configured. Please add RUNWAY_API_KEY to enable video generation.',
        success: false
      })
    }

    // Upload to Supabase for persistent storage
    console.log('[Brand Style] Uploading video to storage...')
    const storedVideoUrl = await uploadVideoToSupabase(videoUrl)

    console.log('[Brand Style] Video generation complete')

    return NextResponse.json({
      videoUrl: storedVideoUrl,
      success: true
    })

  } catch (error) {
    console.error('[Brand Style] Error generating video:', error)
    
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

