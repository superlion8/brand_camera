/**
 * Upload product images to Supabase Storage
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import sharp from 'sharp'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const BUCKET_NAME = 'presets'
const SOURCE_DIR = '/Users/a/Desktop/品牌相机预设资产/商品'

async function uploadFile(localPath: string, storagePath: string): Promise<boolean> {
  try {
    let fileBuffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    
    // Compress large images
    if (fileBuffer.length > 500 * 1024) { // > 500KB
      console.log(`  Compressing (${Math.round(fileBuffer.length / 1024)}KB)...`)
      const compressed = await sharp(fileBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      fileBuffer = Buffer.from(compressed)
      console.log(`  Compressed to ${Math.round(fileBuffer.length / 1024)}KB`)
    }
    
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true
      })
    
    if (error) {
      console.error(`Error uploading ${storagePath}:`, error.message)
      return false
    }
    return true
  } catch (err: any) {
    console.error(`Error reading file ${localPath}:`, err.message)
    return false
  }
}

async function main() {
  console.log('Uploading product images...\n')
  
  const files = fs.readdirSync(SOURCE_DIR).filter(f => 
    /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
  )
  
  console.log(`Found ${files.length} product images\n`)
  
  let uploaded = 0
  const productData: { name: string; storagePath: string }[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const localPath = path.join(SOURCE_DIR, file)
    const storagePath = `products/product-${i + 1}.jpg`
    
    console.log(`[${i + 1}/${files.length}] Uploading: ${file}`)
    
    const success = await uploadFile(localPath, storagePath)
    if (success) {
      uploaded++
      productData.push({
        name: `示例 ${i + 1}`,
        storagePath
      })
      console.log(`  ✓ Uploaded to ${storagePath}`)
    } else {
      console.log(`  ✗ Failed`)
    }
  }
  
  console.log(`\n=== Upload Complete ===`)
  console.log(`Uploaded: ${uploaded}/${files.length}`)
  
  // Generate preset data
  console.log('\n=== Generated Preset Data ===\n')
  console.log('// Preset Products (官方示例)')
  console.log('export const PRESET_PRODUCTS: Asset[] = [')
  productData.forEach((p, i) => {
    console.log(`  { id: 'pp-${i + 1}', type: 'product', name: '${p.name}', imageUrl: \`\${STORAGE_URL}/${p.storagePath}\`, isSystem: true },`)
  })
  console.log(']')
}

main().catch(console.error)

