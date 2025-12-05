const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://cvdogeigbpussfamctsu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZG9nZWlnYnB1c3NmYW1jdHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjU2MTIyNSwiZXhwIjoyMDcyMTM3MjI1fQ.B-QB4hVx0ZNjlPJfOu-3jMK2oJGpcunxxqzDZZyQeVw'
)

async function verify() {
  console.log('=== 验证棚拍资源上传 ===\n')
  
  // 检查 studio-models
  const { data: models } = await supabase.storage.from('presets').list('studio-models')
  console.log(`📁 studio-models/: ${models?.length || 0} 文件`)
  
  // 检查 studio-backgrounds 子文件夹
  const folders = ['light', 'solid', 'pattern']
  for (const f of folders) {
    const { data: files } = await supabase.storage.from('presets').list(`studio-backgrounds/${f}`)
    console.log(`📁 studio-backgrounds/${f}/: ${files?.length || 0} 文件`)
  }
  
  // 测试一个 URL
  console.log('\n=== 测试 URL ===')
  const { data: { publicUrl } } = supabase.storage.from('presets').getPublicUrl('studio-models/model-1.png')
  console.log('Model 1:', publicUrl)
  
  const { data: { publicUrl: bgUrl } } = supabase.storage.from('presets').getPublicUrl('studio-backgrounds/light/01.jpg')
  console.log('Light BG 1:', bgUrl)
}

verify()
