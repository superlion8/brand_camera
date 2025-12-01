/**
 * Clean and re-upload all model and background images
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

const BUCKET = 'presets'
const SOURCE_DIR = '/Users/a/Desktop/品牌相机预设资产'

// Category mapping
const MODEL_CATS = { '外模': 'western', '韩模': 'korean' }
const BG_CATS = { '室内': 'indoor', '自然': 'outdoor', '街头': 'street' }

async function deleteAllInFolder(folder: string) {
  console.log(`Deleting all files in ${folder}...`)
  
  const { data: items } = await supabase.storage.from(BUCKET).list(folder)
  if (!items || items.length === 0) return
  
  // Recursively handle subfolders
  for (const item of items) {
    if (!item.metadata) {
      // It's a subfolder
      await deleteAllInFolder(`${folder}/${item.name}`)
    }
  }
  
  // Delete all files in this folder
  const files = items.filter(i => i.metadata).map(i => `${folder}/${i.name}`)
  if (files.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(files)
    if (error) console.error(`  Error:`, error.message)
    else console.log(`  Deleted ${files.length} files`)
  }
}

async function uploadImage(localPath: string, storagePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    
    // Convert to JPEG with compression
    const image = sharp(fileBuffer)
    const meta = await image.metadata()
    
    // Resize large images
    const maxDim = storagePath.includes('models') ? 800 : 1200
    let outputBuffer: Buffer
    if (meta.width && meta.width > maxDim * 2) {
      outputBuffer = await image.resize(maxDim, Math.round(maxDim * 1.5), { 
        fit: 'inside', 
        withoutEnlargement: true 
      }).jpeg({ quality: 85 }).toBuffer()
    } else {
      outputBuffer = await image.jpeg({ quality: 90 }).toBuffer()
    }
    
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, outputBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    })
    
    if (error) {
      console.error(`  ✗ ${storagePath}: ${error.message}`)
      return false
    }
    return true
  } catch (err: any) {
    console.error(`  ✗ ${path.basename(localPath)}: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('=== Step 1: Clean ALL old files ===\n')
  
  await deleteAllInFolder('models')
  await deleteAllInFolder('backgrounds')
  
  console.log('\n=== Step 2: Upload new models ===\n')
  
  const modelDir = path.join(SOURCE_DIR, '模特')
  for (const [cnName, enName] of Object.entries(MODEL_CATS)) {
    const subdir = path.join(modelDir, cnName)
    if (!fs.existsSync(subdir)) continue
    
    const files = fs.readdirSync(subdir).filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    ).sort()
    
    console.log(`${cnName} (${enName}): ${files.length} files`)
    
    let count = 0
    for (let i = 0; i < files.length; i++) {
      const success = await uploadImage(
        path.join(subdir, files[i]),
        `models/${enName}/model-${i + 1}.jpg`
      )
      if (success) count++
      process.stdout.write(`\r  Progress: ${i + 1}/${files.length}`)
    }
    console.log(`\n  ✓ Uploaded: ${count}/${files.length}\n`)
  }
  
  console.log('=== Step 3: Upload new backgrounds ===\n')
  
  const bgDir = path.join(SOURCE_DIR, '背景')
  for (const [cnName, enName] of Object.entries(BG_CATS)) {
    const subdir = path.join(bgDir, cnName)
    if (!fs.existsSync(subdir)) continue
    
    const files = fs.readdirSync(subdir).filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    ).sort()
    
    console.log(`${cnName} (${enName}): ${files.length} files`)
    
    let count = 0
    for (let i = 0; i < files.length; i++) {
      const success = await uploadImage(
        path.join(subdir, files[i]),
        `backgrounds/${enName}/bg-${i + 1}.jpg`
      )
      if (success) count++
      process.stdout.write(`\r  Progress: ${i + 1}/${files.length}`)
    }
    console.log(`\n  ✓ Uploaded: ${count}/${files.length}\n`)
  }
  
  console.log('=== Done! ===')
}

main().catch(console.error)

