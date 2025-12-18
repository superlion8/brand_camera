#!/usr/bin/env node
/**
 * 压缩并上传 V4-tags/models 文件夹到 Supabase Storage presets/all_models
 * 使用 sharp 库进行图片压缩
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

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
const SOURCE_DIR = '/Users/a/Desktop/bcam_src/V4-tags/models'
const TARGET_FOLDER = 'all_models'
const TEMP_DIR = '/tmp/compressed_models'
const MAX_SIZE = 4 * 1024 * 1024 // 4MB limit (safe margin)

// 确保临时目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

async function deleteFolder(folderPath) {
  console.log(`🗑️  清理 Storage 文件夹: ${folderPath}`)
  
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folderPath)
    
    if (error || !files || files.length === 0) {
      console.log(`   文件夹为空或不存在，跳过清理`)
      return
    }
    
    const filePaths = files.map(f => `${folderPath}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(filePaths)
    
    if (deleteError) {
      console.error(`   删除失败:`, deleteError.message)
    } else {
      console.log(`   ✓ 删除了 ${files.length} 个旧文件`)
    }
  } catch (e) {
    console.error(`   删除出错:`, e.message)
  }
}

function compressImage(srcPath, dstPath) {
  const ext = path.extname(srcPath).toLowerCase()
  
  try {
    // 使用 macOS 内置的 sips 进行压缩
    // 先复制原文件
    fs.copyFileSync(srcPath, dstPath)
    
    const originalSize = fs.statSync(srcPath).size
    
    if (originalSize <= MAX_SIZE) {
      return { compressed: false, size: originalSize }
    }
    
    // 计算目标质量和缩放比例
    const ratio = Math.sqrt(MAX_SIZE / originalSize)
    const targetWidth = Math.floor(2000 * Math.min(ratio, 1)) // 最大2000像素宽
    
    // 使用 sips 缩放
    execSync(`sips --resampleWidth ${targetWidth} "${dstPath}" --out "${dstPath}" 2>/dev/null`, { stdio: 'pipe' })
    
    // 如果是 png 且仍然太大，转换为 jpg
    let finalPath = dstPath
    let newSize = fs.statSync(dstPath).size
    
    if (newSize > MAX_SIZE && ext === '.png') {
      const jpgPath = dstPath.replace(/\.png$/i, '.jpg')
      execSync(`sips -s format jpeg -s formatOptions 80 "${dstPath}" --out "${jpgPath}" 2>/dev/null`, { stdio: 'pipe' })
      if (fs.existsSync(jpgPath)) {
        fs.unlinkSync(dstPath)
        finalPath = jpgPath
        newSize = fs.statSync(jpgPath).size
      }
    }
    
    // 如果还是太大，进一步缩小
    if (newSize > MAX_SIZE) {
      const smallerWidth = Math.floor(targetWidth * 0.7)
      execSync(`sips --resampleWidth ${smallerWidth} "${finalPath}" --out "${finalPath}" 2>/dev/null`, { stdio: 'pipe' })
      newSize = fs.statSync(finalPath).size
    }
    
    return { 
      compressed: true, 
      size: newSize,
      finalPath: finalPath !== dstPath ? finalPath : null
    }
  } catch (e) {
    // 如果压缩失败，使用原文件
    if (!fs.existsSync(dstPath)) {
      fs.copyFileSync(srcPath, dstPath)
    }
    return { compressed: false, size: fs.statSync(dstPath).size, error: e.message }
  }
}

async function uploadFile(localPath, remotePath) {
  const fileBuffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  
  let contentType = 'image/jpeg'
  if (ext === '.png') {
    contentType = 'image/png'
  }
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, fileBuffer, {
      contentType,
      upsert: true
    })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

async function main() {
  console.log('🚀 压缩并上传 V4-tags/models 到 Supabase Storage...')
  console.log(`   源目录: ${SOURCE_DIR}`)
  console.log(`   目标路径: ${BUCKET}/${TARGET_FOLDER}`)
  console.log(`   临时目录: ${TEMP_DIR}`)
  console.log('')
  
  // 先清理旧文件
  await deleteFolder(TARGET_FOLDER)
  
  // 读取源目录的所有图片
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => {
      const ext = f.toLowerCase()
      return !f.startsWith('.') && 
        (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png'))
    })
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })
  
  console.log(`📁 找到 ${files.length} 个图片文件`)
  console.log('')
  
  let successCount = 0
  let failCount = 0
  let compressedCount = 0
  
  for (const file of files) {
    const srcPath = path.join(SOURCE_DIR, file)
    const dstPath = path.join(TEMP_DIR, file.toLowerCase())
    
    process.stdout.write(`   处理 ${file}...`)
    
    // 压缩
    const compressResult = compressImage(srcPath, dstPath)
    const finalPath = compressResult.finalPath || dstPath
    const finalName = path.basename(finalPath)
    
    if (compressResult.compressed) {
      compressedCount++
      process.stdout.write(` 压缩到 ${(compressResult.size/1024/1024).toFixed(1)}MB...`)
    }
    
    // 上传
    const remotePath = `${TARGET_FOLDER}/${finalName}`
    const uploadResult = await uploadFile(finalPath, remotePath)
    
    if (uploadResult.success) {
      successCount++
      console.log(' ✓')
    } else {
      failCount++
      console.log(` ✗ (${uploadResult.error})`)
    }
  }
  
  // 清理临时文件
  console.log('')
  console.log('🧹 清理临时文件...')
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  } catch (e) {}
  
  console.log('')
  console.log('═'.repeat(50))
  console.log(`✅ 上传完成!`)
  console.log(`   成功: ${successCount}`)
  console.log(`   失败: ${failCount}`)
  console.log(`   压缩: ${compressedCount}`)
  console.log(`   总计: ${files.length}`)
  console.log('')
  console.log(`📍 Storage 路径: ${BUCKET}/${TARGET_FOLDER}/`)
}

main().catch(console.error)

