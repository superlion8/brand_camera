const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://cvdogeigbpussfamctsu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZG9nZWlnYnB1c3NmYW1jdHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjU2MTIyNSwiZXhwIjoyMDcyMTM3MjI1fQ.B-QB4hVx0ZNjlPJfOu-3jMK2oJGpcunxxqzDZZyQeVw'
)

async function listStorage() {
  console.log('=== Listing presets bucket ===\n')
  
  // List root folders
  const { data: rootFolders, error: rootError } = await supabase.storage
    .from('presets')
    .list('', { limit: 100 })
  
  if (rootError) {
    console.error('Error listing root:', rootError)
    return
  }
  
  console.log('Root folders/files:')
  rootFolders.forEach(f => console.log('  -', f.name, f.id ? '(file)' : '(folder)'))
  console.log('')
  
  // List each folder
  for (const folder of rootFolders) {
    if (folder.id) { // Skip files, only process folders
      continue
    }
    
    console.log(`\n📁 ${folder.name}/`)
    
    const { data: subItems, error: subError } = await supabase.storage
      .from('presets')
      .list(folder.name, { limit: 200 })
    
    if (subError) {
      console.error(`  Error:`, subError.message)
      continue
    }
    
    // Check if there are subfolders
    const subFolders = subItems.filter(item => !item.id)
    const files = subItems.filter(item => item.id)
    
    if (subFolders.length > 0) {
      for (const sf of subFolders) {
        const { data: sfFiles } = await supabase.storage
          .from('presets')
          .list(`${folder.name}/${sf.name}`, { limit: 200 })
        console.log(`  📁 ${sf.name}/ (${sfFiles?.length || 0} files)`)
      }
    }
    
    if (files.length > 0) {
      console.log(`  📄 ${files.length} files`)
      if (files.length <= 5) {
        files.forEach(f => console.log(`     - ${f.name}`))
      } else {
        files.slice(0, 3).forEach(f => console.log(`     - ${f.name}`))
        console.log(`     ... and ${files.length - 3} more`)
      }
    }
  }
}

listStorage().catch(console.error)
