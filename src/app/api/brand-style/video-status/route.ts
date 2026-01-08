import { NextRequest, NextResponse } from 'next/server'

// Together AI API base URL (v2 for video)
const TOGETHER_API_BASE = 'https://api.together.ai/v2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    
    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
    }
    
    const apiKey = process.env.TOGETHER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TOGETHER_API_KEY not configured' }, { status: 500 })
    }
    
    // v2 API uses query param: /v2/videos/status?id={videoId}
    const response = await fetch(`${TOGETHER_API_BASE}/videos/status?id=${videoId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `API error: ${errorText}` }, { status: response.status })
    }
    
    const data = await response.json()
    
    if (data.status === 'completed') {
      const videoUrl = data.outputs?.video_url
      if (!videoUrl) {
        return NextResponse.json({ status: 'failed', error: 'No video URL in response' })
      }
      
      // Return Together AI URL directly (Supabase doesn't support video/mp4 upload)
      // TODO: Configure Supabase bucket to allow video uploads for persistent storage
      console.log('[Video Status] Video completed:', videoUrl)
      
      return NextResponse.json({ 
        status: 'completed', 
        videoUrl: videoUrl 
      })
    }
    
    if (data.status === 'failed') {
      return NextResponse.json({ 
        status: 'failed', 
        error: data.error?.message || 'Video generation failed' 
      })
    }
    
    // Still in progress
    return NextResponse.json({ status: 'in_progress' })
    
  } catch (error) {
    console.error('[Video Status] Error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
