'use client'

import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, User, Tag, Twitter, Facebook, Linkedin } from 'lucide-react'
import { useLanguageStore } from '@/stores/languageStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BlogPost, BlogPostMeta } from '@/lib/mdx'

// Related post card
function RelatedPostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link 
      href={`/blog/${post.slug}`}
      className="group block p-4 bg-white rounded-xl border border-zinc-100 hover:border-orange-200 hover:shadow-md transition-all"
    >
      <h4 className="font-medium text-zinc-900 mb-1 line-clamp-2 group-hover:text-orange-600 transition-colors">
        {post.title}
      </h4>
      <p className="text-sm text-zinc-500 line-clamp-2">
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
        className="p-2 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-500 transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </a>
      <a
        href={shareData.facebook}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-600 transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
      </a>
      <a
        href={shareData.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-700 transition-colors"
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
  'industry': { en: 'Industry', zh: '行业', ko: '산업' },
  'tips': { en: 'Tips', zh: '技巧', ko: '팁' },
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
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-white">
      <article className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Back Link */}
        <Link 
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-orange-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.backToBlog}
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="mb-4">
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              {categoryLabels[post.category]?.[language] || post.category}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 mb-6">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString(
                language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {post.readingTime} {t.readingTime}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{t.share}:</span>
            <ShareButtons title={post.title} slug={slug} />
          </div>
        </header>

        {/* Cover Image */}
        <div className="aspect-[2/1] bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl overflow-hidden mb-10 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl opacity-20">📸</div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-zinc prose-lg max-w-none
          prose-headings:font-bold prose-headings:text-zinc-900
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-zinc-600 prose-p:leading-relaxed
          prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-zinc-800
          prose-ul:text-zinc-600 prose-ol:text-zinc-600
          prose-li:marker:text-orange-400
          prose-blockquote:border-orange-400 prose-blockquote:bg-orange-50/50 prose-blockquote:py-1 prose-blockquote:rounded-r-lg
          prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-zinc-900 prose-pre:text-zinc-100
          prose-table:text-sm
          prose-th:bg-zinc-100 prose-th:font-semibold
          prose-td:border-zinc-200
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        <div className="mt-10 pt-8 border-t border-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 mr-2">{t.tags}:</span>
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
                className="text-sm text-orange-600 hover:text-orange-700 transition-colors"
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
