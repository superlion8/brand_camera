/**
 * 上传首页功能展示图片到 Supabase Storage（带压缩）
 * 运行: npx ts-node --project tsconfig.scripts.json scripts/upload-homepage-features.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const SOURCE_DIR = '/Users/a/Desktop/bcam_src/首页/PC'
const BUCKET = 'presets'
const PREFIX = 'homepage/features'

// 功能图片映射
const FEATURES = [
  { folder: 'buyer show', file: 'buyer_show.png', name: 'buyer-show' },
  { folder: 'create_model', file: 'create_model.png', name: 'create-model' },
  { folder: 'group', file: 'group.png', name: 'group' },
  { folder: 'lifestyle', file: 'lifestyle.png', name: 'lifestyle' },
  { folder: 'pro studio', file: 'pro_studio.png', name: 'pro-studio' },
  { folder: 'product studio', file: 'product_studio.png', name: 'product-studio' },
  { folder: 'reference', file: 'reference.png', name: 'reference' },
  { folder: 'social', file: 'social.png', name: 'social' },
  { folder: 'try on', file: 'try_on.png', name: 'try-on' },
]

// 压缩图片 - 调整大小并转为高质量 JPEG
async function compressImage(inputPath: string): Promise<Buffer> {
  const image = sharp(inputPath)
  const metadata = await image.metadata()
  
  // 如果宽度超过 1600px，等比缩小
  let resizedImage = image
  if (metadata.width && metadata.width > 1600) {
    resizedImage = image.resize(1600, undefined, { withoutEnlargement: true })
  }
  
  // 转为 JPEG，质量 85%（比 PNG 小很多）
  return resizedImage
    .jpeg({ quality: 85, progressive: true })
    .toBuffer()
}

async function uploadImage(localPath: string, remotePath: string): Promise<string | null> {
  try {
    console.log(`📦 Compressing: ${path.basename(localPath)}...`)
    const compressedBuffer = await compressImage(localPath)
    const originalSize = fs.statSync(localPath).size
    const compressedSize = compressedBuffer.length
    console.log(`   ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressedSize / 1024 / 1024).toFixed(1)}MB`)
    
    // 改用 .jpg 扩展名
    const jpgPath = remotePath.replace('.png', '.jpg')
    
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(jpgPath, compressedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) {
      console.error(`❌ Upload failed: ${jpgPath}`, error.message)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path)

    console.log(`✅ Uploaded: ${jpgPath}`)
    return publicUrl
  } catch (err) {
    console.error(`❌ Error: ${localPath}`, err)
    return null
  }
}

async function main() {
  console.log('🚀 Starting upload of homepage feature images...\n')
  
  const results: Record<string, string> = {}
  
  for (const feature of FEATURES) {
    const localPath = path.join(SOURCE_DIR, feature.folder, feature.file)
    const remotePath = `${PREFIX}/${feature.name}.png`
    
    if (!fs.existsSync(localPath)) {
      console.error(`❌ File not found: ${localPath}`)
      continue
    }
    
    const url = await uploadImage(localPath, remotePath)
    if (url) {
      results[feature.name] = url
    }
  }
  
  console.log('\n📋 Upload complete! URLs:')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
