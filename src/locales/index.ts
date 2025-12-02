import { zh, Translations } from './zh'
import { en } from './en'
import { ko } from './ko'

export type Language = 'zh' | 'en' | 'ko'

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
]

export const translations: Record<Language, Translations> = {
  zh,
  en,
  ko,
}

export type { Translations }

