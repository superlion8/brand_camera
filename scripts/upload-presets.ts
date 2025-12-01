/**
 * Script to upload preset images to Supabase Storage
 * Run with: npx ts-node scripts/upload-presets.ts
 * 
 * Make sure to set environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (needs service role for bucket operations)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const BUCKET_NAME = 'presets'
const PRESETS_DIR = path.join(__dirname, '../public/presets')

interface UploadResult {
  path: string
  publicUrl: string
}

async function ensureBucketExists() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
  
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })
    if (error) {
      console.error('Error creating bucket:', error)
      throw error
    }
    console.log(`Created bucket: ${BUCKET_NAME}`)
  } else {
    console.log(`Bucket ${BUCKET_NAME} already exists`)
  }
}

async function uploadFile(localPath: string, storagePath: string): Promise<UploadResult | null> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    const ext = path.extname(localPath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true
      })
    
    if (error) {
      console.error(`Error uploading ${storagePath}:`, error)
      return null
    }
    
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)
    
    return {
      path: storagePath,
      publicUrl: urlData.publicUrl
    }
  } catch (err) {
    console.error(`Error reading file ${localPath}:`, err)
    return null
  }
}

async function uploadDirectory(dirPath: string, storagePrefix: string = ''): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  const items = fs.readdirSync(dirPath)
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const storagePath = storagePrefix ? `${storagePrefix}/${item}` : item
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      const subResults = await uploadDirectory(fullPath, storagePath)
      results.push(...subResults)
    } else if (stat.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(item)) {
      console.log(`Uploading: ${storagePath}`)
      const result = await uploadFile(fullPath, storagePath)
      if (result) {
        results.push(result)
      }
    }
  }
  
  return results
}

async function generatePresetsData(results: UploadResult[]) {
  // Group by category
  const models: any[] = []
  const backgrounds: any[] = []
  const vibes: any[] = []
  
  for (const result of results) {
    const parts = result.path.split('/')
    
    if (parts[0] === 'models') {
      const subcategory = parts[1] // chinese, korean, western
      const name = parts[2].replace(/\.[^.]+$/, '').replace(/-/g, ' ')
      models.push({
        id: `pm-${subcategory.substring(0, 2)}-${models.filter(m => m.subcategory === subcategory).length + 1}`,
        type: 'model',
        name: `${subcategory === 'chinese' ? '中式' : subcategory === 'korean' ? '韩系' : '欧美'} ${models.filter(m => m.subcategory === subcategory).length + 1}`,
        imageUrl: result.publicUrl,
        isSystem: true,
        styleCategory: subcategory,
        subcategory: subcategory
      })
    } else if (parts[0] === 'backgrounds') {
      const subcategory = parts[1] // indoor, outdoor, street
      const subcategoryLabel = subcategory === 'indoor' ? '室内' : subcategory === 'outdoor' ? '自然' : '街头'
      backgrounds.push({
        id: `pb-${subcategory.substring(0, 2)}-${backgrounds.filter(b => b.subcategory === subcategory).length + 1}`,
        type: 'background',
        name: `${subcategoryLabel} ${backgrounds.filter(b => b.subcategory === subcategory).length + 1}`,
        imageUrl: result.publicUrl,
        isSystem: true,
        subcategory: subcategory
      })
    } else if (parts[0] === 'vibes') {
      vibes.push({
        id: `pv-${vibes.length + 1}`,
        type: 'vibe',
        name: `氛围 ${vibes.length + 1}`,
        imageUrl: result.publicUrl,
        isSystem: true
      })
    }
  }
  
  console.log('\n=== Generated Presets Data ===\n')
  console.log('PRESET_MODELS:', JSON.stringify(models, null, 2))
  console.log('\nPRESET_BACKGROUNDS:', JSON.stringify(backgrounds, null, 2))
  console.log('\nPRESET_VIBES:', JSON.stringify(vibes, null, 2))
  
  return { models, backgrounds, vibes }
}

async function main() {
  console.log('Starting preset upload...\n')
  
  try {
    await ensureBucketExists()
    
    console.log(`\nUploading files from: ${PRESETS_DIR}\n`)
    const results = await uploadDirectory(PRESETS_DIR)
    
    console.log(`\nUploaded ${results.length} files successfully!\n`)
    
    // Generate the presets data for updating the code
    await generatePresetsData(results)
    
  } catch (error) {
    console.error('Upload failed:', error)
    process.exit(1)
  }
}

main()

