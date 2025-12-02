import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const BUCKET = 'presets'
const SOURCE_DIR = '/Users/a/Desktop/brand_cam资源/首页'

async function uploadFile(localPath: string, storagePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.webp') contentType = 'image/webp'
    
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      })
    
    if (error) {
      console.error(`Error uploading ${storagePath}:`, error.message)
      return null
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)
    
    console.log(`✓ Uploaded: ${storagePath}`)
    return publicUrl
  } catch (err) {
    console.error(`Error reading ${localPath}:`, err)
    return null
  }
}

async function main() {
  console.log('=== Uploading Homepage Images to Supabase Storage ===\n')
  
  const uploads = [
    // 模特影棚
    { local: '模特影棚/before.jpg', storage: 'homepage/model-before.jpg' },
    { local: '模特影棚/after1.png', storage: 'homepage/model-after.png' },
    
    // 商品影棚
    { local: '商品影棚/before.jpeg', storage: 'homepage/product-before.jpg' },
    { local: '商品影棚/after.jpeg', storage: 'homepage/product-after.jpg' },
    
    // 修图室 - 换模特风格
    { local: '修图室/换模特风格/before.png', storage: 'homepage/style-before.png' },
    { local: '修图室/换模特风格/after.png', storage: 'homepage/style-after.png' },
    
    // 修图室 - 镜头控制
    { local: '修图室/镜头控制/before.png', storage: 'homepage/lens-before.png' },
    { local: '修图室/镜头控制/after.png', storage: 'homepage/lens-after.png' },
    
    // 修图室 - pose控制
    { local: '修图室/pose控制/before.jpg', storage: 'homepage/pose-before.jpg' },
    { local: '修图室/pose控制/after.png', storage: 'homepage/pose-after.png' },
    
    // 修图室 - 表情控制
    { local: '修图室/表情控制/before.jpg', storage: 'homepage/expression-before.jpg' },
    { local: '修图室/表情控制/after.png', storage: 'homepage/expression-after.png' },
  ]
  
  const results: Record<string, string> = {}
  
  for (const upload of uploads) {
    const localPath = path.join(SOURCE_DIR, upload.local)
    const url = await uploadFile(localPath, upload.storage)
    if (url) {
      results[upload.storage] = url
    }
  }
  
  console.log('\n=== Upload Complete ===')
  console.log('\nURLs for homepage:')
  Object.entries(results).forEach(([key, url]) => {
    console.log(`${key}: ${url}`)
  })
}

main().catch(console.error)

