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

async function uploadStudioBackgrounds() {
  console.log('\n📤 上传棚拍背景 (英文路径)...\n')
  const bgPath = path.join(BASE_PATH, '棚拍背景')
  
  // 中文 -> 英文映射
  const folderMap = {
    '打光背景': 'light',
    '纯色背景': 'solid',
    '花色背景': 'pattern'
  }
  
  for (const [cnFolder, enFolder] of Object.entries(folderMap)) {
    const folderPath = path.join(bgPath, cnFolder)
    if (!fs.existsSync(folderPath)) {
      console.log(`⚠️ 文件夹不存在: ${cnFolder}`)
      continue
    }
    
    console.log(`\n  📁 ${cnFolder} -> studio-backgrounds/${enFolder}/`)
    const files = fs.readdirSync(folderPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    
    let count = 0
    for (const file of files) {
      const remotePath = `studio-backgrounds/${enFolder}/${file}`
      const success = await uploadFile(path.join(folderPath, file), remotePath)
      if (success) count++
    }
    console.log(`  → ${count}/${files.length} 文件上传成功`)
  }
}

async function main() {
  console.log('🚀 上传棚拍背景到 Supabase Storage\n')
  await uploadStudioBackgrounds()
  console.log('\n✅ 完成!')
}

main().catch(console.error)
