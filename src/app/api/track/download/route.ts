import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Track image download event
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const body = await request.json()
    const { imageUrl, generationId, imageIndex, source } = body
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }
    
    // Insert download event
    const { error } = await supabase
      .from('download_events')
      .insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        image_url: imageUrl,
        generation_id: generationId || null,
        image_index: imageIndex ?? null,
        source: source || 'unknown', // gallery, camera, studio
      })
    
    if (error) {
      // If table doesn't exist, just log and continue (don't block download)
      console.warn('[Track] Download tracking failed:', error.message)
      return NextResponse.json({ success: true, tracked: false })
    }
    
    console.log('[Track] Download recorded:', { 
      user: user?.email || 'anonymous', 
      source,
      imageIndex 
    })
    
    return NextResponse.json({ success: true, tracked: true })
  } catch (error: any) {
    console.error('[Track] Error:', error)
    // Don't fail the download, just return success with tracked: false
    return NextResponse.json({ success: true, tracked: false })
  }
}

