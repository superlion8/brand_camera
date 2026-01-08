"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Download, Heart, X, Wand2, Camera, Users, Home, ZoomIn, Loader2, Lightbulb, RefreshCw, Trash2, Package, FolderPlus, ChevronDown, Check, Grid3X3, Palette, Sparkles } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { useGenerationTaskStore, GenerationTask, ImageSlot } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useTranslation } from "@/stores/languageStore"
import { Generation, Favorite, Asset } from "@/types"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { generateId } from "@/lib/utils"
import { 
  isModelRelatedType, 
  isModelType as isBuyerShowTypeRaw,
  isProStudioType as isProStudioTypeRaw, 
  isGroupShootType as isGroupShootTypeRaw,
  isProductType as isProductTypeRaw,
  isEditType as isEditTypeRaw,
  isCreateModelType as isCreateModelTypeRaw,
  isReferenceShotType as isReferenceShotTypeRaw,
  isLifestyleType as isLifestyleTypeRaw,
  isBrandStyleType as isBrandStyleTypeRaw
} from "@/lib/taskTypes"
import { useGalleryStore, getCacheKey } from "@/stores/galleryStore"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"

type TabType = "all" | "model" | "product" | "group" | "reference" | "brand" | "favorites"
type ModelSubType = "all" | "buyer" | "prostudio" | "create_model" | "social" | "lifestyle"  // 买家秀 / 专业棚拍 / 创建专属模特 / 社媒种草 / LifeStyle 街拍

// 类型分类函数包装器（兼容 Generation 对象参数）
function isBuyerShowType(gen: Generation | null | undefined): boolean {
  return gen ? isBuyerShowTypeRaw(gen.type) : false
}
function isProStudioType(gen: Generation | null | undefined): boolean {
  return gen ? isProStudioTypeRaw(gen.type) : false
}
function isGroupShootType(gen: Generation | null | undefined): boolean {
  return gen ? isGroupShootTypeRaw(gen.type) : false
}
function isProductType(gen: Generation | null | undefined): boolean {
  return gen ? isProductTypeRaw(gen.type) : false
}
function isEditType(gen: Generation | null | undefined): boolean {
  return gen ? isEditTypeRaw(gen.type) : false
}
function isCreateModelType(gen: Generation | null | undefined): boolean {
  return gen ? isCreateModelTypeRaw(gen.type) : false
}
function isReferenceShotType(gen: Generation | null | undefined): boolean {
  return gen ? isReferenceShotTypeRaw(gen.type) : false
}
function isLifestyleType(gen: Generation | null | undefined): boolean {
  return gen ? isLifestyleTypeRaw(gen.type) : false
}
function isBrandStyleType(gen: Generation | null | undefined): boolean {
  return gen ? isBrandStyleTypeRaw(gen.type) : false
}

export default function GalleryPage() {
  const router = useRouter()
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [modelSubType, setModelSubType] = useState<ModelSubType>("all")  // 模特二级分类
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null) // 跳转中状态
  
  // 预加载常用跳转页面
  useEffect(() => {
    router.prefetch('/try-on')
    router.prefetch('/edit/general')
    router.prefetch('/camera/group')
    router.prefetch('/gallery/modify-material')
  }, [router])
  
  // Pull to refresh states
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const PULL_THRESHOLD = 80
  
  // 使用 API 获取数据，不再从 store 读取
  const [galleryItems, setGalleryItems] = useState<any[]>([])
  const [pendingTasksFromDb, setPendingTasksFromDb] = useState<any[]>([]) // 从数据库获取的 pending 任务
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const { addUserAsset, favorites, addFavorite, removeFavorite } = useAssetStore()
  const { user } = useAuth()
  const { tasks, removeTask, _hasHydrated: tasksHydrated } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  const { t } = useTranslation()
  
  // 使用全局 galleryStore 缓存（支持预加载）
  const { getCache, setCache, updateCacheItems, clearCache } = useGalleryStore()
  
  // 使用 ref 追踪已处理的 slot，避免重复 append
  const processedSlotsRef = useRef<Set<string>>(new Set())
  // 使用 ref 存储 galleryItems 的最新值，避免依赖循环
  const galleryItemsRef = useRef<any[]>([])
  galleryItemsRef.current = galleryItems
  // 使用 ref 存储 tasks 的最新值，用于在 fetchGalleryData 中标记已处理的 slots
  const tasksRef = useRef<typeof tasks>([])
  tasksRef.current = tasks
  
  // 标记从服务器获取的图片对应的 slots 为已处理
  // 这样可以防止 append useEffect 重复添加相同的图片
  // 注意：不能用 imageUrl 匹配，因为 slot.imageUrl 可能是 blob URL，而 item.imageUrl 是存储 URL
  // 应该用 task.dbId (数据库 UUID) 和 imageIndex 匹配
  const markServerItemsAsProcessed = (serverItems: any[]) => {
    serverItems.forEach(item => {
      tasksRef.current.forEach(task => {
        // 方法1：使用 task.dbId（数据库 UUID）匹配 item.generationId
        if (task.dbId && item.generationId && task.dbId === item.generationId) {
          const slotKey = `${task.id}-${item.imageIndex}`
          if (!processedSlotsRef.current.has(slotKey)) {
            processedSlotsRef.current.add(slotKey)
            console.log(`[Gallery] Marked as processed (dbId match): ${slotKey}`)
          }
        }
        // 方法2：遍历 slots 检查每个 slot 的 dbId
        task.imageSlots?.forEach((slot, slotIndex) => {
          if (slot.dbId && item.generationId && slot.dbId === item.generationId && slotIndex === item.imageIndex) {
            const slotKey = `${task.id}-${slotIndex}`
            if (!processedSlotsRef.current.has(slotKey)) {
              processedSlotsRef.current.add(slotKey)
              console.log(`[Gallery] Marked as processed (slot.dbId match): ${slotKey}`)
            }
          }
        })
      })
    })
  }
  
  // 从 API 获取图库数据（优先使用预加载的缓存）
  const fetchGalleryData = async (page: number = 1, append: boolean = false, forceRefresh: boolean = false) => {
    if (!user) return
    
    const cacheKey = getCacheKey(activeTab, modelSubType)
    
    // 如果不是强制刷新且有缓存（包括预加载的），直接使用缓存
    if (!forceRefresh && !append) {
      const cached = getCache(cacheKey)
      if (cached) {
        console.log(`[Gallery] Using cache for ${cacheKey}, ${cached.items.length} items`)
        setGalleryItems(cached.items)
        // 标记缓存的图片为已处理，防止第二个 useEffect 重复 append
        markServerItemsAsProcessed(cached.items)
        setHasMore(cached.hasMore)
        setCurrentPage(cached.currentPage)
        setPendingTasksFromDb(cached.pendingTasks)
        setIsLoading(false)
        return
      }
    }
    
    try {
      if (!append) setIsLoading(true)
      else setIsLoadingMore(true)
      
      console.log(`[Gallery] Fetching from server: ${cacheKey}, page=${page}, forceRefresh=${forceRefresh}`)
      
      // 模特 tab 下传递二级分类参数
      const subType = activeTab === 'model' ? modelSubType : ''
      const response = await fetch(`/api/gallery?type=${activeTab}&page=${page}&subType=${subType}`, {
        cache: 'no-store', // 禁用缓存，确保获取最新数据
      })
      const result = await response.json()
      
      if (result.success) {
        if (append) {
          // 使用 ref 获取最新的 galleryItems，避免 stale closure 问题
          const newItems = [...galleryItemsRef.current, ...result.data.items]
          setGalleryItems(newItems)
          // 更新缓存
          setCache(cacheKey, {
            items: newItems,
            hasMore: result.data.hasMore,
            currentPage: page,
            pendingTasks: pendingTasksFromDb,
            fetchedAt: Date.now(),
          })
        } else {
          setGalleryItems(result.data.items)
          // 标记从服务器获取的图片为已处理，防止第二个 useEffect 重复 append
          markServerItemsAsProcessed(result.data.items)
          // 第一页时更新 pending 任务
          if (result.data.pendingTasks) {
            setPendingTasksFromDb(result.data.pendingTasks)
          }
          // 更新缓存
          setCache(cacheKey, {
            items: result.data.items,
            hasMore: result.data.hasMore,
            currentPage: page,
            pendingTasks: result.data.pendingTasks || [],
            fetchedAt: Date.now(),
          })
        }
        setHasMore(result.data.hasMore)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Failed to fetch gallery data:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }
  
  // 加载更多
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchGalleryData(currentPage + 1, true, false)
    }
  }
  
  // 当用户登录或 tab 切换时加载数据（优先使用全局预加载的缓存）
  // 注意：全局预加载由 GalleryPreloader 组件在首页完成，这里只需使用缓存
  useEffect(() => {
    if (user) {
      // fetchGalleryData 内部会检查缓存，命中则立即返回
      fetchGalleryData(1, false, false)
    }
  }, [user, activeTab, modelSubType])
  
  // 任务完成时，本地 append 到 galleryItems（不再定时刷新）
  useEffect(() => {
    // 定义 task.type 到 tab 的映射
    const getTabsForType = (type: string): { tabs: string[], subType: string | null } => {
      switch (type) {
        case 'camera':
        case 'social':
          return { tabs: ['all', 'model'], subType: 'buyer' }
        case 'pro_studio':
          return { tabs: ['all', 'model'], subType: 'prostudio' }
        case 'studio':
          return { tabs: ['all', 'product'], subType: null }
        case 'group_shoot':
        case 'reference_shot':
          return { tabs: ['all', 'model'], subType: null }
        case 'lifestyle':
          return { tabs: ['all', 'model'], subType: 'lifestyle' }
        case 'brand_style':
          return { tabs: ['all', 'brand'], subType: null }
        default:
          return { tabs: ['all'], subType: null }
      }
    }
    
    // 判断当前 tab 是否应该显示该任务的图片
    const shouldShowInCurrentTab = (taskMapping: { tabs: string[], subType: string | null }): boolean => {
      // 1. 首先检查 tab 是否匹配
      if (!taskMapping.tabs.includes(activeTab)) return false
      
      // 2. 如果当前是 "model" tab，需要检查 subType
      if (activeTab === 'model') {
        // 如果任务有指定的 subType，必须匹配
        if (taskMapping.subType) {
          return taskMapping.subType === modelSubType
        }
        // 如果任务没有指定 subType（如 group_shoot），则显示在所有 model 子分类中
        return true
      }
      
      // 3. 其他 tab（all, product, favorites）直接显示
      return true
    }
    
    // 遍历所有任务，找到已完成但未 append 的 slot
    tasks.forEach(task => {
      // Bug 1 修复：移除 !task.dbId 检查，改为使用 slot.dbId
      // task.dbId 只在 index 0 完成时设置，如果图片乱序完成会导致问题
      if (!task.imageSlots) return
      
      const taskMapping = getTabsForType(task.type)
      
      task.imageSlots.forEach((slot, slotIndex) => {
        if (slot.status !== 'completed' || !slot.imageUrl) return
        
        // 需要 slot.dbId 才能正确构建 galleryItem
        // 如果 slot.dbId 不存在，说明后端还没返回，等待下次更新
        if (!slot.dbId) return
        
        const slotKey = `${task.id}-${slotIndex}`
        if (processedSlotsRef.current.has(slotKey)) return
        
        // 检查当前 tab 是否应该显示
        if (!shouldShowInCurrentTab(taskMapping)) return
        
        // 检查是否已在 galleryItems 中（避免重复）- 使用 ref 避免依赖循环
        const alreadyInGallery = galleryItemsRef.current.some(item => 
          item.imageUrl === slot.imageUrl
        )
        if (alreadyInGallery) {
          processedSlotsRef.current.add(slotKey)
          return
        }
        
        // 使用 slot.dbId 作为 generationId（每个 slot 都有独立的数据库记录）
        // 或者使用 task.dbId 作为后备（如果 slot.dbId 与 task.dbId 相同）
        const generationDbId = slot.dbId || task.dbId
        
        // 构建 galleryItem 格式的数据
        const newItem = {
          id: `${generationDbId}-${slotIndex}`,
          generationId: generationDbId,
          imageIndex: slotIndex,
          imageUrl: slot.imageUrl,
          type: task.type,
          createdAt: task.createdAt,
          generation: {
            id: task.id,
            dbId: generationDbId,
            type: task.type,
            outputImageUrls: task.outputImageUrls || task.imageSlots?.map(s => s.imageUrl || '').filter(Boolean) || [],
            outputGenModes: task.imageSlots?.map(s => s.genMode).filter(Boolean) || [],
            outputModelTypes: task.imageSlots?.map(s => s.modelType).filter(Boolean) || [],
            inputImageUrl: task.inputImageUrl,
            params: task.params,
            createdAt: task.createdAt,
          }
        }
        
        console.log(`[Gallery] Appending completed image to local list: ${slotKey}`)
        
        // Bug 1 & 2 修复：只更新当前 tab 的列表和缓存
        // 不再用当前 tab 的数据覆盖其他 tab 的缓存
        // 其他相关 tab 的缓存直接清除，让下次访问时重新加载正确的数据
        const currentCacheKey = getCacheKey(activeTab, modelSubType)
        
        setGalleryItems(prev => {
          const newItems = [newItem, ...prev]
          // 只更新当前 tab 的缓存
          updateCacheItems(currentCacheKey, newItems)
          return newItems
        })
        
        // 清除其他相关 tab 的缓存（避免用错误数据覆盖）
        // Bug 1 修复：完整清除所有 model 子分类缓存
        const allModelSubTypes = ['all', 'buyer', 'prostudio', 'create_model', 'social', 'lifestyle']
        
        taskMapping.tabs.forEach(tab => {
          if (tab === 'model' && taskMapping.subType) {
            // 有特定 subType 的任务，只清除该 subType 的缓存
            const cacheKey = getCacheKey(tab, taskMapping.subType)
            if (cacheKey !== currentCacheKey) clearCache(cacheKey)
          } else if (tab === 'model') {
            // 没有 subType 的 model 项目（如 group_shoot），清除所有 model 子分类缓存
            allModelSubTypes.forEach(subType => {
              const cacheKey = getCacheKey(tab, subType)
              if (cacheKey !== currentCacheKey) clearCache(cacheKey)
            })
          } else {
            const cacheKey = getCacheKey(tab, '')
            if (cacheKey !== currentCacheKey) clearCache(cacheKey)
          }
        })
        processedSlotsRef.current.add(slotKey)
      })
    })
  }, [tasks, activeTab, modelSubType, updateCacheItems, clearCache]) // 移除 galleryItems 依赖，使用 ref 代替
  
  // Helper to get display label for generation type
  // debugMode controls whether to show sub-labels (极简/扩展)
  const getTypeLabel = (gen: Generation | null | undefined, imageIndex: number, isDebugMode: boolean = false): { label: string; color: string; subLabel?: string; subColor?: string } => {
    // Null safety check
    if (!gen) {
      return { label: t.gallery.model, color: 'bg-zinc-400' }
    }
    
    // Create Model types (创建专属模特)
    if (isCreateModelType(gen)) {
      return { 
        label: t.gallery.createModel || '定制模特', 
        color: 'bg-violet-500',
      }
    }
    
    // Social types (社媒种草)
    if (gen.type === 'social') {
      return { 
        label: t.gallery.social || '社媒种草', 
        color: 'bg-gradient-to-r from-pink-500 to-purple-500',
      }
    }
    
    // Reference Shot types (参考图拍摄)
    if (isReferenceShotType(gen)) {
      return { 
        label: t.gallery.referenceShot || '参考图', 
        color: 'bg-pink-500',
      }
    }
    
    // Group Shoot types (组图拍摄)
    if (isGroupShootType(gen)) {
      return { 
        label: t.gallery.groupShoot || '组图', 
        color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      }
    }
    
    // Pro Studio types (专业棚拍)
    if (isProStudioType(gen)) {
      // 优先使用 outputGenModes 中的实际模式，如果没有则用位置判断
      // 新版：0,1,2 = 简单模式, 3,4,5 = 扩展模式
      const mode = gen.outputGenModes?.[imageIndex]
      let subLabel = undefined
      let subColor = 'bg-amber-600'
      if (isDebugMode) {
        if (mode) {
          // 使用实际记录的模式
          subLabel = mode === 'simple' ? t.common.simple : t.common.extended
          subColor = mode === 'simple' ? 'bg-green-500' : 'bg-purple-500'
        } else {
          // fallback: 用位置判断
          subLabel = imageIndex < 3 ? t.common.simple : t.common.extended
          subColor = imageIndex < 3 ? 'bg-green-500' : 'bg-purple-500'
        }
      }
      return { 
        label: t.gallery.proStudio || '专业棚拍', 
        color: 'bg-gradient-to-r from-amber-500 to-orange-500',
        subLabel,
        subColor
      }
    }
    
    // Studio/product types
    if (isProductType(gen)) {
      return { label: t.gallery.productStudio || t.gallery.product, color: 'bg-amber-500' }
    }
    
    // Edit types
    if (isEditType(gen)) {
      return { label: t.gallery.editRoom, color: 'bg-purple-500' }
    }
    
    // LifeStyle types (LifeStyle 街拍)
    if (isLifestyleType(gen)) {
      return { 
        label: t.gallery.lifestyleShot || 'LifeStyle 街拍', 
        color: 'bg-purple-600',
      }
    }
    
    // Brand Style types (Clone Brand Style)
    if (isBrandStyleType(gen)) {
      return { 
        label: t.gallery.brand || 'Brand', 
        color: 'bg-gradient-to-r from-violet-500 to-purple-600',
      }
    }

    // Model/camera types (买家秀)
    if (isBuyerShowType(gen)) {
      const mode = gen.outputGenModes?.[imageIndex]
      // Only show sub-labels in debug mode
      const subLabel = isDebugMode && mode ? (mode === 'simple' ? t.common.simple : t.common.extended) : undefined
      return { 
        label: t.gallery.modelStudio || '买家秀', 
        color: 'bg-blue-500',
        subLabel,
        subColor: mode === 'simple' ? 'bg-green-500' : 'bg-purple-500'
      }
    }
    
    // Last fallback - treat as edit
    return { label: t.gallery.editRoom, color: 'bg-purple-500' }
  }
  
  // Get tasks that need to show imageSlot cards
  // Include: pending, generating, AND completed tasks that haven't been synced yet
  const activeTasks = tasks.filter(task => {
    // Always show pending/generating
    if (task.status === 'pending' || task.status === 'generating') return true
    // For completed tasks with imageSlots, show until synced
    if (task.status === 'completed' && task.imageSlots && task.imageSlots.length > 0) {
      // Check if this task's images are already in gallery items
      const outputUrls = task.outputImageUrls || []
      const isSynced = outputUrls.length > 0 && galleryItems.some(item => 
        outputUrls.some(url => url && item.imageUrl === url)
      )
      return !isSynced // Show if not yet synced
    }
    return false
  })
  
  // Get completed tasks that might not yet be in gallery (legacy - no imageSlots)
  const completedTasks = tasks.filter(task => task.status === 'completed' && !task.imageSlots)
  
  // Track which completed tasks have their images in the gallery
  const completedTasksWithImages = completedTasks.filter(task => 
    task.outputImageUrls && task.outputImageUrls.length > 0
  )
  
  // Check which completed tasks already have their images in gallery
  const tasksToHide = completedTasksWithImages.filter(task => {
    // Match by comparing output URLs
    const outputUrls = task.outputImageUrls || []
    return galleryItems.some(item => 
      outputUrls.some(url => url && item.imageUrl === url)
    )
  })
  
  // Only show completed tasks that DON'T have their images in gallery yet
  const completedTasksToShow = completedTasksWithImages.filter(
    task => !tasksToHide.some(t => t.id === task.id)
  )
  
  // Auto-remove completed tasks after they're no longer needed
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    
    // Remove tasks that already have their images in gallery
    tasksToHide.forEach(task => {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => removeTask(task.id), 500)
      timers.push(timer)
    })
    
    // Also remove completed tasks that have been around too long (10 seconds)
    completedTasks.forEach(task => {
      const timer = setTimeout(() => {
        // Only remove if still in completed state
        const currentTask = tasks.find(t => t.id === task.id)
        if (currentTask?.status === 'completed') {
          removeTask(task.id)
        }
      }, 10000)
      timers.push(timer)
    })
    
    // Cleanup all timers when dependencies change
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [tasksToHide, completedTasks, tasks, removeTask, galleryItems])
  
  // Clear save success message
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])
  
  // Show loading state
  if (isLoading && !user) {
    return (
      <div className="h-full w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }
  
  // 显示的图片列表（来自 API）
  // 过滤掉无效的 items（generation 为 null 的情况）
  const displayedHistory = galleryItems
    .filter(item => item && item.generation && item.imageUrl)
    .map(item => ({
      gen: item.generation,
      url: item.imageUrl,
      idx: item.imageIndex
    }))
  
  // 构建 galleryItemsMap：按 generation ID 分组，用于 ImageSlotCard 查找
  // 这样 ImageSlotCard 可以在 generations store 没有数据时，从 API 返回的 galleryItems 中获取
  const galleryItemsMap = galleryItems.reduce((acc, item) => {
    if (item && item.generation) {
      const genId = item.generation.dbId || item.generation.id
      if (!acc[genId]) {
        acc[genId] = item.generation
      }
    }
    return acc
  }, {} as Record<string, Generation>)
  
  // 检查图片是否已收藏 - 使用 assetStore 的 favorites 列表
  const isFavorited = (generationId: string, imageIndex: number): boolean => {
    // 在收藏页，所有图片都是已收藏的
    if (activeTab === 'favorites') return true
    // 检查 assetStore 的 favorites 列表
    return favorites.some(f => f.generationId === generationId && f.imageIndex === imageIndex)
  }
  
  const handleFavoriteToggle = async (generationId: string, imageIndex: number) => {
    // 检查 assetStore 中是否已收藏
    const existingFavorite = favorites.find(f => f.generationId === generationId && f.imageIndex === imageIndex)
    const isOnFavoritesTab = activeTab === 'favorites'
    
    if (existingFavorite || isOnFavoritesTab) {
      // 取消收藏
      const favoriteId = existingFavorite?.id || galleryItems.find(i => i.generationId === generationId && i.imageIndex === imageIndex)?.id
      if (favoriteId) {
        // 乐观更新：立即从本地 store 移除
        removeFavorite(favoriteId)
        
        // 如果在收藏页，立即从列表中移除该图片
        if (isOnFavoritesTab) {
          setGalleryItems(prev => prev.filter(item => 
            !(item.generationId === generationId && item.imageIndex === imageIndex)
          ))
        }
        
        // 如果是临时 ID（乐观更新创建的），不需要调用 API
        if (favoriteId.startsWith('temp-')) {
          console.log('[Favorites] Skipping API call for temp favorite:', favoriteId)
          return
        }
        
        // 异步调用 API（不阻塞 UI）
        fetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' })
          .catch(err => {
            console.error('Failed to delete favorite:', err)
          })
      }
    } else {
      // 添加收藏
      // 乐观更新：立即添加一个临时记录
      const tempId = `temp-${Date.now()}`
      addFavorite({
        id: tempId,
        generationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      }, true) // skipCloudSync = true
      
      // 异步调用 API
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId, imageIndex })
      })
        .then(async response => {
          if (response.ok) {
            const data = await response.json()
            // 用真实 ID 替换临时 ID
            if (data.data?.id && data.data.id !== tempId) {
              removeFavorite(tempId)
              addFavorite({
                id: data.data.id,
                generationId,
                imageIndex,
                createdAt: data.data.created_at || new Date().toISOString(),
              }, true)
            }
          } else {
            // API 失败，回滚乐观更新
            removeFavorite(tempId)
          }
        })
        .catch(err => {
          console.error('Failed to add favorite:', err)
          // 回滚乐观更新
          removeFavorite(tempId)
        })
    }
  }
  
  const handleDownload = async (url: string, generationId?: string, imageIndex?: number) => {
    // Track download event (don't await, fire and forget)
    fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        generationId,
        imageIndex,
        source: 'gallery',
      }),
    }).catch(() => {}) // Silently ignore tracking errors
    
    // 检测是否是 iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const file = new File([blob], `brand-camera-${Date.now()}.png`, { type: 'image/png' })
      
      // 只有 iOS 使用系统分享（会显示"存储图像"选项），Android 直接下载
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        // 直接下载
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }
    } catch (error: any) {
      // 用户取消分享不算错误
      if (error.name === 'AbortError') return
      
      console.error("Download failed:", error)
      // 回退：直接打开链接
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.png`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing) return
    if (scrollContainerRef.current?.scrollTop !== 0) {
      setPullDistance(0)
      return
    }
    
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartY.current
    
    if (diff > 0) {
      // Apply resistance - the further you pull, the harder it gets
      const resistance = Math.min(diff * 0.4, 120)
      setPullDistance(resistance)
    }
  }
  
  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing && user?.id) {
      setIsRefreshing(true)
      setPullDistance(PULL_THRESHOLD) // Keep at threshold during refresh
      
      try {
        // 下拉刷新时强制从服务器获取，忽略缓存
        await fetchGalleryData(1, false, true)
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }
  
  const handleDelete = async () => {
    if (!selectedItem) return
    
    const deletedItem = selectedItem
    const generationId = deletedItem.gen.dbId || deletedItem.gen.id
    const itemType = deletedItem.gen.type
    
    // 根据 item type 确定需要清除的缓存
    const getAffectedCacheKeys = (type: string): string[] => {
      switch (type) {
        case 'camera':
        case 'social':
          return ['all', 'model_buyer']
        case 'pro_studio':
          return ['all', 'model_prostudio']
        case 'studio':
          return ['all', 'product']
        case 'group_shoot':
        case 'reference_shot':
          return ['all', 'model_buyer', 'model_prostudio'] // 显示在所有 model 子分类
        default:
          return ['all']
      }
    }
    
    const affectedCacheKeys = getAffectedCacheKeys(itemType)
    const currentCacheKey = getCacheKey(activeTab, modelSubType)
    
    // 确保当前 tab 的缓存键也被处理（Bug 1 修复：处理 model_all 等情况）
    const allCacheKeysToProcess = affectedCacheKeys.includes(currentCacheKey) 
      ? affectedCacheKeys 
      : [...affectedCacheKeys, currentCacheKey]
    
    // Bug 3 修复：保存删除前的完整列表，用于回滚时恢复原始顺序
    const originalItems = [...galleryItems]
    
    // 1. 乐观更新：立即从本地列表移除该 generation 的所有图片
    const newItems = galleryItems.filter(item => 
      item.generationId !== generationId && item.generation?.dbId !== generationId
    )
    setGalleryItems(newItems)
    
    // 清除所有相关 tab 的缓存（确保即使缓存不存在也能处理）
    // 当前 tab：更新缓存为新数据；其他 tab：清除缓存，下次访问时重新加载
    allCacheKeysToProcess.forEach(cacheKey => {
      if (cacheKey === currentCacheKey) {
        // 当前 tab：更新缓存为新数据
        setCache(cacheKey, {
          items: newItems,
          hasMore: hasMore,
          currentPage: currentPage,
          pendingTasks: pendingTasksFromDb,
          fetchedAt: Date.now(),
        })
      } else {
        // 其他 tab：清除缓存，下次访问时重新加载
        clearCache(cacheKey)
      }
    })
    
    // 2. 关闭确认框和详情面板
    setSelectedItem(null)
    setShowDeleteConfirm(false)
    
    // 3. 异步调用 DELETE API
    try {
      const response = await fetch(`/api/generations/${generationId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Delete failed')
      }
      console.log(`[Gallery] Deleted generation ${generationId}`)
    } catch (error) {
      console.error("Delete failed:", error)
      // 4. 失败时回滚：恢复原始列表（Bug 3 修复：保持原始顺序）
      setGalleryItems(originalItems)
      
      // 恢复当前 tab 的缓存
      setCache(currentCacheKey, {
        items: originalItems,
        hasMore: hasMore,
        currentPage: currentPage,
        pendingTasks: pendingTasksFromDb,
        fetchedAt: Date.now(),
      })
      // 其他 tab 的缓存保持清除状态，下次访问会重新加载
    }
  }
  
  const handleSaveAsAsset = async (type: 'product' | 'model') => {
    if (!selectedItem) return
    
    const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
    
    const newAsset: Asset = {
      id: generateId(),
      type: type,
      name: `${type === 'product' ? t.common.product : t.common.model}-${new Date().toLocaleString()}`,
      imageUrl: imageUrl,
      isSystem: false,
    }
    
    try {
      await addUserAsset(newAsset)
      setShowSaveMenu(false)
      setSaveSuccess(type === 'product' ? t.gallery.savedToProducts : t.gallery.savedToModels)
    } catch (error) {
      console.error("Save failed:", error)
    }
  }

  const tabs: { id: TabType; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: t.gallery.all },
    { id: "model", label: t.gallery.model, icon: <Users className="w-3.5 h-3.5" /> },
    { id: "product", label: t.gallery.product, icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: "group", label: t.gallery.groupShoot || '组图', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { id: "reference", label: t.gallery.referenceShot || '参考图', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "brand", label: t.gallery.brand || 'Brand', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "favorites", label: t.gallery.favorites, icon: <Heart className="w-3.5 h-3.5" /> },
  ]
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="h-14 flex items-center px-4">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <Home className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
            <span className="font-semibold text-lg text-zinc-900">{t.gallery.title}</span>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* 模特二级分类 - Model Studio / LifeStyle / Buyer Show / Social / Custom Model */}
        {activeTab === "model" && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setModelSubType("all")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "all"
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.common.all || '全部'}
            </button>
            <button
              onClick={() => setModelSubType("prostudio")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "prostudio"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.gallery.proStudio || '专业棚拍'}
            </button>
            <button
              onClick={() => setModelSubType("lifestyle")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "lifestyle"
                  ? "bg-purple-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.gallery.lifestyleShot || 'LifeStyle 街拍'}
            </button>
            <button
              onClick={() => setModelSubType("buyer")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "buyer"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.gallery.buyerShow || '买家秀'}
            </button>
            <button
              onClick={() => setModelSubType("social")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "social"
                  ? "bg-pink-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.gallery.social || '社媒种草'}
            </button>
            <button
              onClick={() => setModelSubType("create_model")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                modelSubType === "create_model"
                  ? "bg-violet-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.gallery.createModel || '定制模特'}
            </button>
          </div>
        )}
      </div>

      {/* Grid with Pull to Refresh */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 pb-24 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        <div 
          className="absolute left-0 right-0 flex flex-col items-center justify-center transition-all duration-200 overflow-hidden"
          style={{ 
            height: pullDistance,
            top: 0,
            transform: `translateY(-${Math.max(0, PULL_THRESHOLD - pullDistance)}px)`
          }}
        >
          <div className={`flex items-center gap-2 text-zinc-500 ${isRefreshing ? 'animate-pulse' : ''}`}>
            {isRefreshing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm">{t.pullRefresh.refreshing}</span>
              </>
            ) : pullDistance >= PULL_THRESHOLD ? (
              <>
                <RefreshCw className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-blue-500">{t.pullRefresh.releaseToRefresh}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-5 h-5" style={{ transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD * 180, 180)}deg)` }} />
                <span className="text-sm">{t.pullRefresh.pullToRefresh}</span>
              </>
            )}
          </div>
        </div>
        
        {/* 加载中状态条 - 显示在图片列表上方 */}
        {isRefreshing && (
          <div 
            className="flex items-center justify-center gap-2 py-2 mb-3 bg-blue-50 border border-blue-100 rounded-xl transition-transform duration-200"
            style={{ transform: `translateY(${pullDistance}px)` }}
          >
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600">{t.common.syncing || '正在同步云端数据...'}</span>
          </div>
        )}
        
        <div 
          className={`grid gap-3 transition-transform duration-200 ${isDesktop ? 'grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2'}`}
          style={{ transform: `translateY(${pullDistance}px)` }}
        >
          {/* 显示从数据库获取的 pending 任务（刷新后恢复的生成中任务） */}
          {/* 只有在 tasksHydrated 后才显示，避免 hydration 前 tasks 为空导致重复渲染 */}
          {activeTab === "all" && tasksHydrated && pendingTasksFromDb
            .filter(pt => !tasks.some(t => t.id === pt.id)) // 排除已在本地 store 中的任务
            .map((pendingTask) => (
              Array.from({ length: pendingTask.totalImages || 4 }).map((_, idx) => (
                <PendingTaskCard 
                  key={`pending-db-${pendingTask.id}-${idx}`}
                  taskType={pendingTask.type}
                  index={idx}
                  total={pendingTask.totalImages || 4}
                />
              ))
            ))}
          
          {/* Show cards for active tasks - each imageSlot gets its own card */}
          {/* 过滤掉已经在 galleryItems 中的图片，避免重复渲染 */}
          {activeTab === "all" && activeTasks.map((task) => (
            task.imageSlots && task.imageSlots.length > 0 
              ? task.imageSlots
                  .filter(slot => {
                    // 如果 slot 已完成且图片已在 galleryItems 中，跳过渲染（避免重复）
                    if (slot.status === 'completed' && slot.imageUrl) {
                      const alreadyInGallery = galleryItems.some(item => item.imageUrl === slot.imageUrl)
                      if (alreadyInGallery) return false
                    }
                    return true
                  })
                  .map((slot) => (
                  <ImageSlotCard 
                    key={`${task.id}-slot-${slot.index}`} 
                    task={task} 
                    slot={slot}
                    slotIndex={slot.index}
                    galleryItemsMap={galleryItemsMap}
                    onImageClick={(url) => setFullscreenImage(url)}
                    onOpenDetail={(gen, index) => setSelectedItem({ gen, index })}
                  />
                ))
              : <GeneratingCard key={task.id} task={task} />
          ))}
          
          {/* Show completed task images while waiting for sync to generations store */}
          {activeTab === "all" && completedTasksToShow.map((task) => (
            task.outputImageUrls.map((url, idx) => (
              <div 
                key={`completed-${task.id}-${idx}`}
                className="relative aspect-[4/5] bg-zinc-200 rounded-xl overflow-hidden shadow-sm ring-2 ring-green-400"
              >
                <Image 
                  src={url} 
                  alt={`Generated ${idx + 1}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                  <span>✓ 完成</span>
                </div>
              </div>
            ))
          ))}
          
          {displayedHistory.map((item, i) => {
            const typeInfo = getTypeLabel(item.gen, item.idx, debugMode)
            return (
              <motion.div 
                key={`${item.gen.id}-${item.idx}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.2) }}
                className="group relative aspect-[4/5] bg-zinc-200 rounded-xl overflow-hidden cursor-pointer shadow-sm"
                onClick={() => setSelectedItem({ gen: item.gen, index: item.idx })}
              >
                <Image 
                  src={item.url} 
                  alt="Generated" 
                  fill 
                  className="object-cover transition-transform group-hover:scale-105" 
                />
                
                {/* Type badge */}
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                  <span className={`px-2 py-1 rounded text-[10px] font-medium ${typeInfo.color} text-white`}>
                    {typeInfo.label}
                  </span>
                  {typeInfo.subLabel && (
                    <span className={`px-1.5 py-1 rounded text-[9px] font-medium ${typeInfo.subColor} text-white`}>
                      {typeInfo.subLabel}
                    </span>
                  )}
                </div>
                
                {/* Favorite button */}
                <button 
                  className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                    isFavorited(item.gen.dbId || item.gen.id, item.idx)
                      ? "bg-red-500 text-white" 
                      : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFavoriteToggle(item.gen.dbId || item.gen.id, item.idx)
                  }}
                >
                  <Heart className={`w-4 h-4 ${isFavorited(item.gen.dbId || item.gen.id, item.idx) ? "fill-current" : ""}`} />
                </button>
                
                {/* Date overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">
                    {new Date(item.gen.createdAt).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
        
        {/* Load More Button - 所有tab都显示 */}
        {hasMore && displayedHistory.length > 0 && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-50 text-zinc-700 disabled:text-zinc-400 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                t.gallery.loadMore || '加载更多'
              )}
            </button>
          </div>
        )}
        
        {/* 加载提示 + 骨架屏 - 只在没有任何内容时显示 */}
        {isLoading && displayedHistory.length === 0 && activeTasks.length === 0 && completedTasksToShow.length === 0 && (
          <>
            <div className="flex items-center justify-center gap-2 py-3 mb-3 bg-blue-50 border border-blue-100 rounded-xl">
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-blue-600">{t.common.syncing || '正在加载数据...'}</span>
            </div>
            <div className={`grid gap-3 ${isDesktop ? 'grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2'}`}>
              {[...Array(isDesktop ? 12 : 6)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl animate-pulse" />
              ))}
            </div>
          </>
        )}
        
        {/* 空状态 - 加载完成后没有数据时显示 */}
        {!isLoading && displayedHistory.length === 0 && activeTasks.length === 0 && completedTasksToShow.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            {isRefreshing ? (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <p className="text-sm text-blue-600">{t.common.syncing || '正在同步云端数据...'}</p>
                <p className="text-xs text-zinc-300 mt-1">{t.common.pleaseWait || '请稍候'}</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                  {activeTab === "favorites" ? (
                    <Heart className="w-8 h-8 text-zinc-300" />
                  ) : activeTab === "model" ? (
                    <Users className="w-8 h-8 text-zinc-300" />
                  ) : activeTab === "product" ? (
                    <Lightbulb className="w-8 h-8 text-zinc-300" />
                  ) : activeTab === "group" ? (
                    <Grid3X3 className="w-8 h-8 text-zinc-300" />
                  ) : activeTab === "reference" ? (
                    <Palette className="w-8 h-8 text-zinc-300" />
                  ) : (
                    <Camera className="w-8 h-8 text-zinc-300" />
                  )}
                </div>
                <p className="text-sm">
                  {activeTab === "favorites" ? t.gallery.noFavorites : 
                   activeTab === "model" ? t.gallery.noModelImages :
                   activeTab === "product" ? t.gallery.noProductImages : 
                   activeTab === "group" ? (t.gallery.noGroupImages || '暂无组图') :
                   activeTab === "reference" ? (t.gallery.noReferenceImages || '暂无参考图') : t.gallery.noImages}
                </p>
                <p className="text-xs text-zinc-300 mt-1">
                  {activeTab !== "favorites" && (t.gallery?.startShooting || "去拍摄生成你的第一张图片吧")}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <div className="h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                <button
                  onClick={() => {
                    setSelectedItem(null)
                    setNavigatingTo(null)
                  }}
                  className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-700" />
                </button>
                <span className="font-semibold text-zinc-900">{t.gallery.detail}</span>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-10 h-10 -mr-2 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-100 pb-20">
                <div className="bg-zinc-900">
                  <div 
                    className="relative aspect-square max-h-[50vh] mx-auto cursor-pointer group shrink-0"
                    onClick={() => setFullscreenImage(selectedItem.gen.outputImageUrls[selectedItem.index])}
                  >
                    {/* Use img tag for native long-press save support */}
                    <img 
                      src={selectedItem.gen.outputImageUrls[selectedItem.index]} 
                      alt="Detail" 
                      className="w-full h-full object-contain" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <ZoomIn className="w-6 h-6 text-zinc-700" />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-zinc-500 text-xs py-2">{t.imageActions.longPressSave}</p>
                </div>
                
                <div className="p-4 bg-white pb-8">
                  {/* Type and date info */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {(() => {
                        const typeInfo = getTypeLabel(selectedItem.gen, selectedItem.index, debugMode)
                        return (
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            {typeInfo.subLabel && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeInfo.subColor}`}>
                                {typeInfo.subLabel}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                      <p className="text-xs text-zinc-400">
                        {new Date(selectedItem.gen.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFavoriteToggle(selectedItem.gen.dbId || selectedItem.gen.id, selectedItem.index)}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                          isFavorited(selectedItem.gen.dbId || selectedItem.gen.id, selectedItem.index)
                            ? "bg-red-50 border-red-200 text-red-500"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorited(selectedItem.gen.dbId || selectedItem.gen.id, selectedItem.index) ? "fill-current" : ""}`} />
                      </button>
                      <button
                        onClick={() => handleDownload(selectedItem.gen.outputImageUrls[selectedItem.index], selectedItem.gen.dbId || selectedItem.gen.id, selectedItem.index)}
                        className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button 
                      disabled={!!navigatingTo}
                      onClick={() => {
                        const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                        sessionStorage.setItem('tryOnImage', imageUrl)
                        setNavigatingTo('try-on')
                        router.push("/try-on")
                      }}
                      className="flex-1 h-12 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                    >
                      {navigatingTo === 'try-on' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {t.gallery.goTryOn || '去换装'}
                    </button>
                    <button 
                      disabled={!!navigatingTo}
                      onClick={() => {
                        const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                        sessionStorage.setItem('editImage', imageUrl)
                        setNavigatingTo('edit')
                        router.push("/edit/general")
                      }}
                      className="flex-1 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                    >
                      {navigatingTo === 'edit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {t.gallery.goEdit}
                    </button>
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button 
                      disabled={!!navigatingTo}
                      onClick={() => {
                        const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                        sessionStorage.setItem('groupShootImage', imageUrl)
                        setNavigatingTo('group')
                        router.push("/camera/group")
                      }}
                      className="flex-1 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                    >
                      {navigatingTo === 'group' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3X3 className="w-4 h-4" />}
                      {t.gallery.goGroupShoot || '拍组图'}
                    </button>
                  </div>
                  {/* 改材质版型按钮 - 所有生成图都可用 */}
                  {selectedItem.gen && (
                    <div className="flex gap-3 mt-3">
                      <button 
                        disabled={!!navigatingTo}
                        onClick={() => {
                          const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                          // 收集原始商品图
                          const inputImages: string[] = []
                          // 优先使用 outfit 模式的多商品图
                          if (selectedItem.gen.params?.productImages && selectedItem.gen.params.productImages.length > 0) {
                            inputImages.push(...selectedItem.gen.params.productImages)
                          }
                          // 否则使用单个商品图
                          else if (selectedItem.gen.inputImageUrl) {
                            inputImages.push(selectedItem.gen.inputImageUrl)
                          }
                          // 保存到 sessionStorage
                          sessionStorage.setItem('modifyMaterial_outputImage', imageUrl)
                          sessionStorage.setItem('modifyMaterial_inputImages', JSON.stringify(inputImages))
                          setNavigatingTo('material')
                          router.push("/gallery/modify-material")
                        }}
                        className="flex-1 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                      >
                        {navigatingTo === 'material' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                        {t.gallery.modifyMaterial || '改材质版型'}
                      </button>
                    </div>
                  )}
                  <div className="flex gap-3 mt-3">
                    <button 
                      onClick={() => setShowSaveMenu(true)}
                      className="flex-1 h-12 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                      {t.gallery.saveAsAsset || '存为素材'}
                    </button>
                  </div>
                  
                  {/* Input Images Section - Show for all users (only user inputs, not random selections) */}
                  {(() => {
                    const productImages = selectedItem.gen.params?.productImages || []
                    const inputImageUrl = selectedItem.gen.inputImageUrl      // 商品图
                    const inputImage2Url = selectedItem.gen.inputImage2Url    // 参考图（reference_shot 专用）
                    const isReferenceShot = isReferenceShotType(selectedItem.gen)
                    const hasInputImages = productImages.length > 0 || inputImageUrl || inputImage2Url
                    
                    if (!hasInputImages) return null
                    
                    return (
                      <div className="mt-6 pt-4 border-t border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.gallery.inputImages || '输入图片'}</h3>
                        <div className="flex flex-wrap gap-3">
                          {productImages.length > 0 ? (
                            productImages.map((productUrl: string, idx: number) => (
                              <div key={idx} className="flex flex-col items-center">
                                <div 
                                  className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 cursor-pointer relative group shadow-sm border border-zinc-200"
                                  onClick={() => setFullscreenImage(productUrl)}
                                >
                                  <Image 
                                    src={productUrl} 
                                    alt={`${t.gallery.productOriginal} ${idx + 1}`} 
                                    width={80}
                                    height={80}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1.5">{t.common.product} {idx + 1}</p>
                              </div>
                            ))
                          ) : inputImageUrl && (
                            <div className="flex flex-col items-center">
                              <div 
                                className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 cursor-pointer relative group shadow-sm border border-zinc-200"
                                onClick={() => setFullscreenImage(inputImageUrl)}
                              >
                                <Image 
                                  src={inputImageUrl} 
                                  alt={t.gallery.productOriginal} 
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1.5">{t.common.product}</p>
                            </div>
                          )}
                          {/* Reference Image - 只为 reference_shot 类型显示 */}
                          {isReferenceShot && inputImage2Url && (
                            <div className="flex flex-col items-center">
                              <div 
                                className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 cursor-pointer relative group shadow-sm border-2 border-pink-300"
                                onClick={() => setFullscreenImage(inputImage2Url)}
                              >
                                <Image 
                                  src={inputImage2Url} 
                                  alt={t.gallery.referenceImage || '参考图'} 
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <p className="text-xs text-pink-500 mt-1.5">{t.gallery.referenceImage || '参考图'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  {/* Generation Details - Only show in debug mode */}
                  {debugMode && (
                  <div className="mt-6 pt-4 border-t border-zinc-100 pb-8">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.gallery.debugParams}</h3>
                    
                    {(selectedItem.gen.prompts?.[selectedItem.index] || selectedItem.gen.prompt) && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-zinc-500 mb-2">{t.gallery.prompt}</p>
                        <div className="bg-zinc-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <pre className="text-[11px] text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
                            {selectedItem.gen.prompts?.[selectedItem.index] || selectedItem.gen.prompt}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        {/* 多商品图（outfit模式）优先显示 */}
                        {selectedItem.gen.params?.productImages && selectedItem.gen.params.productImages.length > 0 ? (
                          selectedItem.gen.params.productImages.map((productUrl: string, idx: number) => (
                            <div key={idx} className="flex flex-col items-center">
                              <div 
                                className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                onClick={() => setFullscreenImage(productUrl)}
                              >
                                <Image 
                                  src={productUrl} 
                                  alt={`${t.gallery.productOriginal} ${idx + 1}`} 
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-1">{t.gallery.productOriginal}{idx + 1}</p>
                            </div>
                          ))
                        ) : selectedItem.gen.inputImageUrl && (
                          <div className="flex flex-col items-center">
                            <div 
                              className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                              onClick={() => setFullscreenImage(selectedItem.gen.inputImageUrl)}
                            >
                              <Image 
                                src={selectedItem.gen.inputImageUrl} 
                                alt={t.gallery.productOriginal} 
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">{t.gallery.productOriginal}</p>
                          </div>
                        )}
                        
                        {/* Model Image - use per-image data if available, fallback to first element or params or direct field */}
                        {(() => {
                          // 优先使用当前 index 的数据，如果没有则 fallback 到 index 0（所有图片共用同一个模特信息）
                          const perImageModel = selectedItem.gen.params?.perImageModels?.[selectedItem.index] 
                            || selectedItem.gen.params?.perImageModels?.[0]
                          // Pro Studio 使用 modelUrl，其他模式使用 modelImage
                          const modelUrl = perImageModel?.imageUrl || selectedItem.gen.params?.modelImage || (selectedItem.gen.params as any)?.modelUrl || selectedItem.gen.modelImageUrl
                          const rawModelName = perImageModel?.name || selectedItem.gen.params?.model
                          // Pro Studio 使用 modelIsAI 表示 AI 选择的模特
                          const modelIsRandom = perImageModel?.isRandom === true || (selectedItem.gen.params as any)?.modelIsRandom === true || (selectedItem.gen.params as any)?.modelIsAI === true || rawModelName?.includes('(随机)') || rawModelName?.includes('随机')
                          const modelIsPreset = perImageModel?.isPreset === true || (selectedItem.gen.params as any)?.modelIsPreset === true || modelUrl?.includes('/presets/') || modelUrl?.includes('presets%2F')
                          const modelName = rawModelName?.replace(' (随机)', '').replace('(随机)', '').replace('随机', '') || t.common.model
                          
                          // 三种状态：随机 / 官方预设 / 用户上传
                          const getSourceLabel = () => {
                            if (modelIsRandom) return { text: t.common.random || '随机', color: 'bg-amber-100 text-amber-600' }
                            if (modelIsPreset) return { text: t.gallery.officialPreset || '官方预设', color: 'bg-purple-100 text-purple-600' }
                            return { text: t.gallery.userUploaded || '用户上传', color: 'bg-blue-100 text-blue-600' }
                          }
                          const sourceLabel = getSourceLabel()
                          
                          // 如果没有图片 URL 但是是随机模式，显示"随机"占位符
                          if (!modelUrl && modelIsRandom) {
                            return (
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-200 flex items-center justify-center">
                                  <span className="text-[10px] text-zinc-500">{t.common.random || '随机'}</span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                  {t.common.model}
                                </p>
                                <span className={`text-[8px] px-1 py-0.5 rounded ${sourceLabel.color}`}>
                                  {sourceLabel.text}
                                </span>
                              </div>
                            )
                          }
                          
                          // 如果没有图片 URL 也不是随机，不显示
                          if (!modelUrl) return null
                          
                          return (
                            <div className="flex flex-col items-center">
                              <div 
                                className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                onClick={() => setFullscreenImage(modelUrl)}
                              >
                                <img 
                                  src={modelUrl} 
                                  alt={t.common.model} 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                {modelName}
                              </p>
                              <span className={`text-[8px] px-1 py-0.5 rounded ${sourceLabel.color}`}>
                                {sourceLabel.text}
                              </span>
                            </div>
                          )
                        })()}
                        
                        {/* Background Image - use per-image data if available, fallback to first element or params or direct field */}
                        {(() => {
                          // 优先使用当前 index 的数据，如果没有则 fallback 到 index 0（所有图片共用同一个背景信息）
                          const perImageBg = selectedItem.gen.params?.perImageBackgrounds?.[selectedItem.index]
                            || selectedItem.gen.params?.perImageBackgrounds?.[0]
                          // Pro Studio 使用 sceneUrl，其他模式使用 backgroundImage
                          const bgUrl = perImageBg?.imageUrl || selectedItem.gen.params?.backgroundImage || (selectedItem.gen.params as any)?.sceneUrl || selectedItem.gen.backgroundImageUrl
                          const rawBgName = perImageBg?.name || selectedItem.gen.params?.background
                          // Pro Studio 使用 sceneIsAI 表示 AI 选择的背景
                          const bgIsRandom = perImageBg?.isRandom === true || (selectedItem.gen.params as any)?.bgIsRandom === true || (selectedItem.gen.params as any)?.sceneIsAI === true || rawBgName?.includes('(随机)') || rawBgName?.includes('随机')
                          const bgIsPreset = perImageBg?.isPreset === true || (selectedItem.gen.params as any)?.bgIsPreset === true || bgUrl?.includes('/presets/') || bgUrl?.includes('presets%2F')
                          const bgName = rawBgName?.replace(' (随机)', '').replace('(随机)', '').replace('随机', '') || t.common.background
                          
                          // 三种状态：随机 / 官方预设 / 用户上传
                          const getSourceLabel = () => {
                            if (bgIsRandom) return { text: t.common.random || '随机', color: 'bg-amber-100 text-amber-600' }
                            if (bgIsPreset) return { text: t.gallery.officialPreset || '官方预设', color: 'bg-purple-100 text-purple-600' }
                            return { text: t.gallery.userUploaded || '用户上传', color: 'bg-blue-100 text-blue-600' }
                          }
                          const sourceLabel = getSourceLabel()
                          
                          // 如果没有图片 URL 但是是随机模式，显示"随机"占位符
                          if (!bgUrl && bgIsRandom) {
                            return (
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-200 flex items-center justify-center">
                                  <span className="text-[10px] text-zinc-500">{t.common.random || '随机'}</span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                  {t.common.background}
                                </p>
                                <span className={`text-[8px] px-1 py-0.5 rounded ${sourceLabel.color}`}>
                                  {sourceLabel.text}
                                </span>
                              </div>
                            )
                          }
                          
                          // 如果没有图片 URL 也不是随机，不显示
                          if (!bgUrl) return null
                          
                          return (
                            <div className="flex flex-col items-center">
                              <div 
                                className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                onClick={() => setFullscreenImage(bgUrl)}
                              >
                                <img 
                                  src={bgUrl} 
                                  alt={t.common.background} 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                {bgName}
                              </p>
                              <span className={`text-[8px] px-1 py-0.5 rounded ${sourceLabel.color}`}>
                                {sourceLabel.text}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                      
                      {/* Model Version (AI Model used) */}
                      {selectedItem.gen.outputModelTypes?.[selectedItem.index] && (
                        <div className="mb-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                            selectedItem.gen.outputModelTypes[selectedItem.index] === 'pro' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {t.gallery.aiModel}: {selectedItem.gen.outputModelTypes[selectedItem.index] === 'pro' ? t.gallery.geminiPro : t.gallery.geminiFlash}
                            {selectedItem.gen.outputModelTypes[selectedItem.index] === 'flash' && ` ${t.gallery.fallback}`}
                          </span>
                          {selectedItem.gen.outputGenModes?.[selectedItem.index] && (
                            <span className={`ml-2 px-2 py-1 rounded text-[10px] font-medium ${
                              selectedItem.gen.outputGenModes[selectedItem.index] === 'simple'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {selectedItem.gen.outputGenModes[selectedItem.index] === 'simple' ? t.gallery.simpleMode : t.gallery.extendedMode}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {selectedItem.gen.params && (
                        <div className="flex gap-2 flex-wrap">
                          {selectedItem.gen.params.modelStyle && selectedItem.gen.params.modelStyle !== 'auto' && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                              {t.gallery.styleLabel}: {selectedItem.gen.params.modelStyle === 'korean' ? t.gallery.styleKorean : 
                                     selectedItem.gen.params.modelStyle === 'western' ? t.gallery.styleWestern : selectedItem.gen.params.modelStyle}
                            </span>
                          )}
                          {selectedItem.gen.params.modelGender && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                              {t.gallery.genderLabel}: {selectedItem.gen.params.modelGender === 'male' ? t.gallery.genderMale : 
                                     selectedItem.gen.params.modelGender === 'female' ? t.gallery.genderFemale : 
                                     selectedItem.gen.params.modelGender === 'boy' ? t.gallery.genderBoy : t.gallery.genderGirl}
                            </span>
                          )}
                          {selectedItem.gen.params.lightType && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                              {t.gallery.lightType}: {selectedItem.gen.params.lightType}
                            </span>
                          )}
                          {selectedItem.gen.params.lightDirection && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                              {t.gallery.lightDirection}: {selectedItem.gen.params.lightDirection}
                            </span>
                          )}
                          {selectedItem.gen.params.lightColor && selectedItem.gen.params.lightColor !== '#FFFFFF' && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600 flex items-center gap-1">
                              {t.gallery.bgColor}: 
                              <span 
                                className="w-3 h-3 rounded-full border border-zinc-300 inline-block" 
                                style={{ backgroundColor: selectedItem.gen.params.lightColor }}
                              />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Save Menu */}
            <AnimatePresence>
              {showSaveMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 flex items-end justify-center z-10"
                  onClick={() => setShowSaveMenu(false)}
                >
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="bg-white rounded-t-2xl w-full max-w-lg p-4 pb-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />
                    <h3 className="font-semibold text-zinc-900 text-center mb-4">{t.common.save}</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleSaveAsAsset('product')}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-zinc-900">{t.gallery.saveAsProduct}</p>
                          <p className="text-xs text-zinc-500">可在拍摄时选择使用</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSaveAsAsset('model')}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-zinc-900">{t.gallery.saveAsModel}</p>
                          <p className="text-xs text-zinc-500">{t.gallery.savedToModels}</p>
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={() => setShowSaveMenu(false)}
                      className="w-full mt-4 p-3 text-zinc-500 font-medium"
                    >
                      取消
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Delete Confirmation */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    className="bg-white rounded-2xl w-full max-w-sm p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-center mb-2">确认删除？</h3>
                    <p className="text-sm text-zinc-500 text-center mb-6">
                      删除后将无法恢复，同一批次生成的所有图片都会被删除
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 h-11 rounded-lg border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 h-11 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Save Success Toast */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center"
          >
            <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-medium">{saveSuccess}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          >
            {/* Top bar with close and download buttons */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
              <div /> {/* Spacer */}
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!fullscreenImage) return
                    // 检测是否是 iOS
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
                    try {
                      const response = await fetch(fullscreenImage)
                      const blob = await response.blob()
                      const file = new File([blob], `brand-camera-${Date.now()}.png`, { type: 'image/png' })
                      
                      // 只有 iOS 使用系统分享，Android 直接下载
                      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                        })
                      } else {
                        // 直接下载
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = file.name
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }
                    } catch (e: any) {
                      // 用户取消分享不算错误
                      if (e.name !== 'AbortError') {
                        console.error('Share/Download failed:', e)
                      }
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setFullscreenImage(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
            
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
            >
              {() => (
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full flex items-center justify-center"
                  >
                    {/* Use img tag for native long-press save support */}
                    <img
                      src={fullscreenImage}
                      alt="Fullscreen"
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />
                  </motion.div>
                </TransformComponent>
              )}
            </TransformWrapper>
            
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">{t.imageActions.pinchToZoom}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Single image slot card - shows individual image status
function ImageSlotCard({ task, slot, slotIndex, galleryItemsMap, onImageClick, onOpenDetail }: { 
  task: GenerationTask; 
  slot: ImageSlot; 
  slotIndex: number;
  galleryItemsMap?: Record<string, Generation>;
  onImageClick?: (imageUrl: string) => void;
  onOpenDetail?: (gen: Generation, index: number) => void;
}) {
  const { t } = useTranslation()
  const { generations, favorites, addFavorite, removeFavorite, isFavorited } = useAssetStore()
  
  // 防御性检查：如果必要数据不存在，显示 loading 状态
  if (!task || !slot) {
    return (
      <div className="aspect-[4/5] bg-zinc-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    )
  }
  const isStudio = task.type === 'studio'
  const isEdit = task.type === 'edit'
  
  // 检查图片 URL 是否有效（排除占位符和 blob URL 刷新后失效的情况）
  const hasValidImageUrl = slot.imageUrl && 
    !slot.imageUrl.startsWith('[') && 
    (slot.imageUrl.startsWith('http') || slot.imageUrl.startsWith('blob:') || slot.imageUrl.startsWith('data:'))
  
  // 【方案 E】多数据源查找 Generation 记录
  // 1. 优先从 generations store 查找（最权威）
  const generationFromStore = generations.find(g => g.id === task.id)
  // 2. 其次从 galleryItems 查找（API 返回的数据，3 秒刷新）
  const generationFromApi = galleryItemsMap?.[task.id]
  // 3. 如果都没有，构建临时对象（让用户能立即点击）
  const tempGeneration: Generation | null = (!generationFromStore && !generationFromApi && slot.status === 'completed' && hasValidImageUrl) ? {
    id: task.id,
    dbId: task.id,
    type: task.type,
    outputImageUrls: task.imageSlots?.map(s => s.imageUrl || '').filter(Boolean) || [slot.imageUrl!],
    outputModelTypes: task.imageSlots?.map(s => s.modelType).filter(Boolean) || (slot.modelType ? [slot.modelType] : []),
    outputGenModes: task.imageSlots?.map(s => s.genMode).filter(Boolean) || (slot.genMode ? [slot.genMode] : []),
    createdAt: task.createdAt || new Date().toISOString(),
    params: task.params,
    inputImageUrl: task.inputImageUrl,
    // 标记这是临时对象，详情页可能数据不完整
    _isTemp: true,
  } as Generation : null
  
  // 合并使用：优先级 store > api > temp
  const generationRecord = generationFromStore || generationFromApi || tempGeneration
  const imageUrlInDb = generationRecord?.outputImageUrls?.[slotIndex]
  const canFavorite = !!(generationFromStore || generationFromApi) && !!imageUrlInDb // 临时对象不能收藏
  
  // 检查当前图片是否已收藏
  const favoriteImageUrl = imageUrlInDb || slot.imageUrl
  const isImageFavorited = generationRecord ? isFavorited(generationRecord.id, slotIndex) : false
  
  // 收藏/取消收藏
  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canFavorite || !favoriteImageUrl || !generationRecord) return
    
    if (isImageFavorited) {
      // 找到对应的 favorite 记录并删除
      const fav = favorites.find(
        f => f.generationId === generationRecord.id && f.imageIndex === slotIndex
      )
      if (fav) {
        removeFavorite(fav.id)
      }
    } else {
      addFavorite({
        generationId: generationRecord.id,
        imageIndex: slotIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  // 已完成且有有效图片，显示可点击的结果卡片
  // 现在包括：store 数据、API 数据、临时对象
  if (slot.status === 'completed' && hasValidImageUrl && generationRecord) {
    const handleClick = () => {
      if (onOpenDetail) {
        onOpenDetail(generationRecord, slotIndex)
      }
    }
    
    // 判断是否是临时对象（还没有真实数据库记录）
    const isTempRecord = !generationFromStore && !generationFromApi
    
    return (
      <div 
        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm cursor-pointer"
        onClick={handleClick}
      >
        <Image 
          src={imageUrlInDb || slot.imageUrl!} 
          alt={`Generated ${slotIndex + 1}`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        {/* 显示模型类型和生成模式标签 */}
        <div className="absolute top-2 left-2 flex gap-1">
          {slot.modelType && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
              slot.modelType === 'pro' 
                ? 'bg-green-500 text-white' 
                : 'bg-orange-500 text-white'
            }`}>
              {slot.modelType === 'pro' ? 'Pro' : 'Flash'}
            </span>
          )}
          {slot.genMode && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
              slot.genMode === 'simple' 
                ? 'bg-blue-500 text-white' 
                : 'bg-purple-500 text-white'
            }`}>
              {slot.genMode === 'simple' ? '极简' : '扩展'}
            </span>
          )}
        </div>
        {/* 收藏按钮 - 临时对象显示加载状态 */}
        {isTempRecord ? (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/70 backdrop-blur flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <button 
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
              isImageFavorited 
                ? 'bg-red-500 text-white' 
                : 'bg-white/70 backdrop-blur text-zinc-400 hover:text-red-500'
            }`}
            onClick={handleFavorite}
          >
            <Heart className={`w-4 h-4 ${isImageFavorited ? 'fill-current' : ''}`} />
          </button>
        )}
        {/* Date overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-[10px] text-white truncate">
            {new Date(generationRecord.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    )
  }
  
  // 已完成有图片但还没同步到数据库，直接显示结果卡片（收藏按钮显示加载状态）
  if (slot.status === 'completed' && hasValidImageUrl && !generationRecord) {
    return (
      <div 
        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm cursor-pointer"
        onClick={() => onImageClick?.(slot.imageUrl!)}
      >
        <Image 
          src={slot.imageUrl!} 
          alt={`Generated ${slotIndex + 1}`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        {/* 显示模型类型和生成模式标签 */}
        <div className="absolute top-2 left-2 flex gap-1">
          {slot.modelType && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
              slot.modelType === 'pro' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {slot.modelType === 'pro' ? 'Pro' : 'Flash'}
            </span>
          )}
          {slot.genMode && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
              slot.genMode === 'simple' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
            }`}>
              {slot.genMode === 'simple' ? '极简' : '扩展'}
            </span>
          )}
        </div>
        {/* 收藏按钮 - 显示加载状态 */}
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/70 backdrop-blur flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
        </div>
      </div>
    )
  }
  
  // 已完成但图片丢失（刷新后 blob URL 失效），显示"同步中"状态
  if (slot.status === 'completed' && !hasValidImageUrl) {
    return (
      <div className="relative aspect-[4/5] bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl overflow-hidden shadow-sm border-2 border-dashed border-green-300">
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center mb-2">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xs text-green-700 font-medium">{t.gallery.syncing || '同步中...'}</p>
          <p className="text-[10px] text-green-600 mt-1">{(t.gallery.imageIndex || 'Image {index}').replace('{index}', String(slotIndex + 1))}</p>
        </div>
        {/* 标签 */}
        <div className="absolute top-2 left-2 flex gap-1">
          {slot.modelType && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
              slot.modelType === 'pro' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {slot.modelType === 'pro' ? 'Pro' : 'Flash'}
            </span>
          )}
        </div>
      </div>
    )
  }
  
  // 如果失败，显示错误
  if (slot.status === 'failed') {
    return (
      <div className="relative aspect-[4/5] bg-gradient-to-br from-red-50 to-red-100 rounded-xl overflow-hidden shadow-sm border-2 border-dashed border-red-300">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center mb-2">
            <X className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-xs text-red-600 text-center font-medium">生成失败</p>
          {slot.error && (
            <p className="text-[10px] text-red-500 text-center mt-1 line-clamp-2">{slot.error}</p>
          )}
        </div>
        {/* 序号 */}
        <div className="absolute top-2 left-2">
          <span className="px-1.5 py-0.5 text-[9px] rounded font-medium bg-red-500 text-white">
            #{slotIndex + 1}
          </span>
        </div>
      </div>
    )
  }
  
  // pending 或 generating 状态，显示 loading
  const bgGradient = isStudio 
    ? 'from-amber-100 to-orange-100' 
    : isEdit 
      ? 'from-purple-100 to-pink-100'
      : 'from-blue-100 to-purple-100'
  
  const borderColor = isStudio 
    ? 'border-amber-300' 
    : isEdit 
      ? 'border-purple-300'
      : 'border-blue-300'
  
  const spinnerColor = isStudio 
    ? 'text-amber-600' 
    : isEdit 
      ? 'text-purple-600'
      : 'text-blue-600'
  
  const textColor = isStudio 
    ? 'text-amber-700' 
    : isEdit 
      ? 'text-purple-700'
      : 'text-blue-700'
  
  return (
    <div className={`relative aspect-[4/5] bg-gradient-to-br ${bgGradient} rounded-xl overflow-hidden shadow-sm border-2 border-dashed ${borderColor}`}>
      {/* 背景模糊的输入图 */}
      {task.inputImageUrl && task.inputImageUrl !== '[base64]' && (
        <div className="absolute inset-0 opacity-30">
          <Image 
            src={task.inputImageUrl} 
            alt="Input" 
            fill 
            className="object-cover blur-sm" 
          />
        </div>
      )}
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Loading 动画 */}
        <div className="relative mb-2">
          <div className={`absolute inset-0 rounded-full ${spinnerColor.replace('text-', 'bg-')}/20 animate-ping`} />
          <Loader2 className={`w-8 h-8 ${spinnerColor} animate-spin`} />
        </div>
        
        <p className={`text-sm font-medium ${textColor}`}>
          {slot.status === 'generating' ? (t.gallery.generating || 'Generating...') : (t.common.waiting || '等待中...')}
        </p>
        <p className={`text-xs ${textColor} opacity-70 mt-1`}>
          {(t.gallery.imageIndex || 'Image {index}').replace('{index}', String(slotIndex + 1))}
        </p>
      </div>
      
      {/* 序号标签 */}
      <div className="absolute top-2 left-2">
        <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
          isStudio ? 'bg-amber-500' : isEdit ? 'bg-purple-500' : 'bg-blue-500'
        } text-white`}>
          #{slotIndex + 1}
        </span>
      </div>
    </div>
  )
}

// Pending task card - for tasks from database that are still generating
function PendingTaskCard({ taskType, index, total }: { taskType: string; index: number; total: number }) {
  const { t } = useTranslation()
  const isStudio = taskType === 'studio' || taskType === 'product_studio'
  const isEdit = taskType === 'edit' || taskType === 'editing'
  
  const bgGradient = isStudio 
    ? 'from-amber-100 to-orange-100' 
    : isEdit 
      ? 'from-purple-100 to-pink-100'
      : 'from-blue-100 to-purple-100'
  
  const borderColor = isStudio 
    ? 'border-amber-300' 
    : isEdit 
      ? 'border-purple-300'
      : 'border-blue-300'
  
  const pulseColor = isStudio 
    ? 'bg-amber-400' 
    : isEdit 
      ? 'bg-purple-400'
      : 'bg-blue-400'
  
  const textColor = isStudio 
    ? 'text-amber-600' 
    : isEdit 
      ? 'text-purple-600'
      : 'text-blue-600'
  
  return (
    <div className={`relative aspect-[4/5] bg-gradient-to-br ${bgGradient} rounded-xl overflow-hidden shadow-sm border-2 border-dashed ${borderColor}`}>
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-0.5 ${pulseColor} text-white text-[10px] rounded-full`}>
          #{index + 1}
        </span>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Loader2 className={`w-8 h-8 ${textColor} animate-spin mb-2`} />
        <p className={`text-xs ${textColor} font-medium`}>{t.gallery.generating || 'Generating...'}</p>
        <p className={`text-[10px] ${textColor} opacity-70 mt-1`}>{(t.gallery.imageOfTotal || 'Image {current} / {total}').replace('{current}', String(index + 1)).replace('{total}', String(total))}</p>
      </div>
    </div>
  )
}

// Generating card component (legacy - for tasks without imageSlots)
function GeneratingCard({ task }: { task: GenerationTask }) {
  const { t } = useTranslation()
  const isStudio = task.type === 'studio'
  const isEdit = task.type === 'edit'
  
  const bgGradient = isStudio 
    ? 'from-amber-100 to-orange-100' 
    : isEdit 
      ? 'from-purple-100 to-pink-100'
      : 'from-blue-100 to-purple-100'
  
  const borderColor = isStudio 
    ? 'border-amber-300' 
    : isEdit 
      ? 'border-purple-300'
      : 'border-blue-300'
  
  const pulseColor = isStudio 
    ? 'bg-amber-500/20' 
    : isEdit 
      ? 'bg-purple-500/20'
      : 'bg-blue-500/20'
  
  const spinnerColor = isStudio 
    ? 'text-amber-600' 
    : isEdit 
      ? 'text-purple-600'
      : 'text-blue-600'
  
  const textColor = isStudio 
    ? 'text-amber-700' 
    : isEdit 
      ? 'text-purple-700'
      : 'text-blue-700'
  
  const subTextColor = isStudio 
    ? 'text-amber-500' 
    : isEdit 
      ? 'text-purple-500'
      : 'text-blue-500'
  
  const badgeColor = isStudio 
    ? 'bg-amber-500' 
    : isEdit 
      ? 'bg-purple-500'
      : 'bg-blue-500'
  
  const title = isStudio 
    ? t.studio.generating
    : isEdit 
      ? t.edit.processing
      : t.camera.generating
  
  // Get expected image count, fallback to defaults
  const imageCount = task.expectedImageCount || (isStudio ? 2 : isEdit ? 1 : 6)
  
  const subtitle = isStudio 
    ? `${t.gallery.generatingImages} ${imageCount} ${t.gallery.productImages}` 
    : isEdit 
      ? t.gallery.processingImage
      : `${t.gallery.generatingImages} ${imageCount} ${t.gallery.modelImages}`
  
  const badgeText = isStudio 
    ? t.home.productStudio
    : isEdit 
      ? t.edit.editRoom
      : t.home.modelStudio
  
  return (
    <div className={`relative aspect-[4/5] bg-gradient-to-br ${bgGradient} rounded-xl overflow-hidden shadow-sm border-2 border-dashed ${borderColor}`}>
      {task.inputImageUrl && task.inputImageUrl !== '[base64]' && (
        <div className="absolute inset-0 opacity-30">
          <Image 
            src={task.inputImageUrl} 
            alt="Generating" 
            fill 
            className="object-cover blur-sm" 
          />
        </div>
      )}
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative mb-3">
          <div className={`absolute inset-0 ${pulseColor} blur-lg rounded-full animate-pulse`} />
          <Loader2 className={`w-10 h-10 ${spinnerColor} animate-spin relative z-10`} />
        </div>
        <span className={`${textColor} font-semibold text-sm`}>{title}</span>
        <span className={`${subTextColor} text-xs mt-1`}>{subtitle}</span>
      </div>
      
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-1 rounded text-[10px] font-medium ${badgeColor} text-white animate-pulse`}>
          {badgeText}
        </span>
      </div>
    </div>
  )
}
