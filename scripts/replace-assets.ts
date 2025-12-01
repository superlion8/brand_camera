/**
 * Replace model and background images in Supabase Storage
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
const SOURCE_DIR = '/Users/a/Desktop/品牌相机预设资产'

// New category mapping
const MODEL_CATEGORIES = {
  '外模': 'western',
  '韩模': 'korean',
}

const BACKGROUND_CATEGORIES = {
  '室内': 'indoor',
  '自然': 'outdoor', 
  '街头': 'street',
}

async function deleteFolder(folderPath: string) {
  console.log(`Deleting ${folderPath}...`)
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath)
  
  if (error) {
    console.error(`Error listing ${folderPath}:`, error.message)
    return
  }
  
  if (data && data.length > 0) {
    // Check for subfolders
    for (const item of data) {
      if (!item.metadata) {
        // It's a folder, recurse
        await deleteFolder(`${folderPath}/${item.name}`)
      }
    }
    
    // Delete files
    const files = data.filter(f => f.metadata).map(f => `${folderPath}/${f.name}`)
    if (files.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(files)
      
      if (deleteError) {
        console.error(`Error deleting files in ${folderPath}:`, deleteError.message)
      } else {
        console.log(`  Deleted ${files.length} files`)
      }
    }
  }
}

async function uploadFile(localPath: string, storagePath: string, maxSize: number = 800): Promise<boolean> {
  try {
    let fileBuffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    
    // Convert and compress
    console.log(`  Processing ${path.basename(localPath)} (${Math.round(fileBuffer.length / 1024)}KB)...`)
    
    const image = sharp(fileBuffer)
    const metadata = await image.metadata()
    
    // Resize if too large
    if (metadata.width && metadata.width > maxSize * 2) {
      const compressed = await image
        .resize(maxSize, maxSize * 1.5, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      fileBuffer = Buffer.from(compressed)
    } else {
      const compressed = await image.jpeg({ quality: 90 }).toBuffer()
      fileBuffer = Buffer.from(compressed)
    }
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })
    
    if (error) {
      console.error(`  Error uploading ${storagePath}:`, error.message)
      return false
    }
    
    console.log(`  ✓ Uploaded to ${storagePath} (${Math.round(fileBuffer.length / 1024)}KB)`)
    return true
  } catch (err: any) {
    console.error(`  Error processing ${localPath}:`, err.message)
    return false
  }
}

async function main() {
  console.log('=== Replacing Model and Background Assets ===\n')
  
  // Step 1: Delete old models
  console.log('Step 1: Deleting old models...')
  await deleteFolder('models')
  console.log('')
  
  // Step 2: Delete old backgrounds
  console.log('Step 2: Deleting old backgrounds...')
  await deleteFolder('backgrounds')
  console.log('')
  
  // Step 3: Upload new models
  console.log('Step 3: Uploading new models...\n')
  const modelData: { category: string; count: number }[] = []
  
  const modelDir = path.join(SOURCE_DIR, '模特')
  const modelSubdirs = fs.readdirSync(modelDir).filter(f => 
    fs.statSync(path.join(modelDir, f)).isDirectory() && !f.startsWith('.')
  )
  
  for (const subdir of modelSubdirs) {
    const englishCat = MODEL_CATEGORIES[subdir as keyof typeof MODEL_CATEGORIES]
    if (!englishCat) {
      console.log(`Skipping unknown model category: ${subdir}`)
      continue
    }
    
    const subdirPath = path.join(modelDir, subdir)
    const files = fs.readdirSync(subdirPath).filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
    )
    
    console.log(`--- ${subdir} (${englishCat}): ${files.length} files ---`)
    
    let uploaded = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localPath = path.join(subdirPath, file)
      const storagePath = `models/${englishCat}/model-${i + 1}.jpg`
      
      if (await uploadFile(localPath, storagePath)) {
        uploaded++
      }
    }
    
    modelData.push({ category: englishCat, count: uploaded })
    console.log(`  Total: ${uploaded}/${files.length} uploaded\n`)
  }
  
  // Step 4: Upload new backgrounds
  console.log('Step 4: Uploading new backgrounds...\n')
  const bgData: { category: string; count: number }[] = []
  
  const bgDir = path.join(SOURCE_DIR, '背景')
  const bgSubdirs = fs.readdirSync(bgDir).filter(f => 
    fs.statSync(path.join(bgDir, f)).isDirectory() && !f.startsWith('.')
  )
  
  for (const subdir of bgSubdirs) {
    const englishCat = BACKGROUND_CATEGORIES[subdir as keyof typeof BACKGROUND_CATEGORIES]
    if (!englishCat) {
      console.log(`Skipping unknown background category: ${subdir}`)
      continue
    }
    
    const subdirPath = path.join(bgDir, subdir)
    const files = fs.readdirSync(subdirPath).filter(f => 
      /\.(jpg|jpeg|png|webp|heic)$/i.test(f) && !f.startsWith('.')
    )
    
    console.log(`--- ${subdir} (${englishCat}): ${files.length} files ---`)
    
    let uploaded = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localPath = path.join(subdirPath, file)
      const storagePath = `backgrounds/${englishCat}/bg-${i + 1}.jpg`
      
      if (await uploadFile(localPath, storagePath, 1200)) {
        uploaded++
      }
    }
    
    bgData.push({ category: englishCat, count: uploaded })
    console.log(`  Total: ${uploaded}/${files.length} uploaded\n`)
  }
  
  // Print summary
  console.log('\n=== Summary ===')
  console.log('\nModels:')
  modelData.forEach(m => console.log(`  ${m.category}: ${m.count}`))
  console.log('\nBackgrounds:')
  bgData.forEach(b => console.log(`  ${b.category}: ${b.count}`))
  
  // Generate preset code
  console.log('\n\n=== Generated Preset Code ===\n')
  
  console.log('// Model subcategories (updated)')
  console.log("export type ModelSubcategory = 'korean' | 'western'\n")
  
  console.log('export const MODEL_SUBCATEGORIES: { id: ModelSubcategory; label: string }[] = [')
  console.log("  { id: 'korean', label: '韩模' },")
  console.log("  { id: 'western', label: '外模' },")
  console.log(']\n')
  
  console.log('// Preset Models')
  console.log('export const PRESET_MODELS: Asset[] = [')
  for (const m of modelData) {
    const label = m.category === 'korean' ? '韩模' : '外模'
    console.log(`  // ${label} (${m.count})`)
    for (let i = 1; i <= m.count; i++) {
      console.log(`  { id: 'pm-${m.category.substring(0,2)}-${i}', type: 'model', name: '${label} ${i}', imageUrl: \`\${STORAGE_URL}/models/${m.category}/model-${i}.jpg?\${CACHE_VERSION}\`, isSystem: true, styleCategory: '${m.category}', category: '${m.category}' },`)
    }
  }
  console.log(']\n')
  
  console.log('// Preset Backgrounds')
  console.log('export const PRESET_BACKGROUNDS: Asset[] = [')
  for (const b of bgData) {
    const labelMap: Record<string, string> = { indoor: '室内', outdoor: '自然', street: '街头' }
    console.log(`  // ${labelMap[b.category]} (${b.count})`)
    console.log(`  ...Array.from({ length: ${b.count} }, (_, i) => ({`)
    console.log(`    id: \`pb-${b.category.substring(0,2)}-\${i + 1}\`,`)
    console.log(`    type: 'background' as AssetType,`)
    console.log(`    name: \`${labelMap[b.category]} \${i + 1}\`,`)
    console.log(`    imageUrl: \`\${STORAGE_URL}/backgrounds/${b.category}/bg-\${i + 1}.jpg?\${CACHE_VERSION}\`,`)
    console.log(`    isSystem: true,`)
    console.log(`    category: '${b.category}' as const`)
    console.log(`  })),`)
  }
  console.log(']')
}

main().catch(console.error)

