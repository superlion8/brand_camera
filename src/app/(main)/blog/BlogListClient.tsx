'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
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

const categoryColors: Record<string, string> = {
  'tutorial': 'bg-blue-100 text-blue-700',
  'case-study': 'bg-purple-100 text-purple-700',
  'industry': 'bg-green-100 text-green-700',
  'tips': 'bg-orange-100 text-orange-700',
}

const categoryLabels: Record<string, { en: string; zh: string; ko: string }> = {
  'tutorial': { en: 'Tutorial', zh: '教程', ko: '튜토리얼' },
  'case-study': { en: 'Case Study', zh: '案例', ko: '사례' },
  'industry': { en: 'Industry', zh: '行业', ko: '산업' },
  'tips': { en: 'Tips', zh: '技巧', ko: '팁' },
}

// Blog card component
function BlogCard({ post, language }: { post: BlogPostMeta; language: 'en' | 'zh' | 'ko' }) {
  return (
    <Link 
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl hover:border-orange-200 hover:-translate-y-1 transition-all duration-300"
    >
      {/* Content */}
      <div className="p-6">
        {/* Category Badge */}
        <div className="mb-4">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[post.category] || 'bg-zinc-100 text-zinc-700'}`}>
            {categoryLabels[post.category]?.[language] || post.category}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-zinc-900 mb-3 line-clamp-2 group-hover:text-orange-600 transition-colors leading-snug">
          {post.title}
        </h2>

        {/* Description */}
        <p className="text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
          {post.description}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.publishedAt).toLocaleDateString(
                language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
                { month: 'short', day: 'numeric' }
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {post.readingTime} min
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
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
      subtitle: '电商摄影的洞察、教程和技巧分享',
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
    <div className="min-h-screen bg-zinc-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-4 tracking-tight">
            {t.title}
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-zinc-900 text-white shadow-lg'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400'
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
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  )
}
