import { NextRequest, NextResponse } from 'next/server'

// Together AI API base URL (v2 for video generation)
const TOGETHER_API_BASE = 'https://api.together.ai/v2'

export async function POST(request: NextRequest) {
  try {
    const { prompt, productDescription } = await request.json()

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

    // Build video prompt: Generate a video wearing [product]. [vid_prompt]
    const productInfo = productDescription || 'a fashion product'
    const videoPrompt = `Generate a video of a model wearing ${productInfo}. ${prompt}`

    // Create video job (don't wait for completion)
    const response = await fetch(`${TOGETHER_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/sora-2',
        prompt: videoPrompt,
        seconds: 8, // Sora 2 only supports 4, 8, 12 seconds
      })
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
