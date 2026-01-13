"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, Loader2, Images, ChevronDown, Users, Lightbulb, Grid3X3, Palette, Sparkles, Heart } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useAuth } from "@/components/providers/AuthProvider"
import { useTranslation } from "@/stores/languageStore"
import { useGalleryStore, getCacheKey } from "@/stores/galleryStore"

interface GalleryItem {
  id: string
  imageUrl: string
  generation?: {
    type?: string
  }
}

type TabType = 'all' | 'model' | 'product' | 'group' | 'reference' | 'brand' | 'favorites'

interface GalleryPickerPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (imageUrl: string) => void
  isLoading?: boolean
  themeColor?: 'purple' | 'amber' | 'blue'
  title?: string
  defaultTab?: TabType
  showTabs?: boolean
  emptyAction?: {
    label: string
    href: string
  }
}

const themeClasses = {
  purple: {
    accentHover: 'hover:border-purple-500',
    button: 'bg-purple-500 hover:bg-purple-600',
    spinner: 'text-purple-500',
  },
  amber: {
    accentHover: 'hover:border-amber-500',
    button: 'bg-amber-500 hover:bg-amber-600',
    spinner: 'text-amber-500',
  },
  blue: {
    accentHover: 'hover:border-blue-500',
    button: 'bg-blue-500 hover:bg-blue-600',
    spinner: 'text-blue-500',
  },
}


export function GalleryPickerPanel({
  open,
  onClose,
  onSelect,
  isLoading: externalLoading = false,
  themeColor = 'purple',
  title,
  defaultTab = 'all',
  showTabs = true,
  emptyAction,
}: GalleryPickerPanelProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { isDesktop } = useIsDesktop()
  const { getCache, setCache } = useGalleryStore()
  
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [photos, setPhotos] = useState<GalleryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const theme = themeClasses[themeColor]
  const displayTitle = title || t.edit?.selectFromGallery || 'From Photos'
  const defaultEmptyAction = emptyAction || {
    label: t.edit?.goShoot || 'Go Shoot',
    href: '/buyer-show',
  }
  
  // Tabs configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: t.gallery?.all || 'All', icon: null },
    { id: 'model', label: t.gallery?.model || 'Model', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'product', label: t.gallery?.product || 'Product', icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'group', label: t.gallery?.groupShoot || 'Group', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { id: 'reference', label: t.gallery?.referenceShot || 'Reference', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'brand', label: t.gallery?.brand || 'Brand', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'favorites', label: t.gallery?.favorites || 'Favorites', icon: <Heart className="w-3.5 h-3.5" /> },
  ]
  
  // Fetch gallery photos (with cache support)
  const fetchPhotos = useCallback(async (tab: TabType, pageNum: number, append: boolean = false) => {
    const key = getCacheKey(tab, '')
    
    // Try to use cache for first page
    if (pageNum === 1 && !append) {
      const cached = getCache(key)
      if (cached && cached.items.length > 0) {
        console.log('[GalleryPickerPanel] Using cached data for', key)
        setPhotos(cached.items)
        setHasMore(cached.hasMore)
        setPage(cached.currentPage)
        return
      }
    }
    
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    
    try {
      const response = await fetch(`/api/gallery?type=${tab}&page=${pageNum}`)
      const result = await response.json()
      
      if (result.success && result.data?.items) {
        const newItems = append 
          ? [...photos, ...result.data.items]
          : result.data.items
        
        setPhotos(newItems)
        setHasMore(result.data.hasMore || false)
        setPage(pageNum)
        
        // Update cache
        setCache(key, {
          items: newItems,
          hasMore: result.data.hasMore || false,
          currentPage: pageNum,
          pendingTasks: [],
          fetchedAt: Date.now(),
        })
      }
    } catch (error) {
      console.error('[GalleryPickerPanel] Failed to fetch:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [getCache, setCache, photos])

  // Load data when panel opens or tab changes
  useEffect(() => {
    if (open && user) {
      fetchPhotos(activeTab, 1, false)
    }
  }, [open, user, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setPhotos([])
    setPage(1)
  }

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchPhotos(activeTab, page + 1, true)
    }
  }

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }

  const loading = isLoading || externalLoading

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={isDesktop 
              ? "fixed inset-0 m-auto w-[700px] h-fit max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              : "fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            }
          >
            {/* Header */}
            <div className="shrink-0">
              <div className={`${isDesktop ? 'h-14 px-6' : 'h-12 px-4'} border-b flex items-center justify-between`}>
                <span className={`font-semibold ${isDesktop ? 'text-lg' : ''}`}>{displayTitle}</span>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
                </button>
              </div>
              
              {/* Category Tabs */}
              {showTabs && (
                <div className={`${isDesktop ? 'px-6 py-3' : 'px-4 py-2'} border-b bg-white flex gap-2 overflow-x-auto hide-scrollbar`}>
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-1.5 ${isDesktop ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'} font-medium rounded-full transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
              {/* Loading skeleton */}
              {loading ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                  {Array.from({ length: isDesktop ? 20 : 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-zinc-200 animate-pulse"
                    />
                  ))}
                </div>
              ) : photos.length > 0 ? (
                <div className="space-y-4">
                  <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    {photos.filter(item => item?.imageUrl).map((item, index) => (
                      <button
                        key={item.id || `gallery-${index}`}
                        disabled={externalLoading}
                        onClick={() => handleSelect(item.imageUrl)}
                        className={`aspect-square rounded-xl overflow-hidden relative border-2 border-transparent ${theme.accentHover} transition-all bg-white disabled:opacity-50`}
                      >
                        <Image 
                          src={item.imageUrl} 
                          alt={`${t.edit?.generationResult || 'Result'} ${index + 1}`} 
                          fill 
                          className="object-cover" 
                        />
                      </button>
                    ))}
                  </div>
                  
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="px-6 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t.common?.loading || 'Loading...'}</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>{t.common?.loadMore || 'Load More'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
                  <Images className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">{t.edit?.noGallery || 'No photos yet'}</p>
                  <p className="text-xs mt-1">{t.studio?.goShootToGenerate || 'Generate some photos first'}</p>
                  <button
                    onClick={() => {
                      onClose()
                      router.push(defaultEmptyAction.href)
                    }}
                    className={`mt-4 px-4 py-2 ${theme.button} text-white text-sm rounded-lg`}
                  >
                    {defaultEmptyAction.label}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
