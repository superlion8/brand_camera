import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// Together AI API base URL (v2 for video)
const TOGETHER_API_BASE = 'https://api.together.ai/v2'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing.')
  }
  
  return createClient(url, key)
}

async function uploadVideoToSupabase(videoData: Buffer): Promise<string> {
  const supabase = getSupabase()
  const filename = `brand-style/video_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  
  const { error } = await supabase.storage
    .from('generations')
    .upload(filename, videoData, { contentType: 'video/mp4', upsert: false })
  
  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`)
  }
  
  const { data: urlData } = supabase.storage.from('generations').getPublicUrl(filename)
  return urlData.publicUrl
}

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
      
      // Download and upload to Supabase for persistent storage
      console.log('[Video Status] Downloading video from Together AI...')
      const downloadResponse = await fetch(videoUrl)
      const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer())
      
      console.log('[Video Status] Uploading to Supabase...')
      const storedUrl = await uploadVideoToSupabase(videoBuffer)
      
      return NextResponse.json({ 
        status: 'completed', 
        videoUrl: storedUrl 
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
