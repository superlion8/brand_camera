import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Language, translations, Translations } from '@/locales'

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
}

// 根据浏览器语言自动检测默认语言
function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  
  const browserLang = navigator.language.toLowerCase()
  
  if (browserLang.startsWith('ko')) return 'ko'  // 韩语
  if (browserLang.startsWith('zh')) return 'zh'  // 中文
  return 'en'  // 默认英语
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'zh',
      t: translations.zh,
      _hasHydrated: false,
      
      setLanguage: (lang) => {
        set({
          language: lang,
          t: translations[lang],
        })
      },
      
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state, error) => {
        if (state) {
          // 检查 localStorage 中是否已有保存的语言
          const savedLang = localStorage.getItem('language-storage')
          const hasSavedLanguage = savedLang && JSON.parse(savedLang)?.state?.language
          
          // 如果用户没有手动选择过，根据浏览器语言自动检测
          if (!hasSavedLanguage) {
            const detectedLang = detectBrowserLanguage()
            state.language = detectedLang
            console.log('[Language] Auto-detected from browser:', detectedLang)
          }
          
          state.t = translations[state.language]
          state._hasHydrated = true
        }
      },
    }
  )
)

// Hook for easy access to translations - always returns valid translations
export function useTranslation() {
  const store = useLanguageStore()
  // Always return zh translations as fallback during hydration
  return { 
    t: store.t || translations.zh, 
    language: store.language || 'zh', 
    setLanguage: store.setLanguage 
  }
}

