#!/usr/bin/env node

/**
 * 重试上传失败的文件
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SOURCE_DIR = '/Users/a/Desktop/street/lifestyle_scene'
const BUCKET = 'presets'
const TARGET_FOLDER = 'lifestyle_scene'

// 需要重试的文件
const filesToRetry = [
  'scene178.jpg',
  'scene276.jpg', 
  'scene442.jpg'
]

// 需要压缩的大文件
const largeFiles = [
  'scene074.jpg',
  'scene075.jpg',
  'scene080.png'
]

async function uploadFile(file, buffer) {
  const targetPath = `${TARGET_FOLDER}/${file}`
  const ext = path.extname(file).toLowerCase()
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  }
  const contentType = mimeTypes[ext] || 'image/jpeg'
  
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(targetPath, buffer, {
      contentType,
      upsert: true
    })
  
  return { data, error }
}

async function main() {
  console.log('=== Retrying failed uploads ===\n')
  
  // 1. 重试网络失败的文件
  console.log('Retrying network-failed files...')
  for (const file of filesToRetry) {
    const filePath = path.join(SOURCE_DIR, file)
    const fileBuffer = fs.readFileSync(filePath)
    
    const { error } = await uploadFile(file, fileBuffer)
    if (error) {
      console.log(`✗ ${file}: ${error.message}`)
    } else {
      console.log(`✓ ${file}`)
    }
  }
  
  // 2. 压缩并上传大文件
  console.log('\nCompressing and uploading large files...')
  for (const file of largeFiles) {
    const filePath = path.join(SOURCE_DIR, file)
    const tempPath = `/tmp/${file.replace(/\.(jpg|png)$/i, '_compressed.jpg')}`
    
    try {
      // 使用 sips 压缩图片（macOS 内置）
      // 调整质量和大小，使文件小于 5MB
      execSync(`sips -s format jpeg -s formatOptions 70 --resampleWidth 2000 "${filePath}" --out "${tempPath}"`, {
        stdio: 'pipe'
      })
      
      const compressedBuffer = fs.readFileSync(tempPath)
      const compressedSize = compressedBuffer.length / 1024 / 1024
      console.log(`  ${file} compressed to ${compressedSize.toFixed(2)}MB`)
      
      // 上传时使用原文件名（但扩展名改为 jpg）
      const newFileName = file.replace(/\.png$/i, '.jpg')
      const { error } = await uploadFile(newFileName, compressedBuffer)
      
      if (error) {
        console.log(`✗ ${newFileName}: ${error.message}`)
      } else {
        console.log(`✓ ${newFileName}`)
      }
      
      // 清理临时文件
      fs.unlinkSync(tempPath)
    } catch (err) {
      console.log(`✗ ${file}: ${err.message}`)
    }
  }
  
  console.log('\n=== Done ===')
}

main().catch(console.error)

