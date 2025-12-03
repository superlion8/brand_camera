"use client"

import { useAuth } from "@/components/providers/AuthProvider"
import { useAssetStore } from "@/stores/assetStore"
import { RefreshCw } from "lucide-react"

// This component shows syncing status in the header bar
// Only visible when actively syncing - displays spinning circle icon
export function SyncIndicator() {
  const { isSyncing: authSyncing } = useAuth()
  const storeSyncing = useAssetStore(state => state.isSyncing)
  
  const isSyncing = authSyncing || storeSyncing
  
  if (!isSyncing) {
    return null
  }
  
  return (
    <div className="w-6 h-6 flex items-center justify-center">
      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
    </div>
  )
}

