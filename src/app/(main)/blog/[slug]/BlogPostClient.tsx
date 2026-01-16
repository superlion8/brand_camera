'use client'

import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, User, Tag, Twitter, Facebook, Linkedin, BookOpen } from 'lucide-react'
import { useLanguageStore } from '@/stores/languageStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BlogPost, BlogPostMeta } from '@/lib/mdx'

// Related post card
function RelatedPostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link 
      href={`/blog/${post.slug}`}
      className="group block p-5 bg-white rounded-xl border border-zinc-200 hover:border-orange-300 hover:shadow-lg transition-all"
    >
      <h4 className="font-semibold text-zinc-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
        {post.title}
      </h4>
      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
        {post.description}
      </p>
    </Link>
  )
}

// Share buttons
function ShareButtons({ title, slug }: { title: string; slug: string }) {
  const url = `https://brandcam.agency/blog/${slug}`
  
  const shareData = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={shareData.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-zinc-100 hover:bg-sky-100 hover:text-sky-500 transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </a>
      <a
        href={shareData.facebook}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-600 transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
      </a>
      <a
        href={shareData.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2.5 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-700 transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
      </a>
    </div>
  )
}

interface BlogPostClientProps {
  posts: {
    en: BlogPost
    zh: BlogPost
    ko: BlogPost
  }
  related: {
    en: BlogPostMeta[]
    zh: BlogPostMeta[]
    ko: BlogPostMeta[]
  }
  slug: string
}

const categoryLabels: Record<string, { en: string; zh: string; ko: string }> = {
  'tutorial': { en: 'Tutorial', zh: '教程', ko: '튜토리얼' },
  'case-study': { en: 'Case Study', zh: '案例研究', ko: '사례 연구' },
  'industry': { en: 'Industry', zh: '行业洞察', ko: '산업' },
  'tips': { en: 'Tips & Tricks', zh: '实用技巧', ko: '팁' },
}

const uiText = {
  en: { backToBlog: 'Back to Blog', readingTime: 'min read', share: 'Share', relatedPosts: 'Related Posts', viewAll: 'View All Posts', tags: 'Tags' },
  zh: { backToBlog: '返回博客', readingTime: '分钟阅读', share: '分享', relatedPosts: '相关文章', viewAll: '查看所有文章', tags: '标签' },
  ko: { backToBlog: '블로그로 돌아가기', readingTime: '분 읽기', share: '공유', relatedPosts: '관련 글', viewAll: '모든 글 보기', tags: '태그' },
}

export function BlogPostClient({ posts, related, slug }: BlogPostClientProps) {
  const language = useLanguageStore((state) => state.language)
  
  const post = posts[language] || posts.en
  const relatedPosts = related[language] || related.en
  const t = uiText[language]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-zinc-50 to-white border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-6 pt-8 pb-12">
          {/* Back Link */}
          <Link 
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-orange-600 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToBlog}
          </Link>

          {/* Category Badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              <BookOpen className="w-3.5 h-3.5" />
              {categoryLabels[post.category]?.[language] || post.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-6 leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-zinc-600 mb-8 leading-relaxed">
            {post.description}
          </p>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-400" />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              {new Date(post.publishedAt).toLocaleDateString(
                language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              {post.readingTime} {t.readingTime}
            </span>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Markdown Content */}
        <div className="prose prose-zinc prose-lg max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-zinc-200
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-zinc-600 prose-p:leading-[1.8]
          prose-a:text-orange-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
          prose-strong:text-zinc-800 prose-strong:font-semibold
          prose-ul:my-4 prose-ol:my-4
          prose-li:text-zinc-600 prose-li:leading-[1.8]
          prose-li:marker:text-orange-400
          prose-blockquote:border-l-4 prose-blockquote:border-orange-400 prose-blockquote:bg-orange-50 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
          prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-zinc-900 prose-pre:rounded-xl prose-pre:shadow-lg
          prose-table:my-6 prose-table:overflow-hidden prose-table:rounded-lg prose-table:border prose-table:border-zinc-200
          prose-th:bg-zinc-100 prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-3
          prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-zinc-200
          prose-hr:my-10 prose-hr:border-zinc-200
          prose-img:rounded-xl prose-img:shadow-md
        ">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom link component to handle internal/external links
              a: ({ href, children }) => {
                const isExternal = href?.startsWith('http')
                return (
                  <a 
                    href={href} 
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                  >
                    {children}
                  </a>
                )
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Share Section */}
        <div className="mt-12 pt-8 border-t border-zinc-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-700">{t.share}:</span>
              <ShareButtons title={post.title} slug={slug} />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-8 pt-8 border-t border-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-700 mr-2">{t.tags}:</span>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-sm hover:bg-zinc-200 transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12 pt-8 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-900">{t.relatedPosts}</h3>
              <Link 
                href="/blog"
                className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
              >
                {t.viewAll} →
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {relatedPosts.map((relatedPost) => (
                <RelatedPostCard 
                  key={relatedPost.slug} 
                  post={relatedPost} 
                />
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
