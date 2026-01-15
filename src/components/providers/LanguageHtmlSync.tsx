'use client'

import { useEffect } from 'react'
import { useLanguageStore } from '@/stores/languageStore'

/**
 * 同步 HTML lang 属性与用户语言设置
 * 
 * 作用：
 * - SEO: 搜索引擎正确识别页面语言
 * - 屏幕阅读器: 正确的语音朗读
 * - 浏览器翻译: 避免错误的翻译提示
 */
export function LanguageHtmlSync() {
  const language = useLanguageStore((state) => state.language)
  const hasHydrated = useLanguageStore((state) => state._hasHydrated)

  useEffect(() => {
    if (!hasHydrated) return

    // 映射语言代码到 BCP 47 标准
    const langMap: Record<string, string> = {
      'zh': 'zh-CN',
      'en': 'en-US',
      'ko': 'ko-KR',
    }

    const htmlLang = langMap[language] || 'en-US'
    document.documentElement.lang = htmlLang

    // 同时更新 dir 属性（虽然当前支持的语言都是 LTR）
    document.documentElement.dir = 'ltr'

  }, [language, hasHydrated])

  return null
}
