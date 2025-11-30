"use client"

import { useEffect, useState } from "react"
import { initDB } from "@/lib/indexeddb"
import { useAssetStore } from "@/stores/assetStore"

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const loadFromDB = useAssetStore((state) => state.loadFromDB)
  
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize IndexedDB
        await initDB()
        // Load data from IndexedDB
        await loadFromDB()
        setIsReady(true)
      } catch (error) {
        console.error("Failed to initialize store:", error)
        setIsReady(true) // Continue anyway
      }
    }
    
    init()
  }, [loadFromDB])
  
  // Show nothing or a loading state while initializing
  // Since we're using Zustand persist, the UI will handle its own loading
  return <>{children}</>
}

