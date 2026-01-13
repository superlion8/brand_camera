'use client'

import { useState, useEffect } from 'react'

const CACHE_KEY = 'screen_is_mobile'

/**
 * Get cached screen state from localStorage
 */
function getCachedIsMobile(breakpoint: number): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { value, bp } = JSON.parse(cached)
      // Only use cache if breakpoint matches
      if (bp === breakpoint) return value
    }
  } catch {
    // Ignore errors
  }
  return null
}

/**
 * Cache screen state to localStorage
 */
function setCachedIsMobile(value: boolean, breakpoint: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ value, bp: breakpoint }))
  } catch {
    // Ignore errors
  }
}

/**
 * Hook to detect if the current device is mobile
 * Uses localStorage cache to avoid flash on page load
 * @param breakpoint - The breakpoint in pixels (default: 768)
 */
export function useIsMobile(breakpoint: number = 768): boolean | null {
  // Try to use cached value for initial state to avoid flash
  const [isMobile, setIsMobile] = useState<boolean | null>(() => getCachedIsMobile(breakpoint))

  useEffect(() => {
    // Check actual value
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const actualValue = mql.matches
    
    // Update state and cache
    setIsMobile(actualValue)
    setCachedIsMobile(actualValue, breakpoint)

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      setCachedIsMobile(e.matches, breakpoint)
    }
    mql.addEventListener('change', handler)
    
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}

/**
 * Hook to detect if the current device is desktop
 * Returns { isDesktop, isLoading } to properly handle SSR
 * @param breakpoint - The breakpoint in pixels (default: 1024)
 */
export function useIsDesktop(breakpoint: number = 1024) {
  const isMobile = useIsMobile(breakpoint)
  
  return {
    isDesktop: isMobile === false,
    isLoading: isMobile === null,
    isMobile: isMobile === true,
  }
}

/**
 * Hook to detect screen size category
 */
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop' | 'large' | null>(null)

  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize('mobile')
      } else if (width < 1024) {
        setScreenSize('tablet')
      } else if (width < 1536) {
        setScreenSize('desktop')
      } else {
        setScreenSize('large')
      }
    }

    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  return screenSize
}



