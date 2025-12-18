#!/usr/bin/env node
/**
 * 上传 brand_logo 文件夹到 Supabase Storage
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
const SOURCE_DIR = '/Users/a/Desktop/bcam_src/brand_logo'
const TARGET_FOLDER = 'brand_logos'

async function deleteFolder(folderPath) {
  console.log(`🗑️  清理文件夹: ${folderPath}`)
  
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

async function uploadFile(localPath, remotePath) {
  const fileBuffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  
  let contentType = 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') {
    contentType = 'image/jpeg'
  } else if (ext === '.svg') {
    contentType = 'image/svg+xml'
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
  console.log('🚀 上传 brand_logo 到 Supabase Storage...')
  console.log(`   源目录: ${SOURCE_DIR}`)
  console.log(`   目标路径: ${BUCKET}/${TARGET_FOLDER}`)
  console.log('')
  
  // 清理旧文件
  await deleteFolder(TARGET_FOLDER)
  
  // 读取源目录
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => {
      const ext = f.toLowerCase()
      return !f.startsWith('.') && 
        (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.svg'))
    })
    .sort()
  
  console.log(`📁 找到 ${files.length} 个 logo 文件`)
  console.log('')
  
  let successCount = 0
  let failCount = 0
  
  for (const file of files) {
    const localPath = path.join(SOURCE_DIR, file)
    // 清理文件名：去掉空格，转小写
    const cleanName = file.replace(/\s+/g, '_').toLowerCase()
    const remotePath = `${TARGET_FOLDER}/${cleanName}`
    
    process.stdout.write(`   上传 ${file}...`)
    
    const result = await uploadFile(localPath, remotePath)
    
    if (result.success) {
      successCount++
      console.log(' ✓')
    } else {
      failCount++
      console.log(` ✗ (${result.error})`)
    }
  }
  
  console.log('')
  console.log('═'.repeat(50))
  console.log(`✅ 上传完成!`)
  console.log(`   成功: ${successCount}`)
  console.log(`   失败: ${failCount}`)
  console.log(`   总计: ${files.length}`)
  console.log('')
  console.log(`📍 Storage 路径: ${BUCKET}/${TARGET_FOLDER}/`)
}

main().catch(console.error)

