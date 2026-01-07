import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleAuth } from 'google-auth-library'

// Lazy initialize supabase to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

// Get Google Cloud access token for Vertex AI
async function getAccessToken(): Promise<string> {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credentials) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is required for Veo video generation')
  }
  
  const credentialsJson = JSON.parse(credentials)
  const auth = new GoogleAuth({
    credentials: credentialsJson,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  })
  
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  
  if (!token.token) {
    throw new Error('Failed to get access token')
  }
  
  return token.token
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

// Poll for video generation completion
async function pollVideoOperation(operationName: string, accessToken: string): Promise<string> {
  const maxAttempts = 60 // 5 minutes max wait time
  const pollInterval = 5000 // 5 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`[Veo] Polling operation status (attempt ${i + 1}/${maxAttempts})...`)
    
    const response = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/${operationName}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to poll operation: ${response.status} - ${errorText}`)
    }
    
    const operation = await response.json()
    
    if (operation.done) {
      if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`)
      }
      
      // Extract video URL from response
      const videoUri = operation.response?.generatedSamples?.[0]?.video?.uri
      if (!videoUri) {
        throw new Error('No video URI in completed operation')
      }
      
      return videoUri
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error('Video generation timed out')
}

// Download video from GCS URI
async function downloadVideoFromGCS(gcsUri: string, accessToken: string): Promise<Buffer> {
  // Convert gs://bucket/path to https://storage.googleapis.com/bucket/path
  const httpsUrl = gcsUri.replace('gs://', 'https://storage.googleapis.com/')
  
  const response = await fetch(httpsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`)
  }
  
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer)
}

export async function POST(request: NextRequest) {
  try {
    const { productImage, prompt, brandSummary } = await request.json()

    if (!productImage || !prompt) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    console.log('[Veo] Starting video generation with Veo 2...')

    // Check if we have the required credentials
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log('[Veo] No Google Cloud credentials configured, skipping video generation')
      return NextResponse.json({
        error: 'Video generation requires Google Cloud credentials. This feature is not configured.',
        videoUrl: null,
        success: false
      })
    }

    // Get access token
    const accessToken = await getAccessToken()
    
    // Get project ID from credentials
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    const projectId = credentials.project_id
    const location = 'us-central1'

    // Build video prompt
    const videoPrompt = `${prompt}

Product Context: A fashion item (clothing/accessory) for a brand video.
Brand Style: ${brandSummary || 'Modern, trendy, lifestyle-focused'}

Video Requirements:
- UGC/creator style - authentic and relatable
- Smooth camera movement
- Good lighting
- Duration: 5-8 seconds
- High quality, professional look`

    // Call Veo 2 API (more stable than Veo 3)
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-002:predictLongRunning`
    
    const requestBody = {
      instances: [
        {
          prompt: videoPrompt
        }
      ],
      parameters: {
        aspectRatio: '9:16', // Vertical for social media
        personGeneration: 'allow_adult',
        durationSeconds: 6,
        enhancePrompt: true
      }
    }

    console.log('[Veo] Sending request to Veo API...')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Veo] API error:', errorText)
      
      // Check for specific errors
      if (response.status === 404) {
        return NextResponse.json({
          error: 'Veo video generation model not available in your project. Please enable Vertex AI Veo API.',
          videoUrl: null,
          success: false
        })
      }
      
      if (response.status === 403) {
        return NextResponse.json({
          error: 'Insufficient permissions for Veo video generation. Please check your Google Cloud IAM settings.',
          videoUrl: null,
          success: false
        })
      }
      
      throw new Error(`Veo API error: ${response.status} - ${errorText}`)
    }

    const operation = await response.json()
    console.log('[Veo] Operation started:', operation.name)

    // Poll for completion
    const videoGcsUri = await pollVideoOperation(operation.name, accessToken)
    console.log('[Veo] Video generated:', videoGcsUri)

    // Download video from GCS
    const videoBuffer = await downloadVideoFromGCS(videoGcsUri, accessToken)
    console.log('[Veo] Video downloaded, size:', videoBuffer.length)

    // Upload to Supabase for persistent storage
    console.log('[Veo] Uploading video to Supabase...')
    const storedVideoUrl = await uploadVideoToSupabase(videoBuffer, 'video/mp4')

    console.log('[Veo] Video generation complete:', storedVideoUrl)

    return NextResponse.json({
      videoUrl: storedVideoUrl,
      success: true
    })

  } catch (error) {
    console.error('[Veo] Error generating video:', error)
    
    const errorMessage = (error as Error).message
    
    // Handle specific errors gracefully
    if (errorMessage.includes('not found') || 
        errorMessage.includes('not available') || 
        errorMessage.includes('not supported') ||
        errorMessage.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
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
