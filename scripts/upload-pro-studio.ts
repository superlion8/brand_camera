/**
 * 上传 pro_studio 背景图到 Supabase Storage
 * 
 * 使用方式:
 * 1. 确保已设置环境变量 (可以从 .env.local 加载)
 * 2. npx ts-node scripts/upload-pro-studio.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const BUCKET = 'presets'
const LOCAL_PATH = process.env.HOME + '/Desktop/org/pro_studio'
const REMOTE_FOLDER = 'pro_studio'

async function deleteAllInFolder(folder: string): Promise<number> {
  console.log(`\n🗑️  删除 ${BUCKET}/${folder} 下的所有文件...\n`)
  
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(folder)
  
  if (listError) {
    console.error('列出文件失败:', listError.message)
    return 0
  }
  
  if (!files || files.length === 0) {
    console.log('文件夹为空，无需删除')
    return 0
  }
  
  const filePaths = files.map(f => `${folder}/${f.name}`)
  console.log(`找到 ${filePaths.length} 个文件待删除`)
  
  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(filePaths)
  
  if (deleteError) {
    console.error('删除失败:', deleteError.message)
    return 0
  }
  
  console.log(`✅ 已删除 ${filePaths.length} 个文件`)
  return filePaths.length
}

async function uploadFile(localPath: string, remotePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    
    if (error) {
      console.error(`❌ ${remotePath}: ${error.message}`)
      return false
    }
    
    console.log(`✅ ${remotePath}`)
    return true
  } catch (err: any) {
    console.error(`❌ ${remotePath}: ${err.message}`)
    return false
  }
}

async function uploadAllFiles(): Promise<{ success: number; failed: number }> {
  console.log(`\n📤 上传 ${LOCAL_PATH} 到 ${BUCKET}/${REMOTE_FOLDER}...\n`)
  
  const files = fs.readdirSync(LOCAL_PATH)
    .filter(f => /\.jpg$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })
  
  console.log(`找到 ${files.length} 个 jpg 文件\n`)
  
  let success = 0
  let failed = 0
  
  for (const file of files) {
    const localPath = path.join(LOCAL_PATH, file)
    const remotePath = `${REMOTE_FOLDER}/${file}`
    
    const result = await uploadFile(localPath, remotePath)
    if (result) success++
    else failed++
  }
  
  return { success, failed }
}

async function main() {
  console.log('🚀 Pro Studio 背景图上传工具\n')
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log(`Bucket: ${BUCKET}`)
  console.log(`本地路径: ${LOCAL_PATH}`)
  console.log(`远程路径: ${REMOTE_FOLDER}`)
  
  // Step 1: 删除旧文件
  const deleted = await deleteAllInFolder(REMOTE_FOLDER)
  
  // Step 2: 上传新文件
  const { success, failed } = await uploadAllFiles()
  
  console.log('\n' + '='.repeat(50))
  console.log(`📊 结果: 删除 ${deleted} 个, 上传成功 ${success} 个, 失败 ${failed} 个`)
  console.log('='.repeat(50))
}

main().catch(console.error)

