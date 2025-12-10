import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 获取指定文件夹下的所有文件（返回完整 URL）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder')
    
    if (!folder) {
      return NextResponse.json({ error: 'Missing folder parameter' }, { status: 400 })
    }
    
    const supabase = createServiceClient()
    
    // 列出文件夹内容
    const { data, error } = await supabase.storage
      .from('presets')
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })
    
    if (error) {
      console.error(`[Presets API] Error listing ${folder}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    
    return NextResponse.json({ 
      folder,
      assets,
      count: assets.length,
    })
    
  } catch (error: any) {
    console.error('[Presets API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    )
  }
}

