"use client"

import { useEffect } from "react"
import { useQuota } from "@/hooks/useQuota"
import { useAuth } from "@/components/providers/AuthProvider"
import { Sparkles } from "lucide-react"

export function QuotaIndicator() {
  const { user } = useAuth()
  const { quota, isLoading, refreshQuota } = useQuota()

  // Refresh quota on mount
  useEffect(() => {
    if (user) {
      refreshQuota()
    }
  }, [user, refreshQuota])

  if (!user || isLoading || !quota) {
    return null
  }

  const isLow = quota.remainingQuota <= 5
  const isExhausted = quota.remainingQuota <= 0

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
      isExhausted 
        ? 'bg-red-100 text-red-700' 
        : isLow 
          ? 'bg-amber-100 text-amber-700'
          : 'bg-blue-50 text-blue-700'
    }`}>
      <Sparkles className="w-3 h-3" />
      <span>{quota.remainingQuota}</span>
    </div>
  )
}

