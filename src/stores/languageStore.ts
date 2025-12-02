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
      onRehydrateStorage: () => (state) => {
        // Update translations based on persisted language
        if (state) {
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

