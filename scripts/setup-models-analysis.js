#!/usr/bin/env node
/**
 * 创建 models_analysis 表并导入 CSV 数据
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

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

// 创建表的 SQL
const CREATE_TABLE_SQL = `
-- 删除已存在的表（如果有）
DROP TABLE IF EXISTS models_analysis CASCADE;

-- 创建 models_analysis 表
CREATE TABLE models_analysis (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(50) NOT NULL UNIQUE,
  model_gender VARCHAR(20),
  model_age_group VARCHAR(100),
  model_style VARCHAR(200),
  model_desc TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_models_analysis_model_id ON models_analysis(model_id);
CREATE INDEX idx_models_analysis_gender ON models_analysis(model_gender);
CREATE INDEX idx_models_analysis_style ON models_analysis(model_style);

-- 添加注释
COMMENT ON TABLE models_analysis IS '模特分析数据表';
COMMENT ON COLUMN models_analysis.model_id IS '模特ID，如 model2, model3';
COMMENT ON COLUMN models_analysis.model_gender IS '性别：male/female';
COMMENT ON COLUMN models_analysis.model_age_group IS '年龄段描述';
COMMENT ON COLUMN models_analysis.model_style IS '风格标签';
COMMENT ON COLUMN models_analysis.model_desc IS '详细描述';

-- 启用 RLS
ALTER TABLE models_analysis ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公开数据）
DROP POLICY IF EXISTS "models_analysis_read_all" ON models_analysis;
CREATE POLICY "models_analysis_read_all" ON models_analysis
  FOR SELECT
  USING (true);
`

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = parseCSVLine(lines[0])
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const values = parseCSVLine(line)
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

async function createTable() {
  console.log('📦 创建 models_analysis 表...')
  
  // 使用 Supabase 的 rpc 来执行 SQL
  // 由于 supabase-js 不直接支持原始 SQL，我们需要通过 REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({})
  })
  
  // 由于无法直接执行 DDL，我们先尝试插入数据
  // 如果表不存在，会报错，然后提示用户手动创建
  console.log('   注意: 请在 Supabase Dashboard 中运行以下 SQL:')
  console.log('')
  console.log('─'.repeat(60))
  console.log(CREATE_TABLE_SQL)
  console.log('─'.repeat(60))
  console.log('')
  
  return true
}

async function importData() {
  console.log('📥 导入 CSV 数据...')
  
  // 读取 CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const records = parseCSV(csvContent)
  
  console.log(`   解析到 ${records.length} 条记录`)
  
  // 准备数据
  const dataToInsert = records.map(r => ({
    model_id: r.model_id,
    model_gender: r.model_gender,
    model_age_group: r.model_age_group,
    model_style: r.model_style,
    model_desc: r.model_desc
  }))
  
  // 先尝试删除所有数据
  console.log('   清空现有数据...')
  await supabase.from('models_analysis').delete().neq('id', 0)
  
  // 分批插入
  const batchSize = 20
  let successCount = 0
  let failCount = 0
  
  for (let i = 0; i < dataToInsert.length; i += batchSize) {
    const batch = dataToInsert.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('models_analysis')
      .insert(batch)
      .select()
    
    if (error) {
      console.error(`   ❌ 批次 ${Math.floor(i/batchSize) + 1} 失败:`, error.message)
      failCount += batch.length
      
      // 如果是表不存在的错误，提前退出
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('')
        console.log('⚠️  表不存在，请先在 Supabase Dashboard SQL Editor 中执行上面的 SQL')
        return false
      }
    } else {
      successCount += batch.length
      console.log(`   ✓ 批次 ${Math.floor(i/batchSize) + 1}: ${batch.length} 条`)
    }
  }
  
  console.log('')
  console.log(`   导入结果: 成功 ${successCount}, 失败 ${failCount}`)
  
  return successCount > 0
}

async function main() {
  console.log('🚀 设置 models_analysis 表...')
  console.log('')
  
  await createTable()
  
  console.log('尝试导入数据（如果表已存在）...')
  console.log('')
  
  const success = await importData()
  
  if (success) {
    console.log('')
    console.log('═'.repeat(50))
    console.log('✅ 完成!')
  } else {
    console.log('')
    console.log('═'.repeat(50))
    console.log('⚠️  请先在 Supabase Dashboard 创建表，然后重新运行此脚本')
  }
}

main().catch(console.error)

