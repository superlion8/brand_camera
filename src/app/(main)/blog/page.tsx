import Link from 'next/link'
import { Calendar, Clock } from 'lucide-react'
import { getAllBlogPosts, blogCategories, type BlogPostMeta } from '@/lib/mdx'
import { BlogListClient } from './BlogListClient'

// Static generation - fetch posts at build time
export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour

// Pre-fetch all posts for all languages
async function getBlogData() {
  const postsEn = getAllBlogPosts('en')
  const postsZh = getAllBlogPosts('zh')
  const postsKo = getAllBlogPosts('ko')
  
  return {
    en: postsEn,
    zh: postsZh,
    ko: postsKo,
  }
}

export default async function BlogListPage() {
  const posts = await getBlogData()
  
  return (
    <BlogListClient 
      posts={posts} 
      categories={blogCategories} 
    />
  )
}
