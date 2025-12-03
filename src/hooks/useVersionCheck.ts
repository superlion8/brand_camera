"use client"

import { useEffect, useState, useCallback } from 'react'

const CHECK_INTERVAL = 60000 // Check every 60 seconds
const STORAGE_KEY = 'app_version'

export function useVersionCheck() {
  const [hasNewVersion, setHasNewVersion] = useState(false)
  
  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch('/api/version', { cache: 'no-store' })
      if (!response.ok) return
      
      const { version } = await response.json()
      const storedVersion = localStorage.getItem(STORAGE_KEY)
      
      if (!storedVersion) {
        // First visit, store current version
        localStorage.setItem(STORAGE_KEY, version)
      } else if (storedVersion !== version) {
        // New version available!
        console.log('[Version] New version detected:', version, 'current:', storedVersion)
        setHasNewVersion(true)
      }
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.warn('[Version] Check failed:', error)
    }
  }, [])
  
  const refresh = useCallback(() => {
    // Update stored version before refresh
    fetch('/api/version', { cache: 'no-store' })
      .then(res => res.json())
      .then(({ version }) => {
        localStorage.setItem(STORAGE_KEY, version)
        window.location.reload()
      })
      .catch(() => {
        window.location.reload()
      })
  }, [])
  
  const dismiss = useCallback(() => {
    setHasNewVersion(false)
    // Update stored version so we don't keep prompting
    fetch('/api/version', { cache: 'no-store' })
      .then(res => res.json())
      .then(({ version }) => {
        localStorage.setItem(STORAGE_KEY, version)
      })
      .catch(() => {})
  }, [])
  
  useEffect(() => {
    // Initial check after a short delay
    const initialTimer = setTimeout(checkVersion, 3000)
    
    // Periodic checks
    const interval = setInterval(checkVersion, CHECK_INTERVAL)
    
    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkVersion])
  
  return { hasNewVersion, refresh, dismiss }
}

