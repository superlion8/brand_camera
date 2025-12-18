#!/usr/bin/env node
/**
 * 从 CSV 导入数据到 models_analysis 表
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

const CSV_PATH = '/Users/a/Desktop/bcam_src/V4-tags/models_analysis.csv'

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = parseCSVLine(lines[0])
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length >= headers.length) {
      const record = {}
      headers.forEach((header, idx) => {
        record[header] = values[idx] || ''
      })
      records.push(record)
    }
  }
  
  return records
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

async function main() {
  console.log('🚀 导入 models_analysis CSV 数据...')
  console.log(`   CSV 文件: ${CSV_PATH}`)
  console.log('')
  
  // 读取 CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const records = parseCSV(csvContent)
  
  console.log(`📊 解析到 ${records.length} 条记录`)
  console.log('')
  
  // 先清空表
  console.log('🗑️  清空现有数据...')
  const { error: deleteError } = await supabase
    .from('models_analysis')
    .delete()
    .neq('id', 0) // 删除所有记录
  
  if (deleteError) {
    console.log(`   注意: ${deleteError.message}`)
  }
  
  // 批量插入
  console.log('📥 插入新数据...')
  
  const dataToInsert = records.map(r => ({
    model_id: r.model_id,
    model_gender: r.model_gender,
    model_age_group: r.model_age_group,
    model_style: r.model_style,
    model_desc: r.model_desc
  }))
  
  // 分批插入，每批 50 条
  const batchSize = 50
  let successCount = 0
  
  for (let i = 0; i < dataToInsert.length; i += batchSize) {
    const batch = dataToInsert.slice(i, i + batchSize)
    
    const { error } = await supabase
      .from('models_analysis')
      .upsert(batch, { 
        onConflict: 'model_id',
        ignoreDuplicates: false 
      })
    
    if (error) {
      console.error(`   ❌ 批次 ${Math.floor(i/batchSize) + 1} 插入失败:`, error.message)
    } else {
      successCount += batch.length
      console.log(`   ✓ 批次 ${Math.floor(i/batchSize) + 1}: 插入 ${batch.length} 条`)
    }
  }
  
  console.log('')
  console.log('═'.repeat(50))
  console.log(`✅ 导入完成!`)
  console.log(`   成功: ${successCount}/${records.length}`)
}

main().catch(console.error)

