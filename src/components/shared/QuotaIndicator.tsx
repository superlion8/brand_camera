"use client"

import { useEffect, useRef } from "react"
import { useQuota } from "@/hooks/useQuota"
import { useAuth } from "@/components/providers/AuthProvider"
import { Coins, Crown } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/stores/languageStore"

export function QuotaIndicator() {
  const { user } = useAuth()
  const { quota, isLoading, refreshQuota } = useQuota()
  const hasRefreshed = useRef(false)
  const { t } = useTranslation()

  // Refresh quota only once per session, then use cached value
  useEffect(() => {
    if (user && !hasRefreshed.current) {
      hasRefreshed.current = true
      // Refresh in background, don't block UI
      refreshQuota()
    }
  }, [user, refreshQuota])

  // Show cached value immediately, don't wait for loading
  if (!user) {
    return null
  }

  // Show placeholder while first load
  if (!quota && isLoading) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-400">
        <Coins className="w-3 h-3" />
        <span>--</span>
      </div>
    )
  }

  if (!quota) {
    return null
  }

  const isLow = quota.remainingQuota <= 5
  const isExhausted = quota.remainingQuota <= 0

  return (
    <Link href="/pricing" className="flex items-center gap-2">
      {/* Credits Display */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
        isExhausted 
          ? 'bg-red-100 text-red-700' 
          : isLow 
            ? 'bg-amber-100 text-amber-700'
            : 'bg-amber-50 text-amber-600'
      }`}>
        <Coins className="w-3.5 h-3.5" />
        <span>{t.quota?.creditsLeft || 'Credits Left'}:</span>
        <span>{quota.remainingQuota}</span>
      </div>
      
      {/* Upgrade Button */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm">
        <Crown className="w-3.5 h-3.5" />
        <span>{t.quota?.upgrade || 'Upgrade'}</span>
      </div>
    </Link>
  )
}
