import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 获取指定文件夹下的所有文件
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
        limit: 1000, // 最多 1000 个文件
        sortBy: { column: 'name', order: 'asc' },
      })
    
    if (error) {
      console.error(`[Presets API] Error listing ${folder}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // 过滤出图片文件（排除子文件夹和 .emptyFolderPlaceholder）
    const imageFiles = (data || [])
      .filter(item => {
        // 排除文件夹（没有 metadata 或 id 为 null）
        if (!item.id || item.id === null) return false
        // 排除占位文件
        if (item.name === '.emptyFolderPlaceholder') return false
        // 只保留图片文件
        return /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name)
      })
      .map(item => item.name)
    
    console.log(`[Presets API] Listed ${folder}: ${imageFiles.length} files`)
    
    return NextResponse.json({ 
      folder,
      files: imageFiles,
      count: imageFiles.length,
    })
    
  } catch (error: any) {
    console.error('[Presets API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    )
  }
}

