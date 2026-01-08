import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Together AI API base URL (v2 for video generation)
const TOGETHER_API_BASE = 'https://api.together.ai/v2'

// Get Supabase client for uploading reference images
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase configuration missing')
  return createClient(url, key)
}

// Upload base64 image to Supabase and return public URL
async function uploadReferenceImage(base64Data: string): Promise<string> {
  // If already a URL, return as-is
  if (base64Data.startsWith('http')) {
    return base64Data
  }
  
  const supabase = getSupabase()
  
  // Extract base64 content
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 image format')
  
  const mimeType = match[1]
  const base64Content = match[2]
  const buffer = Buffer.from(base64Content, 'base64')
  const extension = mimeType.includes('png') ? 'png' : 'jpg'
  const filename = `brand-style/ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, buffer, { contentType: mimeType, upsert: false })
  
  if (error) throw new Error(`Failed to upload reference image: ${error.message}`)
  
  const { data: urlData } = supabase.storage.from('generations').getPublicUrl(filename)
  return urlData.publicUrl
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, productDescription, productImage } = await request.json()

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
        videoJobId: null,
        success: false
      })
    }

    // Upload product image if provided (for reference_images)
    let referenceImageUrl: string | null = null
    if (productImage) {
      try {
        console.log('[Together] Uploading product image for reference...')
        referenceImageUrl = await uploadReferenceImage(productImage)
        console.log('[Together] Reference image URL:', referenceImageUrl)
      } catch (err) {
        console.warn('[Together] Failed to upload reference image:', err)
      }
    }

    // Build video prompt: Generate a video wearing [product]. [vid_prompt]
    const productInfo = productDescription || 'a fashion product'
    const videoPrompt = `Generate a video of a model wearing ${productInfo}. The model should be wearing the exact product shown in the reference image. ${prompt}`

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: 'openai/sora-2',
      prompt: videoPrompt,
      seconds: 8, // Sora 2 only supports 4, 8, 12 seconds
    }
    
    // Add reference image if available
    if (referenceImageUrl) {
      requestBody.reference_images = [referenceImageUrl]
    }

    // Create video job (don't wait for completion)
    const response = await fetch(`${TOGETHER_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Together] Create video error:', errorText)
      throw new Error(`Together AI error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('[Together] Video job created:', data.id)

    // Return job ID immediately, frontend will poll for completion
    return NextResponse.json({
      videoJobId: data.id,
      success: true
    })

  } catch (error) {
    console.error('[Together] Error starting video generation:', error)
    
    const errorMessage = (error as Error).message
    
    return NextResponse.json({
      error: errorMessage,
      videoJobId: null,
      success: false
    }, { status: 500 })
  }
}
