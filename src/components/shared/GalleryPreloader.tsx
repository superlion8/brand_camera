'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useGalleryStore, getCacheKey } from '@/stores/galleryStore'

// 预加载的 tab 配置
const PRELOAD_TABS = [
  { tab: 'all', subType: '' },
  { tab: 'model', subType: 'buyer' },
  { tab: 'model', subType: 'prostudio' },
  { tab: 'product', subType: '' },
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
      console.log('[GalleryPreloader] Starting silent preload...')
      
      for (const { tab, subType } of PRELOAD_TABS) {
        const cacheKey = getCacheKey(tab, subType)
        
        // 跳过已预加载的 tab
        if (isTabPreloaded(cacheKey)) {
          console.log(`[GalleryPreloader] ${cacheKey} already preloaded, skipping`)
          continue
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
        
        // 间隔 200ms，避免同时发起太多请求
        await new Promise(r => setTimeout(r, 200))
      }
      
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

