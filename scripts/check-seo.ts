/**
 * SEO 检查脚本
 * 
 * 使用:
 *   npm run check-seo        # 只警告
 *   npm run check-seo --ci   # CI 模式，发现问题退出码 1
 * 
 * 检测内容:
 *   1. 公开页面是否在 sitemap 中
 *   2. 公开页面是否有 metadata
 *   3. robots.txt 配置一致性
 *   4. JSON-LD 结构化数据
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT_DIR = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT_DIR, 'src')
const APP_DIR = path.join(SRC_DIR, 'app')
const IS_CI_MODE = process.argv.includes('--ci')

interface Issue {
  type: 'error' | 'warning'
  category: string
  message: string
  file?: string
}

const issues: Issue[] = []

// ========== 配置 ==========

// 公开页面（应该在 sitemap 中）
const PUBLIC_PAGES = ['/', '/login', '/pricing']

// 需要屏蔽的路径前缀（应该在 robots.txt Disallow 中）
const PRIVATE_PATH_PREFIXES = [
  '/app',
  '/gallery',
  '/camera',
  '/studio',
  '/product-shot',
  '/pro-studio',
  '/lifestyle',
  '/brand-style',
  '/edit',
  '/buyer-show',
  '/model-create',
  '/try-on',
  '/reference-shot',
  '/group-shot',
  '/social',
  '/brand-assets',
  '/payment',
  '/admin',
  '/api',
]

// ========== 检查函数 ==========

function checkSitemap() {
  console.log('\n📍 检查 Sitemap...')
  
  const sitemapPath = path.join(APP_DIR, 'sitemap.ts')
  
  if (!fs.existsSync(sitemapPath)) {
    issues.push({
      type: 'error',
      category: 'Sitemap',
      message: '缺少 sitemap.ts 文件',
      file: 'src/app/sitemap.ts',
    })
    return
  }
  
  const content = fs.readFileSync(sitemapPath, 'utf-8')
  
  // 检查公开页面是否在 sitemap 中
  for (const page of PUBLIC_PAGES) {
    const pagePath = page === '/' ? "path: ''" : `path: '${page}'`
    const altPath = page === '/' ? 'path: ""' : `path: "${page}"`
    
    if (!content.includes(pagePath) && !content.includes(altPath)) {
      issues.push({
        type: 'warning',
        category: 'Sitemap',
        message: `公开页面 ${page} 未在 sitemap.ts 中配置`,
        file: 'src/app/sitemap.ts',
      })
    }
  }
  
  console.log('  ✓ sitemap.ts 存在')
}

function checkRobotsTxt() {
  console.log('\n🤖 检查 robots.txt...')
  
  const robotsPath = path.join(ROOT_DIR, 'public', 'robots.txt')
  
  if (!fs.existsSync(robotsPath)) {
    issues.push({
      type: 'error',
      category: 'Robots',
      message: '缺少 robots.txt 文件',
      file: 'public/robots.txt',
    })
    return
  }
  
  const content = fs.readFileSync(robotsPath, 'utf-8')
  
  // 检查 Sitemap 引用
  if (!content.includes('Sitemap:')) {
    issues.push({
      type: 'warning',
      category: 'Robots',
      message: 'robots.txt 中缺少 Sitemap 引用',
      file: 'public/robots.txt',
    })
  }
  
  // 检查私有路径是否被 Disallow
  for (const prefix of PRIVATE_PATH_PREFIXES) {
    if (!content.includes(`Disallow: ${prefix}`)) {
      issues.push({
        type: 'warning',
        category: 'Robots',
        message: `私有路径 ${prefix} 未在 robots.txt 中 Disallow`,
        file: 'public/robots.txt',
      })
    }
  }
  
  console.log('  ✓ robots.txt 存在')
}

function checkMetadata() {
  console.log('\n📝 检查页面 Metadata...')
  
  // 检查根布局
  const rootLayoutPath = path.join(APP_DIR, 'layout.tsx')
  if (fs.existsSync(rootLayoutPath)) {
    const content = fs.readFileSync(rootLayoutPath, 'utf-8')
    
    if (!content.includes('metadataBase')) {
      issues.push({
        type: 'warning',
        category: 'Metadata',
        message: '根布局缺少 metadataBase 配置',
        file: 'src/app/layout.tsx',
      })
    }
    
    if (!content.includes('openGraph')) {
      issues.push({
        type: 'warning',
        category: 'Metadata',
        message: '根布局缺少 openGraph 配置',
        file: 'src/app/layout.tsx',
      })
    }
  }
  
  // 检查公开页面是否有 metadata
  const pageMetadataChecks = [
    { path: 'login', files: ['layout.tsx', 'page.tsx'] },
    { path: '(main)/pricing', files: ['layout.tsx', 'page.tsx'] },
  ]
  
  for (const check of pageMetadataChecks) {
    const pageDir = path.join(APP_DIR, check.path)
    if (!fs.existsSync(pageDir)) continue
    
    let hasMetadata = false
    for (const file of check.files) {
      const filePath = path.join(pageDir, file)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        if (content.includes('export const metadata') || content.includes('export function generateMetadata')) {
          hasMetadata = true
          break
        }
      }
    }
    
    if (!hasMetadata) {
      issues.push({
        type: 'warning',
        category: 'Metadata',
        message: `页面 /${check.path.replace('(main)/', '')} 缺少 metadata 配置`,
        file: `src/app/${check.path}/`,
      })
    }
  }
  
  console.log('  ✓ Metadata 检查完成')
}

function checkJsonLd() {
  console.log('\n🔗 检查 JSON-LD 结构化数据...')
  
  const jsonLdPath = path.join(SRC_DIR, 'components', 'seo', 'JsonLd.tsx')
  
  if (!fs.existsSync(jsonLdPath)) {
    issues.push({
      type: 'warning',
      category: 'JSON-LD',
      message: '缺少 JSON-LD 组件',
      file: 'src/components/seo/JsonLd.tsx',
    })
    return
  }
  
  // 检查首页是否使用了 JSON-LD
  const landingPagePath = path.join(APP_DIR, 'page.tsx')
  if (fs.existsSync(landingPagePath)) {
    const content = fs.readFileSync(landingPagePath, 'utf-8')
    if (!content.includes('JsonLd') && !content.includes('LandingPageJsonLd')) {
      issues.push({
        type: 'warning',
        category: 'JSON-LD',
        message: '首页未使用 JSON-LD 结构化数据',
        file: 'src/app/page.tsx',
      })
    }
  }
  
  console.log('  ✓ JSON-LD 检查完成')
}

function checkOgImage() {
  console.log('\n🖼️ 检查 OG Image...')
  
  const ogImagePath = path.join(APP_DIR, 'opengraph-image.tsx')
  const staticOgPath = path.join(ROOT_DIR, 'public', 'og-image.png')
  
  if (!fs.existsSync(ogImagePath) && !fs.existsSync(staticOgPath)) {
    issues.push({
      type: 'warning',
      category: 'OG Image',
      message: '缺少 OG Image（opengraph-image.tsx 或 public/og-image.png）',
    })
    return
  }
  
  console.log('  ✓ OG Image 存在')
}

// ========== 主函数 ==========

function main() {
  console.log('🔍 Brand Camera SEO 检查')
  console.log('='.repeat(50))
  
  checkSitemap()
  checkRobotsTxt()
  checkMetadata()
  checkJsonLd()
  checkOgImage()
  
  // 输出结果
  console.log('\n' + '='.repeat(50))
  
  const errors = issues.filter(i => i.type === 'error')
  const warnings = issues.filter(i => i.type === 'warning')
  
  if (issues.length === 0) {
    console.log('\n✅ SEO 检查通过！没有发现问题。\n')
    process.exit(0)
  }
  
  if (errors.length > 0) {
    console.log('\n❌ 错误:')
    for (const issue of errors) {
      console.log(`   [${issue.category}] ${issue.message}`)
      if (issue.file) console.log(`      文件: ${issue.file}`)
    }
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告:')
    for (const issue of warnings) {
      console.log(`   [${issue.category}] ${issue.message}`)
      if (issue.file) console.log(`      文件: ${issue.file}`)
    }
  }
  
  console.log(`\n📊 总计: ${errors.length} 个错误, ${warnings.length} 个警告\n`)
  
  if (IS_CI_MODE && errors.length > 0) {
    console.log('❌ CI 模式：发现错误，构建失败\n')
    process.exit(1)
  }
  
  process.exit(0)
}

main()
