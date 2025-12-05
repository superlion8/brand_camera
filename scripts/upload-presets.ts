/**
 * 上传棚拍资源到 Supabase Storage
 * 运行方式: npx ts-node scripts/upload-presets.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Supabase 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// 资源路径
const BASE_PATH = process.env.HOME + '/Desktop/brand_cam资源/V2'
const BUCKET = 'presets'

interface UploadTask {
  localPath: string
  remotePath: string
}

async function uploadFile(localPath: string, remotePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(localPath)
    const contentType = localPath.endsWith('.png') ? 'image/png' : 'image/jpeg'
    
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, fileBuffer, {
        contentType,
        upsert: true, // 覆盖已存在的文件
      })
    
    if (error) {
      console.error(`❌ 上传失败: ${remotePath}`, error.message)
      return false
    }
    
    console.log(`✅ ${remotePath}`)
    return true
  } catch (err: any) {
    console.error(`❌ 上传失败: ${remotePath}`, err.message)
    return false
  }
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<UploadTask[]> {
  const tasks: UploadTask[] = []
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    if (file.startsWith('.')) continue // 跳过隐藏文件
    
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      const subTasks = await getAllFiles(fullPath, baseDir)
      tasks.push(...subTasks)
    } else if (/\.(png|jpg|jpeg)$/i.test(file)) {
      const relativePath = path.relative(baseDir, fullPath)
      tasks.push({
        localPath: fullPath,
        remotePath: relativePath.replace(/\\/g, '/'), // Windows 兼容
      })
    }
  }
  
  return tasks
}

async function uploadStudioBackgrounds() {
  console.log('\n📸 上传棚拍背景...\n')
  
  const bgPath = path.join(BASE_PATH, '棚拍背景')
  const tasks = await getAllFiles(bgPath)
  
  let success = 0
  let failed = 0
  
  for (const task of tasks) {
    // 上传到 studio-backgrounds 文件夹
    const remotePath = `studio-backgrounds/${task.remotePath}`
    const result = await uploadFile(task.localPath, remotePath)
    if (result) success++
    else failed++
  }
  
  console.log(`\n棚拍背景: 成功 ${success}, 失败 ${failed}`)
  return { success, failed }
}

async function uploadStudioModels() {
  console.log('\n👤 上传棚拍模特...\n')
  
  const modelPath = path.join(BASE_PATH, '棚拍模特')
  const tasks = await getAllFiles(modelPath)
  
  let success = 0
  let failed = 0
  
  for (const task of tasks) {
    // 上传到 studio-models 文件夹
    const remotePath = `studio-models/${task.remotePath}`
    const result = await uploadFile(task.localPath, remotePath)
    if (result) success++
    else failed++
  }
  
  console.log(`\n棚拍模特: 成功 ${success}, 失败 ${failed}`)
  return { success, failed }
}

async function main() {
  console.log('🚀 开始上传棚拍资源到 Supabase Storage\n')
  console.log(`Bucket: ${BUCKET}`)
  console.log(`资源路径: ${BASE_PATH}\n`)
  
  const bg = await uploadStudioBackgrounds()
  const model = await uploadStudioModels()
  
  console.log('\n' + '='.repeat(50))
  console.log(`📊 总计: 成功 ${bg.success + model.success}, 失败 ${bg.failed + model.failed}`)
  console.log('='.repeat(50))
}

main().catch(console.error)
