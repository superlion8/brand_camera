import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  const userId = authResult.user.id
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ success: false, error: '缺少文件' }, { status: 400 })
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '文件大小不能超过 10MB' }, { status: 400 })
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: '只支持图片文件' }, { status: 400 })
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: '服务器配置错误' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${crypto.randomUUID()}.${ext}`
    const path = `model-create/${userId}/${filename}`
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('user-assets')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })
    
    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 })
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-assets')
      .getPublicUrl(path)
    
    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    })
    
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '上传失败'
    }, { status: 500 })
  }
}

