const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  'https://cvdogeigbpussfamctsu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZG9nZWlnYnB1c3NmYW1jdHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjU2MTIyNSwiZXhwIjoyMDcyMTM3MjI1fQ.B-QB4hVx0ZNjlPJfOu-3jMK2oJGpcunxxqzDZZyQeVw'
)

const BASE_PATH = process.env.HOME + '/Desktop/brand_cam资源/V2'

async function uploadFile(localPath, remotePath) {
  const fileBuffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
  
  const { error } = await supabase.storage
    .from('presets')
    .upload(remotePath, fileBuffer, {
      contentType,
      upsert: true,
    })
  
  if (error) {
    console.error(`❌ ${remotePath}:`, error.message)
    return false
  }
  console.log(`✅ ${remotePath}`)
  return true
}

async function uploadStudioModels() {
  console.log('\n📤 上传棚拍模特...\n')
  const modelPath = path.join(BASE_PATH, '棚拍模特')
  const files = fs.readdirSync(modelPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
  
  let i = 1
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const remotePath = `studio-models/model-${i}${ext}`
    await uploadFile(path.join(modelPath, file), remotePath)
    i++
  }
  console.log(`\n棚拍模特: ${i - 1} 个文件上传完成`)
}

async function uploadStudioBackgrounds() {
  console.log('\n📤 上传棚拍背景...\n')
  const bgPath = path.join(BASE_PATH, '棚拍背景')
  
  // 上传子文件夹
  const subFolders = ['打光背景', '纯色背景', '花色背景']
  
  for (const folder of subFolders) {
    const folderPath = path.join(bgPath, folder)
    if (!fs.existsSync(folderPath)) {
      console.log(`⚠️ 文件夹不存在: ${folder}`)
      continue
    }
    
    console.log(`\n  📁 ${folder}`)
    const files = fs.readdirSync(folderPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    
    for (const file of files) {
      const remotePath = `studio-backgrounds/${folder}/${file}`
      await uploadFile(path.join(folderPath, file), remotePath)
    }
  }
}

async function main() {
  console.log('🚀 开始上传棚拍资源到 Supabase Storage\n')
  console.log(`资源路径: ${BASE_PATH}`)
  
  await uploadStudioModels()
  await uploadStudioBackgrounds()
  
  console.log('\n' + '='.repeat(50))
  console.log('✅ 上传完成!')
  console.log('='.repeat(50))
}

main().catch(console.error)
