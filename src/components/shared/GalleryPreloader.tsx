'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useGalleryStore, getCacheKey } from '@/stores/galleryStore'

// 预加载的 tab 配置（包含所有 tab）
const PRELOAD_TABS = [
  { tab: 'all', subType: '' },
  { tab: 'model', subType: 'buyer' },
  { tab: 'model', subType: 'prostudio' },
  { tab: 'model', subType: 'lifestyle' },
  { tab: 'product', subType: '' },
  { tab: 'group', subType: '' },
  { tab: 'reference', subType: '' },
  { tab: 'brand', subType: '' },
  { tab: 'favorites', subType: '' },
]

export function GalleryPreloader() {
  const { user } = useAuth()
  const { setCache, isPreloading, setPreloading, markTabPreloaded, isTabPreloaded } = useGalleryStore()
  const hasStartedRef = useRef(false)
  
  useEffect(() => {
    // 用户登录后开始预加载
    if (!user || hasStartedRef.current || isPreloading) return
    
    hasStartedRef.current = true
    
    const preloadGalleryData = async () => {
      setPreloading(true)
      console.log('[GalleryPreloader] Starting parallel preload...')
      
      // 并行预加载所有 tab
      const preloadPromises = PRELOAD_TABS.map(async ({ tab, subType }) => {
        const cacheKey = getCacheKey(tab, subType)
        
        // 跳过已预加载的 tab
        if (isTabPreloaded(cacheKey)) {
          console.log(`[GalleryPreloader] ${cacheKey} already preloaded, skipping`)
          return
        }
        
        try {
          const response = await fetch(`/api/gallery?type=${tab}&page=1&subType=${subType}`, {
            cache: 'no-store',
          })
          const result = await response.json()
          
          if (result.success) {
            setCache(cacheKey, {
              items: result.data.items,
              hasMore: result.data.hasMore,
              currentPage: 1,
              pendingTasks: result.data.pendingTasks || [],
              fetchedAt: Date.now(),
            })
            markTabPreloaded(cacheKey)
            console.log(`[GalleryPreloader] Preloaded ${cacheKey}: ${result.data.items.length} items`)
          }
        } catch (error) {
          console.error(`[GalleryPreloader] Failed to preload ${cacheKey}:`, error)
        }
      })
      
      await Promise.allSettled(preloadPromises)
      
      setPreloading(false)
      console.log('[GalleryPreloader] Preload complete')
    }
    
    // 延迟 1 秒开始预加载，让主页先加载完
    const timer = setTimeout(preloadGalleryData, 1000)
    
    return () => clearTimeout(timer)
  }, [user, isPreloading, setPreloading, setCache, markTabPreloaded, isTabPreloaded])
  
  // 不渲染任何 UI
  return null
}

