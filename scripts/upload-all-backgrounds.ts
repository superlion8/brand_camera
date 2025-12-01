/**
 * Upload all background images to Supabase Storage
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const BUCKET_NAME = 'presets'
const SOURCE_DIR = '/Users/a/Desktop/品牌相机预设资产/背景'

const SUBCATEGORY_MAP: Record<string, string> = {
  '室内': 'indoor',
  '自然': 'outdoor', 
  '街头': 'street'
}

async function uploadFile(localPath: string, storagePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    
    // Handle different image formats
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.heic') contentType = 'image/heic'
    
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
  console.log('Starting background upload...\n')
  
  let totalUploaded = 0
  let totalFailed = 0
  
  const subcategories = fs.readdirSync(SOURCE_DIR).filter(f => 
    fs.statSync(path.join(SOURCE_DIR, f)).isDirectory() && !f.startsWith('.')
  )
  
  for (const subcat of subcategories) {
    const subcatPath = path.join(SOURCE_DIR, subcat)
    const englishSubcat = SUBCATEGORY_MAP[subcat] || subcat.toLowerCase()
    
    const files = fs.readdirSync(subcatPath).filter(f => 
      /\.(jpg|jpeg|png|webp|heic)$/i.test(f) && !f.startsWith('.')
    )
    
    console.log(`\n=== ${subcat} (${englishSubcat}): ${files.length} files ===`)
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localPath = path.join(subcatPath, file)
      
      // Generate clean filename
      const ext = path.extname(file).toLowerCase()
      const storagePath = `backgrounds/${englishSubcat}/bg-${i + 1}${ext}`
      
      process.stdout.write(`Uploading ${i + 1}/${files.length}: ${storagePath}... `)
      
      const success = await uploadFile(localPath, storagePath)
      if (success) {
        console.log('✓')
        totalUploaded++
      } else {
        console.log('✗')
        totalFailed++
      }
    }
  }
  
  console.log(`\n=== Upload Complete ===`)
  console.log(`Uploaded: ${totalUploaded}`)
  console.log(`Failed: ${totalFailed}`)
  
  // Generate the presets data
  console.log('\n=== Generating presets data... ===\n')
  
  const backgrounds: any[] = []
  
  for (const subcat of subcategories) {
    const subcatPath = path.join(SOURCE_DIR, subcat)
    const englishSubcat = SUBCATEGORY_MAP[subcat] || subcat.toLowerCase()
    const subcatLabel = subcat
    
    const files = fs.readdirSync(subcatPath).filter(f => 
      /\.(jpg|jpeg|png|webp|heic)$/i.test(f) && !f.startsWith('.')
    )
    
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i]).toLowerCase()
      backgrounds.push({
        id: `pb-${englishSubcat.substring(0, 2)}-${i + 1}`,
        type: 'background',
        name: `${subcatLabel} ${i + 1}`,
        imageUrl: `\${STORAGE_URL}/backgrounds/${englishSubcat}/bg-${i + 1}${ext}`,
        isSystem: true,
        subcategory: englishSubcat
      })
    }
  }
  
  console.log('Total backgrounds:', backgrounds.length)
  console.log('\nCopy this to src/data/presets.ts:\n')
  console.log('export const PRESET_BACKGROUNDS: Asset[] = [')
  
  for (const subcat of ['indoor', 'outdoor', 'street']) {
    const items = backgrounds.filter(b => b.subcategory === subcat)
    console.log(`  // ${subcat === 'indoor' ? '室内' : subcat === 'outdoor' ? '自然' : '街头'} (${items.length})`)
    items.forEach(item => {
      console.log(`  { id: '${item.id}', type: 'background', name: '${item.name}', imageUrl: \`${item.imageUrl}\`, isSystem: true, subcategory: '${item.subcategory}' },`)
    })
  }
  console.log(']')
}

main().catch(console.error)

