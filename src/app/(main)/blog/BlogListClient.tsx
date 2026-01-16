'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock } from 'lucide-react'
import { useLanguageStore } from '@/stores/languageStore'
import type { BlogPostMeta } from '@/lib/mdx'

interface BlogCategory {
  id: string
  name: {
    en: string
    zh: string
    ko: string
  }
}

// Blog card component
function BlogCard({ post, language }: { post: BlogPostMeta; language: 'en' | 'zh' | 'ko' }) {
  const categoryLabels: Record<string, { en: string; zh: string; ko: string }> = {
    'tutorial': { en: 'Tutorial', zh: '教程', ko: '튜토리얼' },
    'case-study': { en: 'Case Study', zh: '案例研究', ko: '사례 연구' },
    'industry': { en: 'Industry', zh: '行业', ko: '산업' },
    'tips': { en: 'Tips', zh: '技巧', ko: '팁' },
  }

  return (
    <Link 
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
    >
      {/* Cover Image */}
      <div className="aspect-[16/9] bg-gradient-to-br from-orange-100 to-amber-50 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl opacity-30">📸</div>
        </div>
        {/* Category Badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-zinc-700">
            {categoryLabels[post.category]?.[language] || post.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
          {post.title}
        </h2>
        <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
          {post.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.publishedAt).toLocaleDateString(
              language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
              { year: 'numeric', month: 'short', day: 'numeric' }
            )}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readingTime} min
          </span>
        </div>
      </div>
    </Link>
  )
}

interface BlogListClientProps {
  posts: {
    en: BlogPostMeta[]
    zh: BlogPostMeta[]
    ko: BlogPostMeta[]
  }
  categories: BlogCategory[]
}

export function BlogListClient({ posts, categories }: BlogListClientProps) {
  const language = useLanguageStore((state) => state.language)
  const [selectedCategory, setSelectedCategory] = useState('all')

  const currentPosts = posts[language] || posts.en
  const filteredPosts = selectedCategory === 'all' 
    ? currentPosts 
    : currentPosts.filter(post => post.category === selectedCategory)

  const pageContent = {
    en: {
      title: 'Blog',
      subtitle: 'Insights, tutorials, and tips for e-commerce photography',
      empty: 'No posts in this category yet.',
    },
    zh: {
      title: '博客',
      subtitle: '电商摄影的洞察、教程和技巧',
      empty: '该分类下暂无文章。',
    },
    ko: {
      title: '블로그',
      subtitle: '이커머스 사진에 대한 인사이트, 튜토리얼 및 팁',
      empty: '이 카테고리에는 아직 게시물이 없습니다.',
    },
  }

  const t = pageContent[language]

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-white">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            {t.title}
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              {category.name[language]}
            </button>
          ))}
        </div>

        {/* Blog Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} language={language} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-zinc-400">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  )
}
