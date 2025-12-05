#!/usr/bin/env node
/**
 * 上传棚拍资源到 Supabase Storage
 * 
 * 使用方法:
 * 1. 设置环境变量 SUPABASE_SERVICE_ROLE_KEY
 * 2. node scripts/upload-studio-assets.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase 配置
const SUPABASE_URL = 'https://cvdogeigbpussfamctsu.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 请设置环境变量 SUPABASE_SERVICE_ROLE_KEY')
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const BUCKET = 'presets'

// 源文件路径
const SOURCE_DIR = path.join(process.env.HOME, 'Desktop/brand_cam资源/V2')
const MODELS_DIR = path.join(SOURCE_DIR, '棚拍模特')
const BG_DIR = path.join(SOURCE_DIR, '棚拍背景')

async function deleteFolder(folderPath) {
  console.log(`🗑️  删除文件夹: ${folderPath}`)
  
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folderPath)
    
    if (error) {
      console.log(`   文件夹不存在或已为空: ${folderPath}`)
      return
    }
    
    if (files && files.length > 0) {
      const filePaths = files.map(f => `${folderPath}/${f.name}`)
      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove(filePaths)
      
      if (deleteError) {
        console.error(`   删除失败:`, deleteError.message)
      } else {
        console.log(`   ✓ 删除了 ${files.length} 个文件`)
      }
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

async function uploadModels() {
  console.log('\n📸 上传棚拍模特...')
  
  // 先删除旧文件
  await deleteFolder('studio-models')
  
  // 读取文件并按名称排序
  const files = fs.readdirSync(MODELS_DIR)
    .filter(f => !f.startsWith('.') && (f.endsWith('.png') || f.endsWith('.jpg')))
    .sort()
  
  console.log(`   找到 ${files.length} 个模特图片`)
  
  let count = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const localPath = path.join(MODELS_DIR, file)
    const ext = path.extname(file)
    // 重命名为 01.png, 02.png, ...
    const newName = `${String(i + 1).padStart(2, '0')}${ext}`
    const remotePath = `studio-models/${newName}`
    
    if (await uploadFile(localPath, remotePath)) {
      count++
    }
  }
  
  console.log(`   上传完成: ${count}/${files.length}`)
  return count
}

async function uploadBackgrounds() {
  console.log('\n🖼️  上传棚拍背景...')
  
  const subFolders = [
    { local: '打光背景', remote: 'light' },
    { local: '纯色背景', remote: 'solid' },
    { local: '花色背景', remote: 'pattern' },
  ]
  
  let totalCount = 0
  
  for (const folder of subFolders) {
    const localFolder = path.join(BG_DIR, folder.local)
    const remoteFolder = `studio-backgrounds/${folder.remote}`
    
    console.log(`\n   📁 ${folder.local} -> ${remoteFolder}`)
    
    // 先删除旧文件
    await deleteFolder(remoteFolder)
    
    if (!fs.existsSync(localFolder)) {
      console.log(`      文件夹不存在: ${localFolder}`)
      continue
    }
    
    const files = fs.readdirSync(localFolder)
      .filter(f => !f.startsWith('.') && (f.endsWith('.png') || f.endsWith('.jpg')))
      .sort()
    
    console.log(`      找到 ${files.length} 个背景图片`)
    
    for (const file of files) {
      const localPath = path.join(localFolder, file)
      const remotePath = `${remoteFolder}/${file}`
      
      if (await uploadFile(localPath, remotePath)) {
        totalCount++
      }
    }
  }
  
  console.log(`\n   背景上传完成: ${totalCount} 个文件`)
  return totalCount
}

async function main() {
  console.log('🚀 开始上传棚拍资源到 Supabase Storage')
  console.log(`   Bucket: ${BUCKET}`)
  console.log(`   源目录: ${SOURCE_DIR}`)
  
  const modelCount = await uploadModels()
  const bgCount = await uploadBackgrounds()
  
  console.log('\n✅ 上传完成!')
  console.log(`   棚拍模特: ${modelCount} 张`)
  console.log(`   棚拍背景: ${bgCount} 张`)
  
  // 输出需要更新的配置
  console.log('\n📝 请更新 presets.ts 中的配置:')
  console.log(`   STUDIO_MODELS: ${modelCount} 张 (01.png ~ ${String(modelCount).padStart(2, '0')}.png)`)
}

main().catch(console.error)

