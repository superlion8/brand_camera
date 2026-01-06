'use client'

import { Search, Bell } from 'lucide-react'
import { QuotaIndicator } from '@/components/shared/QuotaIndicator'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { UserMenu } from '@/components/shared/UserMenu'
import { SyncIndicator } from '@/components/shared/SyncIndicator'
import { useTranslation } from '@/stores/languageStore'

export function TopNav({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <header className={`h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 ${className || ''}`}>
      {/* Left: Breadcrumb or Search */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder={t.common?.search || '搜索...'}
            className="w-64 h-9 pl-10 pr-4 bg-zinc-100 border-0 rounded-lg text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <SyncIndicator />
        <QuotaIndicator />
        
        {/* Notifications */}
        <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors relative">
          <Bell className="w-5 h-5 text-zinc-500" />
          {/* Notification badge */}
          {/* <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" /> */}
        </button>

        <div className="w-px h-6 bg-zinc-200 mx-1" />

        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  )
}



