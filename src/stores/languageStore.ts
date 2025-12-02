import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Language, translations, Translations } from '@/locales'

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'zh',
      t: translations.zh,
      
      setLanguage: (lang) => {
        set({
          language: lang,
          t: translations[lang],
        })
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        // Update translations based on persisted language
        if (state) {
          state.t = translations[state.language]
        }
      },
    }
  )
)

// Hook for easy access to translations
export function useTranslation() {
  const { t, language, setLanguage } = useLanguageStore()
  return { t, language, setLanguage }
}

