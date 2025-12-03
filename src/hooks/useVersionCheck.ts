"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'

const CHECK_INTERVAL = 60000 // Check every 60 seconds
const STORAGE_KEY = 'app_version'
const NEW_VERSION_KEY = 'app_has_new_version'

export function useVersionCheck() {
  const [hasNewVersion, setHasNewVersion] = useState(false)
  const pathname = usePathname()
  const isFirstRender = useRef(true)
  const previousPathname = useRef(pathname)
  
  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch('/api/version', { cache: 'no-store' })
      if (!response.ok) return
      
      const { version } = await response.json()
      const storedVersion = localStorage.getItem(STORAGE_KEY)
      
      if (!storedVersion) {
        // First visit, store current version
        localStorage.setItem(STORAGE_KEY, version)
        localStorage.removeItem(NEW_VERSION_KEY)
      } else if (storedVersion !== version) {
        // New version available!
        console.log('[Version] New version detected:', version, 'current:', storedVersion)
        setHasNewVersion(true)
        // Store flag so we know to refresh on next navigation
        localStorage.setItem(NEW_VERSION_KEY, 'true')
      }
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.warn('[Version] Check failed:', error)
    }
  }, [])
  
  // Auto-refresh on route change when new version is available
  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousPathname.current = pathname
      return
    }
    
    // Check if route actually changed
    if (previousPathname.current === pathname) {
      return
    }
    
    previousPathname.current = pathname
    
    // Check if we have a new version (from state or localStorage)
    const hasNewVersionFlag = hasNewVersion || localStorage.getItem(NEW_VERSION_KEY) === 'true'
    
    if (hasNewVersionFlag) {
      console.log('[Version] Route changed, refreshing to new version...')
      // Update stored version before refresh
      fetch('/api/version', { cache: 'no-store' })
        .then(res => res.json())
        .then(({ version }) => {
          localStorage.setItem(STORAGE_KEY, version)
          localStorage.removeItem(NEW_VERSION_KEY)
          // Use replace to avoid back button issues
          window.location.replace(window.location.href)
        })
        .catch(() => {
          localStorage.removeItem(NEW_VERSION_KEY)
          window.location.reload()
        })
    }
  }, [pathname, hasNewVersion])
  
  useEffect(() => {
    // Check on mount if there's a pending new version flag
    if (localStorage.getItem(NEW_VERSION_KEY) === 'true') {
      setHasNewVersion(true)
    }
    
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
  
  // Return empty object - no more manual UI needed
  return { hasNewVersion }
}
