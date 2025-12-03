"use client"

import { useAuth } from "@/components/providers/AuthProvider"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { RefreshCw } from "lucide-react"

// This component shows syncing status in the header bar
// Only visible when actively syncing
export function SyncIndicator() {
  const { isSyncing: authSyncing } = useAuth()
  const storeSyncing = useAssetStore(state => state.isSyncing)
  const { t } = useTranslation()
  
  const isSyncing = authSyncing || storeSyncing
  
  if (!isSyncing) {
    return null
  }
  
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-600 text-xs font-medium">
      <RefreshCw className="w-3 h-3 animate-spin" />
      <span>{t.user.syncing}</span>
    </div>
  )
}

