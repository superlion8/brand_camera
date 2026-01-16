import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getAllBlogSlugs, getBlogPost, getRecentBlogPosts } from '@/lib/mdx'
import { BlogPostClient } from './BlogPostClient'

// Static generation
export const dynamic = 'force-static'
export const revalidate = 3600

// Generate static paths for all blog posts
export async function generateStaticParams() {
  const slugs = getAllBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

// Generate metadata for SEO
export async function generateMetadata({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<Metadata> {
  const post = getBlogPost(params.slug, 'en')
  
  if (!post) {
    return {
      title: 'Post Not Found | BrandCam Blog',
    }
  }
  
  return {
    title: `${post.title} | BrandCam Blog`,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  // Get posts for all languages
  const postEn = getBlogPost(params.slug, 'en')
  const postZh = getBlogPost(params.slug, 'zh')
  const postKo = getBlogPost(params.slug, 'ko')
  
  if (!postEn) {
    notFound()
  }

  const relatedEn = getRecentBlogPosts(3, 'en').filter(p => p.slug !== params.slug).slice(0, 2)
  const relatedZh = getRecentBlogPosts(3, 'zh').filter(p => p.slug !== params.slug).slice(0, 2)
  const relatedKo = getRecentBlogPosts(3, 'ko').filter(p => p.slug !== params.slug).slice(0, 2)
  
  // Prepare all language versions
  const posts = {
    en: postEn,
    zh: postZh || postEn,
    ko: postKo || postEn,
  }
  
  const related = {
    en: relatedEn,
    zh: relatedZh,
    ko: relatedKo,
  }
  
  return (
    <BlogPostClient 
      posts={posts}
      related={related}
      slug={params.slug}
    />
  )
}
