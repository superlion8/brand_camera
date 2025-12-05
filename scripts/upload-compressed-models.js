#!/usr/bin/env node
/**
 * 上传压缩后的棚拍模特到 Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://cvdogeigbpussfamctsu.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 请设置环境变量 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const BUCKET = 'presets'
const SOURCE_DIR = '/tmp/studio-models-compressed'

async function deleteFolder(folderPath) {
  console.log(`🗑️  删除文件夹: ${folderPath}`)
  
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folderPath)
    
    if (error || !files || files.length === 0) {
      console.log(`   文件夹为空或不存在`)
      return
    }
    
    const filePaths = files.map(f => `${folderPath}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(filePaths)
    
    if (deleteError) {
      console.error(`   删除失败:`, deleteError.message)
    } else {
      console.log(`   ✓ 删除了 ${files.length} 个文件`)
    }
  } catch (e) {
    console.error(`   删除出错:`, e.message)
  }
}

async function uploadFile(localPath, remotePath) {
  const fileBuffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, fileBuffer, {
      contentType,
      upsert: true
    })
  
  if (error) {
    console.error(`   ❌ 上传失败 ${remotePath}:`, error.message)
    return false
  }
  
  console.log(`   ✓ ${remotePath}`)
  return true
}

async function main() {
  console.log('🚀 上传压缩后的棚拍模特...')
  
  // 删除旧文件
  await deleteFolder('studio-models')
  
  // 读取压缩后的文件
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => !f.startsWith('.') && (f.endsWith('.jpg') || f.endsWith('.png')))
    .sort()
  
  console.log(`   找到 ${files.length} 个压缩后的模特图片`)
  
  let count = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const localPath = path.join(SOURCE_DIR, file)
    // 统一命名为 01.jpg, 02.jpg, ...
    const newName = `${String(i + 1).padStart(2, '0')}.jpg`
    const remotePath = `studio-models/${newName}`
    
    if (await uploadFile(localPath, remotePath)) {
      count++
    }
  }
  
  console.log(`\n✅ 上传完成: ${count}/${files.length}`)
  console.log(`\n📝 STUDIO_MODELS 配置: ${count} 张 (01.jpg ~ ${String(count).padStart(2, '0')}.jpg)`)
}

main().catch(console.error)

