/**
 * 严格模式：检测代码中未国际化的硬编码文本
 * 
 * 使用:
 *   npm run check-i18n:strict      # 只警告
 *   npm run check-i18n:strict --ci # CI 模式，发现问题退出码 1
 * 
 * 重点检测：用户可见的 UI 文本
 * 忽略：admin 页面、错误消息、调试信息、注释
 */

import * as fs from 'fs'
import * as path from 'path'

const SRC_DIR = path.join(__dirname, '../src')
const IS_CI_MODE = process.argv.includes('--ci')

// 匹配中文字符
const CHINESE_REGEX = /[\u4e00-\u9fa5]+/g

// 完全忽略的文件/目录（不检测）
const IGNORE_PATHS = [
  'locales/',           // 翻译文件本身
  'prompts/',           // AI prompts 需要中文
  'admin/',             // 管理员页面暂不国际化
  'node_modules/',
  '.next/',
]

// 允许的中文上下文模式（不报错）
const ALLOWED_PATTERNS = [
  /console\.(log|error|warn|info|debug)\s*\(/,  // console 输出
  /^\s*\/\//,                                    // 单行注释
  /^\s*\*/,                                      // 多行注释行
  /^\s*{\s*\/\*/,                               // JSX 注释
  /\|\|\s*['"`]/,                               // fallback 默认值
  /\?\s*['"`][^'"`]*['"`]\s*:/,                 // 三元运算符
  /throw new Error\(/,                          // 抛出错误
  /new Error\(/,                                // Error 构造
  /\.error\s*=/,                                // error 赋值
  /setError(Message)?\(/,                       // setError 调用
  /alert\(/,                                    // alert（应该用 toast，但暂时忽略）
  /return\s*{\s*.*error:/,                      // return { error: }
  /errorMsg\s*=/,                               // 错误消息变量
  /placeholder[:=]/i,                           // placeholder
  /alt[:=]/i,                                   // alt 属性（可选）
  /title[:=]/i,                                 // title 属性
  /label[:=]\s*['"`]/,                          // label 属性（常量定义）
  /const\s+\w+.*:\s*{[^}]*label/,              // 对象定义中的 label
  /name:\s*[`'"]/,                              // name 属性
  /case\s+['"`]/,                               // switch case
  /id:\s*['"`]/,                                // id 属性
  /\.find\(.*===\s*['"`]/,                      // array.find 比较
  /type\s+\w+.*=.*['"`]/,                       // type 定义
  /interface\s+/,                               // interface 定义
  /zh:\s*{/,                                    // 语言对象 zh: {}
  /zh:\s*['"`]/,                                // zh: '...'
  /\.zh\b/,                                     // .zh 属性
  /['"`]zh['"`]/,                               // 'zh' 字符串
  /CATEGORY_MAP/i,                              // category 映射常量
  /ProductCategory/,                            // 产品分类类型
  /debugMode\s*&&/,                             // 调试模式条件渲染
  /text-\[10px\]/,                              // 10px 小字体通常是调试信息
  /text-\[8px\]/,                               // 8px 小字体通常是调试标签
  /text-xs text-zinc-4/,                        // 小字体灰色通常是调试/提示文本
  /text-\[\d+px\].*text-zinc/,                 // 任何小字体灰色文本
]

// 允许包含中文的特定文件（白名单）
const WHITELIST_FILES = [
  'LanguageSwitcher.tsx',  // 语言切换器需要显示语言名称
  'UserMenu.tsx',          // 用户菜单语言选项
]

interface Issue {
  file: string
  line: number
  column: number
  text: string
  context: string
  severity: 'error' | 'warning'
}

const issues: Issue[] = []

function shouldIgnoreLine(line: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line))
}

function shouldIgnoreFile(relativePath: string): boolean {
  return WHITELIST_FILES.some(f => relativePath.endsWith(f))
}

function scanFile(filePath: string) {
  const relativePath = path.relative(SRC_DIR, filePath)
  
  // 跳过忽略的目录
  if (IGNORE_PATHS.some(p => relativePath.includes(p))) {
    return
  }
  
  // 跳过白名单文件
  if (shouldIgnoreFile(relativePath)) {
    return
  }
  
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  // 跟踪是否在 debugMode 区块中
  let debugModeDepth = 0
  
  lines.forEach((line, lineIndex) => {
    // 跟踪 debugMode 区块
    if (/debugMode\s*&&/.test(line) || /\{debugMode\s*\?/.test(line)) {
      debugModeDepth++
    }
    // 简单的括号计数（检测区块结束）
    const openBraces = (line.match(/\{/g) || []).length
    const closeBraces = (line.match(/\}/g) || []).length
    if (debugModeDepth > 0 && closeBraces > openBraces) {
      debugModeDepth = Math.max(0, debugModeDepth - 1)
    }
    
    // 在 debugMode 区块中，跳过检测
    if (debugModeDepth > 0) {
      return
    }
    
    // 跳过允许的模式
    if (shouldIgnoreLine(line)) {
      return
    }
    
    // 检测中文
    let match
    const regex = new RegExp(CHINESE_REGEX.source, 'g')
    
    while ((match = regex.exec(line)) !== null) {
      const chineseText = match[0]
      const column = match.index
      
      // 检查是否已经使用了 t. 翻译
      const hasTranslation = /\bt\./.test(line)
      if (hasTranslation) continue
      
      // 检查上下文：是否在 JSX 文本或字符串字面量中（用户可见）
      const beforeMatch = line.substring(0, column)
      const afterMatch = line.substring(column + chineseText.length)
      
      // 重点检测：JSX 内容和按钮文本
      const isInJsxText = />\s*$/.test(beforeMatch) && /^\s*</.test(afterMatch)
      const isButtonText = /<button[^>]*>\s*$/.test(beforeMatch.toLowerCase())
      const isSpanText = /<span[^>]*>\s*$/.test(beforeMatch.toLowerCase())
      const isDirectInJsx = /[>}]\s*$/.test(beforeMatch) && !beforeMatch.includes('//')
      
      // 判断严重程度：按钮/span 中的文本是严重问题
      const isHighPriority = isButtonText || isSpanText || isInJsxText
      
      if (isDirectInJsx || isHighPriority) {
        issues.push({
          file: relativePath,
          line: lineIndex + 1,
          column: column + 1,
          text: chineseText,
          context: line.trim().substring(0, 120),
          severity: isHighPriority ? 'error' : 'warning',
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
      const dirName = entry.name
      if (!['node_modules', '.next', '.git'].includes(dirName)) {
        scanDirectory(fullPath)
      }
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      scanFile(fullPath)
    }
  }
}

// 主程序
console.log('🔍 [i18n Check] Scanning for hardcoded Chinese text...\n')
console.log(`   Mode: ${IS_CI_MODE ? 'CI (strict)' : 'Development (warning only)'}\n`)

scanDirectory(SRC_DIR)

// 过滤高优先级问题
const errors = issues.filter(i => i.severity === 'error')
const warnings = issues.filter(i => i.severity === 'warning')

if (issues.length === 0) {
  console.log('✅ No hardcoded Chinese text found in user-facing UI!\n')
  process.exit(0)
} else {
  // 输出严重问题
  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} HIGH PRIORITY issue(s) - must fix:\n`)
    
    const byFile = errors.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = []
      acc[issue.file].push(issue)
      return acc
    }, {} as Record<string, Issue[]>)
    
    for (const [file, fileIssues] of Object.entries(byFile)) {
      console.error(`\n📄 ${file}`)
      fileIssues.forEach(issue => {
        console.error(`   Line ${issue.line}:${issue.column} - "${issue.text}"`)
        console.error(`   > ${issue.context}`)
      })
    }
  }
  
  // 输出警告
  if (warnings.length > 0) {
    console.warn(`\n⚠️  Found ${warnings.length} warning(s) - consider fixing:\n`)
    
    // 只显示前 10 个警告
    const showWarnings = warnings.slice(0, 10)
    showWarnings.forEach(issue => {
      console.warn(`   ${issue.file}:${issue.line} - "${issue.text}"`)
    })
    if (warnings.length > 10) {
      console.warn(`   ... and ${warnings.length - 10} more warnings`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('💡 How to fix:')
  console.log('   1. Add translation key to src/locales/zh.ts')
  console.log('   2. Add English translation to src/locales/en.ts')
  console.log('   3. Add Korean translation to src/locales/ko.ts')
  console.log('   4. Replace hardcoded text with {t.xxx.yyy}')
  console.log('')
  console.log('Example:')
  console.log('   ❌ <button>去修图</button>')
  console.log('   ✅ <button>{t.gallery?.goEdit || "Edit"}</button>')
  console.log('='.repeat(60) + '\n')
  
  // CI 模式下，有严重问题则退出码 1
  if (IS_CI_MODE && errors.length > 0) {
    console.error(`\n🚫 CI mode: Build blocked due to ${errors.length} i18n error(s)\n`)
    process.exit(1)
  }
  
  // 开发模式只警告
  console.log(`\n📝 Summary: ${errors.length} errors, ${warnings.length} warnings\n`)
  process.exit(0)
}
