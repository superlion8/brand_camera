import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// GET - List files in a folder
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folder = request.nextUrl.searchParams.get('folder') || 'models'
  const excludeSubfolders = request.nextUrl.searchParams.get('excludeSubfolders') === 'true'
  
  try {
    const { data, error } = await supabase.storage
      .from('presets')
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      console.error('Storage list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter out folders (folders don't have id) and get public URLs
    // When excludeSubfolders is true, we're already only getting direct files
    // because Supabase list() doesn't recurse into subfolders
    const files = (data || [])
      .filter(item => item.id) // Only files have id, folders don't
      .map(item => {
        const { data: urlData } = supabase.storage
          .from('presets')
          .getPublicUrl(`${folder}/${item.name}`)
        
        return {
          name: item.name,
          url: urlData.publicUrl,
          size: item.metadata?.size || 0,
          createdAt: item.created_at,
        }
      })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error listing files:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

// POST - Upload files
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const folder = formData.get('folder') as string || 'models'
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    let uploaded = 0
    const errors: string[] = []

    for (const file of files) {
      const fileName = file.name
      const filePath = `${folder}/${fileName}`
      
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      const { error } = await supabase.storage
        .from('presets')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true, // Overwrite if exists
        })

      if (error) {
        console.error(`Upload error for ${fileName}:`, error)
        errors.push(`${fileName}: ${error.message}`)
      } else {
        uploaded++
      }
    }

    if (errors.length > 0 && uploaded === 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
    }

    return NextResponse.json({ 
      uploaded, 
      errors: errors.length > 0 ? errors : undefined 
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE - Delete files
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { folder, files } = body as { folder: string; files: string[] }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files specified' }, { status: 400 })
    }

    const filePaths = files.map(f => `${folder}/${f}`)
    console.log('[Presets API] Deleting files:', filePaths)

    const { data, error } = await supabase.storage
      .from('presets')
      .remove(filePaths)

    console.log('[Presets API] Delete result:', { data, error })

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if files were actually deleted
    const deletedCount = data?.length || 0
    console.log('[Presets API] Actually deleted:', deletedCount)

    return NextResponse.json({ deleted: deletedCount, requested: files.length })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

