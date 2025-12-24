#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials. Please check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const BUCKET = 'presets'
const SOURCE_DIR = '/Users/a/Desktop/bcam_src/首页/lifestyle'

async function uploadFile(localPath, storagePath) {
  const fileContent = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
  
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fileContent, {
    contentType,
    upsert: true,
  })
  
  if (error) {
    console.error(`❌ 上传失败 ${storagePath}:`, error.message)
    return false
  }
  console.log(`✓ ${storagePath}`)
  return true
}

async function uploadLifestyleHomepageImages() {
  console.log('🚀 上传 Lifestyle 首页图片到 Supabase Storage')
  console.log(`   Bucket: ${BUCKET}/homepage`)
  
  // Upload before.png
  await uploadFile(
    path.join(SOURCE_DIR, 'before.png'),
    'homepage/lifestyle-before.png'
  )
  
  // Upload after.jpg
  await uploadFile(
    path.join(SOURCE_DIR, 'after.jpg'),
    'homepage/lifestyle-after.jpg'
  )
  
  console.log('\n✅ 上传完成!')
  console.log('\n📝 请更新 page.tsx 中的图片引用:')
  console.log('   Lifestyle: lifestyle-before.png, lifestyle-after.jpg')
}

uploadLifestyleHomepageImages().catch(console.error)

