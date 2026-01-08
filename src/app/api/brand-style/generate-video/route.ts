import { NextRequest, NextResponse } from 'next/server'

// Together AI API base URL
const TOGETHER_API_BASE = 'https://api.together.ai/v1'

export async function POST(request: NextRequest) {
  try {
    const { prompt, brandSummary } = await request.json()

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

    // Build video prompt
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
        seconds: '6',
        fps: 24,
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
