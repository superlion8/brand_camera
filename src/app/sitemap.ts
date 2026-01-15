import { MetadataRoute } from 'next'

// Base URL for the site
const BASE_URL = 'https://brandcam.agency'

/**
 * 公开页面配置 - SEO Sitemap
 * 
 * 📌 维护说明：
 * - 新增公开页面时，添加到 PUBLIC_PAGES 数组
 * - 需要登录的页面不要添加（会在 robots.txt 中屏蔽）
 * - changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
 * - priority: 0.0 - 1.0 (1.0 最高)
 */
const PUBLIC_PAGES: Array<{
  path: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}> = [
  // 首页 - 最高优先级
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  // 登录页
  { path: '/login', changeFrequency: 'monthly', priority: 0.8 },
  // 定价页
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
  // 功能页面 - 公开可预览，操作时登录
  { path: '/product-shot', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/pro-studio', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/lifestyle', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/camera', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/edit', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/try-on', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/group-shot', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/reference-shot', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/social', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/buyer-show', changeFrequency: 'weekly', priority: 0.8 },
  // 
  // 📌 新增公开页面请在此添加：
  // { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  // { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
  //
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  
  return PUBLIC_PAGES.map(page => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
}

// 导出公开页面路径供 SEO 检查脚本使用
export const PUBLIC_PAGE_PATHS = PUBLIC_PAGES.map(p => p.path || '/')
