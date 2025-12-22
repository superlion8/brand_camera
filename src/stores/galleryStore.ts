import { create } from 'zustand'

interface GalleryCache {
  items: any[]
  hasMore: boolean
  currentPage: number
  pendingTasks: any[]
  fetchedAt: number
}

interface GalleryStoreState {
  cache: Record<string, GalleryCache>
  isPreloading: boolean
  preloadedTabs: Set<string>
  
  // Actions
  setCache: (key: string, data: GalleryCache) => void
  getCache: (key: string) => GalleryCache | null
  updateCacheItems: (key: string, items: any[]) => void
  clearCache: (key?: string) => void
  setPreloading: (loading: boolean) => void
  markTabPreloaded: (key: string) => void
  isTabPreloaded: (key: string) => boolean
}

// 缓存有效期：5 分钟
const CACHE_TTL = 5 * 60 * 1000

export const useGalleryStore = create<GalleryStoreState>((set, get) => ({
  cache: {},
  isPreloading: false,
  preloadedTabs: new Set(),
  
  setCache: (key, data) => {
    set(state => ({
      cache: {
        ...state.cache,
        [key]: { ...data, fetchedAt: Date.now() }
      }
    }))
  },
  
  getCache: (key) => {
    const cache = get().cache[key]
    if (!cache) return null
    
    // 检查缓存是否过期
    if (Date.now() - cache.fetchedAt > CACHE_TTL) {
      console.log(`[GalleryStore] Cache expired for ${key}`)
      return null
    }
    
    return cache
  },
  
  updateCacheItems: (key, items) => {
    set(state => {
      const existing = state.cache[key]
      if (!existing) return state
      
      return {
        cache: {
          ...state.cache,
          [key]: { ...existing, items }
        }
      }
    })
  },
  
  clearCache: (key) => {
    if (key) {
      set(state => {
        const { [key]: _, ...rest } = state.cache
        return { cache: rest }
      })
    } else {
      set({ cache: {} })
    }
  },
  
  setPreloading: (loading) => {
    set({ isPreloading: loading })
  },
  
  markTabPreloaded: (key) => {
    set(state => ({
      preloadedTabs: new Set([...state.preloadedTabs, key])
    }))
  },
  
  isTabPreloaded: (key) => {
    return get().preloadedTabs.has(key)
  },
}))

// 生成缓存 key 的工具函数
export const getCacheKey = (tab: string, subType: string) => {
  return tab === 'model' ? `${tab}_${subType}` : tab
}

