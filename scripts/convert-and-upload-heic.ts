/**
 * Convert HEIC files to JPG and upload to Supabase Storage
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
// @ts-ignore
import convert from 'heic-convert'
import sharp from 'sharp'

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

// HEIC files that failed
const FAILED_HEIC: { subcat: string; index: number; filename: string }[] = []

async function convertHeicToJpg(inputPath: string): Promise<Buffer> {
  const inputBuffer = fs.readFileSync(inputPath)
  
  // Convert HEIC to JPEG
  const jpegBuffer = await convert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.9
  })
  
  return Buffer.from(jpegBuffer)
}

async function compressAndUpload(
  buffer: Buffer, 
  storagePath: string,
  maxSizeKB: number = 4000
): Promise<boolean> {
  try {
    // Compress with sharp if needed
    let processedBuffer = buffer
    let quality = 85
    
    while (processedBuffer.length > maxSizeKB * 1024 && quality > 30) {
      processedBuffer = await sharp(buffer)
        .jpeg({ quality })
        .toBuffer()
      quality -= 10
    }
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })
    
    if (error) {
      console.error(`Error uploading ${storagePath}:`, error.message)
      return false
    }
    return true
  } catch (err: any) {
    console.error(`Error processing ${storagePath}:`, err.message)
    return false
  }
}

async function main() {
  console.log('Converting HEIC files and uploading...\n')
  
  let converted = 0
  let failed = 0
  
  const subcategories = fs.readdirSync(SOURCE_DIR).filter(f => 
    fs.statSync(path.join(SOURCE_DIR, f)).isDirectory() && !f.startsWith('.')
  )
  
  for (const subcat of subcategories) {
    const subcatPath = path.join(SOURCE_DIR, subcat)
    const englishSubcat = SUBCATEGORY_MAP[subcat] || subcat.toLowerCase()
    
    const files = fs.readdirSync(subcatPath).filter(f => 
      /\.(heic)$/i.test(f) && !f.startsWith('.')
    )
    
    if (files.length === 0) continue
    
    console.log(`\n=== ${subcat} (${englishSubcat}): ${files.length} HEIC files ===`)
    
    // Get all files to find correct index
    const allFiles = fs.readdirSync(subcatPath).filter(f => 
      /\.(jpg|jpeg|png|webp|heic)$/i.test(f) && !f.startsWith('.')
    )
    
    for (const file of files) {
      const index = allFiles.indexOf(file) + 1
      const localPath = path.join(subcatPath, file)
      const storagePath = `backgrounds/${englishSubcat}/bg-${index}.jpg` // Convert to .jpg
      
      process.stdout.write(`Converting & uploading bg-${index}.heic -> ${storagePath}... `)
      
      try {
        const jpegBuffer = await convertHeicToJpg(localPath)
        const success = await compressAndUpload(jpegBuffer, storagePath)
        
        if (success) {
          console.log('✓')
          converted++
        } else {
          console.log('✗')
          failed++
        }
      } catch (err: any) {
        console.log(`✗ (${err.message})`)
        failed++
      }
    }
  }
  
  // Also handle the oversized file
  console.log('\n=== Handling oversized file ===')
  const oversizedPath = '/Users/a/Desktop/品牌相机预设资产/背景/街头'
  const allStreetFiles = fs.readdirSync(oversizedPath).filter(f => 
    /\.(jpg|jpeg|png|webp|heic)$/i.test(f) && !f.startsWith('.')
  )
  
  // Find the file at index 80
  const file80 = allStreetFiles[79] // 0-indexed
  if (file80 && !file80.endsWith('.heic')) {
    const localPath = path.join(oversizedPath, file80)
    const storagePath = `backgrounds/street/bg-80.jpg`
    
    process.stdout.write(`Compressing & uploading ${file80} -> ${storagePath}... `)
    
    try {
      const buffer = fs.readFileSync(localPath)
      const success = await compressAndUpload(buffer, storagePath, 4000)
      
      if (success) {
        console.log('✓')
        converted++
      } else {
        console.log('✗')
        failed++
      }
    } catch (err: any) {
      console.log(`✗ (${err.message})`)
      failed++
    }
  }
  
  console.log(`\n=== Complete ===`)
  console.log(`Converted & uploaded: ${converted}`)
  console.log(`Failed: ${failed}`)
}

main().catch(console.error)

