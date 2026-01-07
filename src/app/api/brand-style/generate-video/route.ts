import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient } from '@/lib/genai'
import { createClient } from '@supabase/supabase-js'

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

// Helper to convert image to base64
async function getImageBase64(imageSource: string): Promise<{ data: string; mimeType: string }> {
  if (imageSource.startsWith('data:')) {
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      return { mimeType: match[1], data: match[2] }
    }
  }
  
  const response = await fetch(imageSource)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  
  return { data: base64, mimeType }
}

// Upload video to Supabase
async function uploadVideoToSupabase(videoData: string, mimeType: string): Promise<string> {
  const supabase = getSupabase()
  const buffer = Buffer.from(videoData, 'base64')
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, buffer, {
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

export async function POST(request: NextRequest) {
  try {
    const { productImage, prompt, brandSummary } = await request.json()

    if (!productImage || !prompt) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    console.log('[Veo] Starting video generation with Veo 3...')

    // Prepare product image
    const productImageData = await getImageBase64(productImage)

    // Build video prompt
    const videoPrompt = `${prompt}

Product Context: A fashion item (clothing/accessory) as shown in the reference image.
Brand Style: ${brandSummary || 'Modern, trendy, lifestyle-focused'}

Video Requirements:
- Feature the product naturally in a lifestyle context
- UGC/creator style - authentic and relatable
- Smooth camera movement
- Good lighting
- Vertical format suitable for social media
- Duration: 4-6 seconds
- High quality, professional look while maintaining authentic feel`

    // Generate video using Veo 3
    const genAI = getGenAIClient()
    
    const result = await genAI.models.generateContent({
      model: 'veo-3-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: videoPrompt },
            { inlineData: { mimeType: productImageData.mimeType, data: productImageData.data } }
          ]
        }
      ],
      config: {
        responseModalities: ['VIDEO'],
      }
    })

    console.log('[Veo] Generation complete, extracting video...')

    // Extract video from response
    let videoData: string | null = null
    let videoMimeType = 'video/mp4'
    
    const candidate = result.candidates?.[0]
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        // @ts-ignore - video data structure
        if (part.inlineData?.data) {
          // @ts-ignore
          videoData = part.inlineData.data
          // @ts-ignore
          videoMimeType = part.inlineData.mimeType || 'video/mp4'
          break
        }
        // @ts-ignore - alternative video response structure
        if (part.videoMetadata || part.video) {
          // @ts-ignore
          videoData = part.video?.data || part.videoMetadata?.data
          break
        }
      }
    }

    if (!videoData) {
      // Check if there's an error or the model doesn't support video yet
      console.error('[Veo] No video data in response:', JSON.stringify(result).slice(0, 500))
      throw new Error('Video generation did not return any video data. Veo 3 may not be available yet.')
    }

    // Upload to Supabase for persistent storage
    console.log('[Veo] Uploading video to storage...')
    const storedVideoUrl = await uploadVideoToSupabase(videoData, videoMimeType)

    console.log('[Veo] Video generation complete')

    return NextResponse.json({
      videoUrl: storedVideoUrl,
      success: true
    })

  } catch (error) {
    console.error('[Veo] Error generating video:', error)
    
    const errorMessage = (error as Error).message
    
    // Handle specific errors
    if (errorMessage.includes('not found') || errorMessage.includes('not available') || errorMessage.includes('not supported')) {
      return NextResponse.json({
        error: 'Veo 3 video generation is not available yet. Video generation will be skipped.',
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
