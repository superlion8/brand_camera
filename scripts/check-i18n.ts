/**
 * 检测代码中未国际化的硬编码文本
 * 
 * 使用: npx ts-node scripts/check-i18n.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC_DIR = path.join(__dirname, '../src')

// 匹配中文字符（排除注释）
const CHINESE_REGEX = /[\u4e00-\u9fa5]+/g

// 忽略的文件/目录
const IGNORE_PATTERNS = [
  'locales/', // 翻译文件本身
  'node_modules/',
  '.next/',
  'prompts/', // AI prompts 可能需要中文
]

// 忽略的模式（这些通常是故意的）
const IGNORE_CONTEXTS = [
  /console\.(log|error|warn)/, // console 输出
  /\/\/.*[\u4e00-\u9fa5]/, // 单行注释
  /\/\*[\s\S]*?[\u4e00-\u9fa5][\s\S]*?\*\//, // 多行注释
  /\|\|.*['"`][\u4e00-\u9fa5]/, // fallback 文本 (|| '中文')
]

interface Issue {
  file: string
  line: number
  text: string
  context: string
}

const issues: Issue[] = []

function scanFile(filePath: string) {
  const relativePath = path.relative(SRC_DIR, filePath)
  
  // 跳过忽略的目录
  if (IGNORE_PATTERNS.some(p => relativePath.includes(p))) {
    return
  }
  
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  lines.forEach((line, index) => {
    // 跳过注释行
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return
    }
    
    // 跳过 fallback 模式
    if (IGNORE_CONTEXTS.some(pattern => pattern.test(line))) {
      return
    }
    
    const matches = line.match(CHINESE_REGEX)
    if (matches) {
      // 检查是否在 JSX 字符串中（可能是硬编码）
      const inJsxString = /[>}]\s*[\u4e00-\u9fa5]|['"`][\u4e00-\u9fa5]/.test(line)
      
      if (inJsxString) {
        issues.push({
          file: relativePath,
          line: index + 1,
          text: matches.join(', '),
          context: line.trim().substring(0, 100),
        })
      }
    }
  })
}

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    
    if (entry.isDirectory()) {
      if (!IGNORE_PATTERNS.some(p => entry.name.includes(p.replace('/', '')))) {
        scanDirectory(fullPath)
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      scanFile(fullPath)
    }
  }
}

console.log('🔍 扫描未国际化的中文文本...\n')
scanDirectory(SRC_DIR)

if (issues.length === 0) {
  console.log('✅ 没有发现硬编码的中文文本！')
} else {
  console.log(`⚠️  发现 ${issues.length} 处可能需要国际化的文本:\n`)
  
  // 按文件分组
  const byFile = issues.reduce((acc, issue) => {
    if (!acc[issue.file]) acc[issue.file] = []
    acc[issue.file].push(issue)
    return acc
  }, {} as Record<string, Issue[]>)
  
  for (const [file, fileIssues] of Object.entries(byFile)) {
    console.log(`📄 ${file}`)
    fileIssues.forEach(issue => {
      console.log(`   Line ${issue.line}: "${issue.text}"`)
      console.log(`   ${issue.context}\n`)
    })
  }
  
  console.log('\n💡 建议: 将这些文本替换为 t.xxx 翻译 key')
}
