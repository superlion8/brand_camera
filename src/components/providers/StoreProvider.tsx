"use client"

import { useEffect, useState, useRef } from "react"
import { initDB } from "@/lib/indexeddb"
import { useAssetStore } from "@/stores/assetStore"

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  // Use ref to prevent re-running when store updates
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    const init = async () => {
      try {
        // Initialize IndexedDB
        await initDB()
        // Load data from IndexedDB - only once at startup
        const store = useAssetStore.getState()
        await store.loadFromDB()
        setIsReady(true)
      } catch (error) {
        console.error("Failed to initialize store:", error)
        setIsReady(true) // Continue anyway
      }
    }
    
    init()
  }, []) // Empty dependency array - only run once
  
  // Show nothing or a loading state while initializing
  // Since we're using Zustand persist, the UI will handle its own loading
  return <>{children}</>
}

