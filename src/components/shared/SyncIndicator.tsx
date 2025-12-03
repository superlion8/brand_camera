"use client"

import Image from "next/image"
import { useAuth } from "@/components/providers/AuthProvider"
import { useAssetStore } from "@/stores/assetStore"

// This component shows syncing status in the header bar
// Only visible when actively syncing - displays animated logo
export function SyncIndicator() {
  const { isSyncing: authSyncing } = useAuth()
  const storeSyncing = useAssetStore(state => state.isSyncing)
  
  const isSyncing = authSyncing || storeSyncing
  
  if (!isSyncing) {
    return null
  }
  
  return (
    <div className="relative w-6 h-6">
      <Image 
        src="/logo.png" 
        alt="Syncing" 
        width={24} 
        height={24} 
        className="rounded animate-pulse"
      />
      <div className="absolute inset-0 rounded bg-blue-400/30 animate-ping" />
    </div>
  )
}

