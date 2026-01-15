'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const BASE_URL = 'https://brandcam.agency'

const SUPPORTED_LANGUAGES = [
  { code: 'en', hreflang: 'en' },
  { code: 'zh', hreflang: 'zh-CN' },
  { code: 'ko', hreflang: 'ko-KR' },
]

/**
 * 动态添加 hreflang 标签
 * 
 * 作用：
 * - 告诉搜索引擎页面支持多语言
 * - 避免重复内容惩罚
 * - 帮助用户找到正确语言版本
 */
export function HrefLangTags() {
  const pathname = usePathname()

  useEffect(() => {
    // 移除已存在的 hreflang 标签
    const existingTags = document.querySelectorAll('link[rel="alternate"][hreflang]')
    existingTags.forEach(tag => tag.remove())

    // 添加新的 hreflang 标签
    const head = document.head

    // 添加各语言版本
    SUPPORTED_LANGUAGES.forEach(lang => {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = lang.hreflang
      link.href = `${BASE_URL}${pathname}`
      head.appendChild(link)
    })

    // 添加 x-default（默认版本）
    const defaultLink = document.createElement('link')
    defaultLink.rel = 'alternate'
    defaultLink.hreflang = 'x-default'
    defaultLink.href = `${BASE_URL}${pathname}`
    head.appendChild(defaultLink)

  }, [pathname])

  return null
}
