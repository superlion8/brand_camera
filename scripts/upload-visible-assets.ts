import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const SOURCE_BASE = '/Users/a/Desktop/brand_cam资源/V2'

async function uploadFile(localPath: string, storagePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    
    // Determine content type
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.heic') contentType = 'image/heic'
    else if (ext === '.webp') contentType = 'image/webp'
    
    const { data, error } = await supabase.storage
      .from('presets')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      })
    
    if (error) {
      console.error(`  ❌ Failed to upload ${storagePath}:`, error.message)
      return false
    }
    
    console.log(`  ✅ Uploaded: ${storagePath}`)
    return true
  } catch (err: any) {
    console.error(`  ❌ Error uploading ${storagePath}:`, err.message)
    return false
  }
}

async function uploadVisibleAssets() {
  console.log('🚀 Starting visible assets upload...\n')
  
  // Upload visible models
  const modelsSourceDir = path.join(SOURCE_BASE, '模特', '可见')
  const modelFiles = fs.readdirSync(modelsSourceDir).filter(f => !f.startsWith('.') && !f.endsWith('.heic'))
  
  console.log(`📁 Uploading ${modelFiles.length} visible models...`)
  for (let i = 0; i < modelFiles.length; i++) {
    const file = modelFiles[i]
    const localPath = path.join(modelsSourceDir, file)
    const ext = path.extname(file).toLowerCase()
    const storagePath = `models/visible/model-v-${i + 1}${ext}`
    await uploadFile(localPath, storagePath)
  }
  
  console.log('')
  
  // Upload visible backgrounds (exclude heic, use converted jpg)
  const bgSourceDir = path.join(SOURCE_BASE, '环境', '可见')
  const bgFiles = fs.readdirSync(bgSourceDir).filter(f => !f.startsWith('.') && !f.endsWith('.heic'))
  
  console.log(`📁 Uploading ${bgFiles.length} visible backgrounds...`)
  for (let i = 0; i < bgFiles.length; i++) {
    const file = bgFiles[i]
    const localPath = path.join(bgSourceDir, file)
    const ext = path.extname(file).toLowerCase()
    const storagePath = `backgrounds/visible/bg-v-${i + 1}${ext}`
    await uploadFile(localPath, storagePath)
  }
  
  console.log('\n✨ Upload complete!')
  console.log(`\nSummary:`)
  console.log(`  - Visible models: ${modelFiles.length}`)
  console.log(`  - Visible backgrounds: ${bgFiles.length}`)
}

uploadVisibleAssets().catch(console.error)

