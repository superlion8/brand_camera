import { MetadataRoute } from 'next'
import { getAllBlogSlugs, getBlogPost } from '@/lib/mdx'

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
  // 博客 - SEO 重要页面
  { path: '/blog', changeFrequency: 'daily', priority: 0.85 },
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
  // 信息页面
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.5 },
  // 
  // 📌 新增公开页面请在此添加
  //
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  
  // Static pages
  const staticPages = PUBLIC_PAGES.map(page => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  // Blog posts - dynamically generated from MDX files
  const blogSlugs = getAllBlogSlugs()
  const blogPages = blogSlugs.map(slug => {
    const post = getBlogPost(slug, 'en')
    return {
      url: `${BASE_URL}/blog/${slug}`,
      lastModified: post ? new Date(post.publishedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }
  })

  return [...staticPages, ...blogPages]
}

// 导出公开页面路径供 SEO 检查脚本使用
export const PUBLIC_PAGE_PATHS = [
  ...PUBLIC_PAGES.map(p => p.path || '/'),
  ...getAllBlogSlugs().map(slug => `/blog/${slug}`),
]
