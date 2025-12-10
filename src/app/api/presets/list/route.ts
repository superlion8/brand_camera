import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 获取指定文件夹下的所有文件（返回完整 URL）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder')
    
    if (!folder) {
      return NextResponse.json({ error: 'Missing folder parameter' }, { status: 400 })
    }
    
    // 每次创建全新的 Supabase 客户端，避免任何缓存
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            'Cache-Control': 'no-cache',
            'x-request-id': `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          }
        }
      }
    )
    
    // 列出文件夹内容 - 添加 offset 确保从头开始
    const { data, error } = await supabase.storage
      .from('presets')
      .list(folder, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      })
    
    if (error) {
      console.error(`[Presets API] Error listing ${folder}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // 调试：打印原始数据
    console.log(`[Presets API] Raw data for ${folder}:`, data?.length, 'items')
    if (data && data.length > 0) {
      console.log(`[Presets API] First 5 items:`, data.slice(0, 5).map(d => d.name))
    }
    
    // 过滤出图片文件并生成完整 URL
    const assets = (data || [])
      .filter(item => {
        if (!item.id || item.id === null) return false
        if (item.name === '.emptyFolderPlaceholder') return false
        return /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name)
      })
      .map(item => {
        // 使用 Supabase SDK 生成正确的公开 URL
        const { data: urlData } = supabase.storage
          .from('presets')
          .getPublicUrl(`${folder}/${item.name}`)
        
        const nameWithoutExt = item.name.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
        
        return {
          name: item.name,
          displayName: nameWithoutExt,
          url: urlData.publicUrl,
        }
      })
    
    console.log(`[Presets API] Listed ${folder}: ${assets.length} files`)
    
    // 返回时禁止任何缓存
    return NextResponse.json({ 
      folder,
      assets,
      count: assets.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
    
  } catch (error: any) {
    console.error('[Presets API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    )
  }
}

