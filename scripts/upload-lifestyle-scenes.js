#!/usr/bin/env node

/**
 * 上传 lifestyle_scene 图片到 Supabase Storage
 * 使用方法: node scripts/upload-lifestyle-scenes.js
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials. Please check .env.local')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SOURCE_DIR = '/Users/a/Desktop/street/lifestyle_scene'
const BUCKET = 'presets'
const TARGET_FOLDER = 'lifestyle_scene'

async function uploadFiles() {
  // 获取所有文件
  const files = fs.readdirSync(SOURCE_DIR).filter(f => 
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  )
  
  console.log(`Found ${files.length} files to upload`)
  
  let uploaded = 0
  let failed = 0
  const errors = []
  
  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file)
    const fileBuffer = fs.readFileSync(filePath)
    const targetPath = `${TARGET_FOLDER}/${file}`
    
    // 获取 MIME 类型
    const ext = path.extname(file).toLowerCase()
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    }
    const contentType = mimeTypes[ext] || 'image/jpeg'
    
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(targetPath, fileBuffer, {
          contentType,
          upsert: true // 如果文件存在则覆盖
        })
      
      if (error) {
        console.error(`✗ ${file}: ${error.message}`)
        failed++
        errors.push({ file, error: error.message })
      } else {
        uploaded++
        // 每 10 个文件输出一次进度
        if (uploaded % 10 === 0) {
          console.log(`✓ Uploaded ${uploaded}/${files.length}...`)
        }
      }
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`)
      failed++
      errors.push({ file, error: err.message })
    }
  }
  
  console.log('\n=== Upload Complete ===')
  console.log(`Total: ${files.length}`)
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Failed: ${failed}`)
  
  if (errors.length > 0) {
    console.log('\nFailed files:')
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`))
  }
  
  // 输出访问 URL 示例
  if (uploaded > 0) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${TARGET_FOLDER}/${files[0]}`)
    console.log('\nExample URL:')
    console.log(data.publicUrl)
  }
}

uploadFiles().catch(console.error)

