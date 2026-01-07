'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current device is mobile
 * Returns null during SSR to avoid hydration mismatch
 * @param breakpoint - The breakpoint in pixels (default: 768)
 */
export function useIsMobile(breakpoint: number = 768): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    // Check initial value
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mql.matches)

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
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



