import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

// Types
export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  category: 'tutorial' | 'case-study' | 'industry' | 'tips'
  tags: string[]
  author: string
  publishedAt: string
  coverImage: string
  readingTime: number
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

// Paths
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

// Get all blog slugs
export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }
  
  return fs.readdirSync(BLOG_DIR).filter((file) => {
    const filePath = path.join(BLOG_DIR, file)
    return fs.statSync(filePath).isDirectory()
  })
}

// Get blog post by slug and language
export function getBlogPost(slug: string, lang: 'en' | 'zh' | 'ko' = 'en'): BlogPost | null {
  const filePath = path.join(BLOG_DIR, slug, `${lang}.mdx`)
  
  // Fallback to English if language file doesn't exist
  const fallbackPath = path.join(BLOG_DIR, slug, 'en.mdx')
  const actualPath = fs.existsSync(filePath) ? filePath : fallbackPath
  
  if (!fs.existsSync(actualPath)) {
    return null
  }
  
  const fileContents = fs.readFileSync(actualPath, 'utf8')
  const { data, content } = matter(fileContents)
  const stats = readingTime(content)
  
  return {
    slug,
    title: data.title || '',
    description: data.description || '',
    category: data.category || 'tutorial',
    tags: data.tags || [],
    author: data.author || 'BrandCam Team',
    publishedAt: data.publishedAt || new Date().toISOString(),
    coverImage: data.coverImage || '',
    readingTime: Math.ceil(stats.minutes),
    content,
  }
}

// Get all blog posts metadata (for listing)
export function getAllBlogPosts(lang: 'en' | 'zh' | 'ko' = 'en'): BlogPostMeta[] {
  const slugs = getAllBlogSlugs()
  
  const posts = slugs
    .map((slug) => {
      const post = getBlogPost(slug, lang)
      if (!post) return null
      
      // Return only metadata, not content
      const { content, ...meta } = post
      return meta
    })
    .filter((post): post is BlogPostMeta => post !== null)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  
  return posts
}

// Get posts by category
export function getBlogPostsByCategory(
  category: string,
  lang: 'en' | 'zh' | 'ko' = 'en'
): BlogPostMeta[] {
  const posts = getAllBlogPosts(lang)
  
  if (category === 'all') {
    return posts
  }
  
  return posts.filter((post) => post.category === category)
}

// Get recent posts
export function getRecentBlogPosts(
  count: number = 3,
  lang: 'en' | 'zh' | 'ko' = 'en'
): BlogPostMeta[] {
  return getAllBlogPosts(lang).slice(0, count)
}

// Blog categories with translations
export const blogCategories = [
  {
    id: 'all',
    name: { en: 'All', zh: '全部', ko: '전체' },
  },
  {
    id: 'tutorial',
    name: { en: 'Tutorials', zh: '教程', ko: '튜토리얼' },
  },
  {
    id: 'case-study',
    name: { en: 'Case Studies', zh: '案例研究', ko: '사례 연구' },
  },
  {
    id: 'industry',
    name: { en: 'Industry Insights', zh: '行业洞察', ko: '산업 인사이트' },
  },
  {
    id: 'tips',
    name: { en: 'Tips & Tricks', zh: '技巧分享', ko: '팁과 노하우' },
  },
]
