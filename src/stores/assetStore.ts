import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Asset, AssetType, Generation, Collection, Favorite } from '@/types'
import { indexedDBStorage, dbPut, dbGet, dbGetAll, dbDelete, STORES, saveImage } from '@/lib/indexeddb'
import { generateId } from '@/lib/utils'
import * as syncService from '@/lib/supabase/syncService'

interface AssetState {
  // System presets
  presetModels: Asset[]
  presetBackgrounds: Asset[]
  presetVibes: Asset[]
  
  // User assets
  userModels: Asset[]
  userBackgrounds: Asset[]
  userProducts: Asset[]
  userVibes: Asset[]
  
  // Pinned preset IDs (for official presets)
  pinnedPresetIds: Set<string>
  
  // Generations
  generations: Generation[]
  
  // Collections
  collections: Collection[]
  favorites: Favorite[]
  
  // Sync status
  isSyncing: boolean
  isInitialLoading: boolean  // 首次加载状态，用于显示骨架屏
  lastSyncAt: string | null
  currentUserId: string | null
  
  // Hydration status
  _hasHydrated: boolean
  _hasLoadedFromDB: boolean
  setHasHydrated: (state: boolean) => void
  
  // Actions
  setPresetModels: (models: Asset[]) => void
  setPresetBackgrounds: (backgrounds: Asset[]) => void
  setPresetVibes: (vibes: Asset[]) => void
  setUserModels: (models: Asset[]) => void
  setUserBackgrounds: (backgrounds: Asset[]) => void
  setUserProducts: (products: Asset[]) => void
  setUserVibes: (vibes: Asset[]) => void
  
  // Add single asset
  addUserAsset: (asset: Asset) => Promise<void>
  
  // Delete single asset
  deleteUserAsset: (type: AssetType, id: string) => Promise<void>
  
  // Pin actions
  togglePin: (type: AssetType, id: string) => Promise<void>
  togglePresetPin: (id: string) => Promise<void>
  isPresetPinned: (id: string) => boolean
  
  // Generation actions with IndexedDB persistence
  addGeneration: (generation: Generation, skipCloudSync?: boolean) => Promise<void>
  setGenerations: (generations: Generation[]) => void
  deleteGeneration: (id: string) => Promise<void>
  deleteGenerationImage: (generationId: string, imageIndex: number) => Promise<void>
  
  // Collection actions
  addCollection: (collection: Collection) => void
  setCollections: (collections: Collection[]) => void
  deleteCollection: (id: string) => void
  
  // Favorite actions with IndexedDB persistence
  addFavorite: (favorite: Omit<Favorite, 'id'>) => Promise<void>
  removeFavorite: (id: string) => Promise<void>
  setFavorites: (favorites: Favorite[]) => void
  isFavorited: (generationId: string, imageIndex: number) => boolean
  
  // Load data from IndexedDB on init
  loadFromDB: () => Promise<void>
  
  // Cloud sync
  setCurrentUserId: (userId: string | null) => void
  syncWithCloud: (userId: string) => Promise<void>
  loadMoreGenerations: () => Promise<void>
  clearUserData: () => void
  
  // Pagination state
  generationsPage: number
  hasMoreGenerations: boolean
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      presetModels: [],
      presetBackgrounds: [],
      presetVibes: [],
      userModels: [],
      userBackgrounds: [],
      userProducts: [],
      userVibes: [],
      pinnedPresetIds: new Set<string>(),
      generations: [],
      collections: [],
      favorites: [],
      isSyncing: false,
      isInitialLoading: true,  // 默认 true，加载完成后设为 false
      lastSyncAt: null,
      currentUserId: null,
      generationsPage: 0,
      hasMoreGenerations: false,
      
      _hasHydrated: false,
      _hasLoadedFromDB: false, // Prevent duplicate loadFromDB calls
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      setPresetModels: (models) => set({ presetModels: models }),
      setPresetBackgrounds: (backgrounds) => set({ presetBackgrounds: backgrounds }),
      setPresetVibes: (vibes) => set({ presetVibes: vibes }),
      setUserModels: (models) => set({ userModels: models }),
      setUserBackgrounds: (backgrounds) => set({ userBackgrounds: backgrounds }),
      setUserProducts: (products) => set({ userProducts: products }),
      setUserVibes: (vibes) => set({ userVibes: vibes }),
      
      // Set current user ID
      setCurrentUserId: (userId) => set({ currentUserId: userId }),
      
      // Add single asset to appropriate collection
      addUserAsset: async (asset) => {
        const { currentUserId } = get()
        
        console.log('[Asset] Adding user asset:', asset.type, asset.id, 'currentUserId:', currentUserId)
        
        // Update local state
        switch (asset.type) {
          case 'model':
            set((state) => ({ userModels: [asset, ...state.userModels] }))
            break
          case 'background':
            set((state) => ({ userBackgrounds: [asset, ...state.userBackgrounds] }))
            break
          case 'product':
            set((state) => ({ userProducts: [asset, ...state.userProducts] }))
            break
          case 'vibe':
            set((state) => ({ userVibes: [asset, ...state.userVibes] }))
            break
        }
        
        // Sync to cloud if logged in
        if (currentUserId) {
          console.log('[Asset] Syncing to cloud for user:', currentUserId)
          const result = await syncService.saveUserAsset(currentUserId, asset)
          console.log('[Asset] Sync result:', result ? 'success' : 'failed')
        } else {
          console.warn('[Asset] Not syncing - no currentUserId')
        }
      },
      
      // Delete single asset from appropriate collection
      deleteUserAsset: async (type, id) => {
        const { currentUserId } = get()
        
        console.log('[Asset] Deleting user asset:', type, id, 'currentUserId:', currentUserId)
        
        // Update local state
        switch (type) {
          case 'model':
            set((state) => ({ userModels: state.userModels.filter(a => a.id !== id) }))
            break
          case 'background':
            set((state) => ({ userBackgrounds: state.userBackgrounds.filter(a => a.id !== id) }))
            break
          case 'product':
            set((state) => ({ userProducts: state.userProducts.filter(a => a.id !== id) }))
            break
          case 'vibe':
            set((state) => ({ userVibes: state.userVibes.filter(a => a.id !== id) }))
            break
        }
        
        // Sync to cloud if logged in
        if (currentUserId) {
          console.log('[Asset] Deleting from cloud for user:', currentUserId)
          const result = await syncService.deleteUserAsset(currentUserId, id)
          console.log('[Asset] Delete sync result:', result ? 'success' : 'failed')
        } else {
          console.warn('[Asset] Not syncing delete - no currentUserId')
        }
      },
      
      // Toggle pin for user assets
      togglePin: async (type, id) => {
        const { currentUserId } = get()
        let newPinState = false
        
        const updateAssets = (assets: Asset[]) =>
          assets.map(a => {
            if (a.id === id) {
              newPinState = !a.isPinned
              return { ...a, isPinned: newPinState }
            }
            return a
          })
        
        switch (type) {
          case "model":
            set((state) => ({ userModels: updateAssets(state.userModels) }))
            break
          case "background":
            set((state) => ({ userBackgrounds: updateAssets(state.userBackgrounds) }))
            break
          case "product":
            set((state) => ({ userProducts: updateAssets(state.userProducts) }))
            break
          case "vibe":
            set((state) => ({ userVibes: updateAssets(state.userVibes) }))
            break
        }
        
        // Sync to cloud if logged in
        if (currentUserId) {
          await syncService.updateUserAssetPin(currentUserId, id, newPinState)
        }
      },
      
      // Toggle pin for preset assets
      togglePresetPin: async (id) => {
        const { currentUserId, pinnedPresetIds } = get()
        const wasPinned = pinnedPresetIds.has(id)
        
        set((state) => {
          const newPinnedIds = new Set(state.pinnedPresetIds)
          if (newPinnedIds.has(id)) {
            newPinnedIds.delete(id)
          } else {
            newPinnedIds.add(id)
          }
          return { pinnedPresetIds: newPinnedIds }
        })
        
        // Sync to cloud if logged in
        if (currentUserId) {
          await syncService.togglePinnedPreset(currentUserId, id, !wasPinned)
        }
      },
      
      // Check if preset is pinned
      isPresetPinned: (id) => {
        return get().pinnedPresetIds.has(id)
      },
      
      // Generation with IndexedDB and cloud sync
      // skipCloudSync: 如果后端已经写入数据库，跳过前端的云端同步
      addGeneration: async (generation, skipCloudSync = false) => {
        const { currentUserId } = get()
        
        console.log('[Store] Adding generation, currentUserId:', currentUserId, 'generationId:', generation.id, 'skipCloudSync:', skipCloudSync)
        
        // 1. 立即更新内存状态（用户立即可见）
        set((state) => ({ 
          generations: [generation, ...state.generations] 
        }))
        console.log('[Store] Generation added to memory state')
        
        // 2. 后台异步保存到 IndexedDB（和云端，除非 skipCloudSync）
        // 使用 setTimeout 确保不阻塞 UI
        setTimeout(async () => {
          try {
            // Save images to IndexedDB (for offline/local cache)
            const savedOutputUrls: string[] = []
            for (let i = 0; i < generation.outputImageUrls.length; i++) {
              try {
                const imageId = `${generation.id}_output_${i}`
                await saveImage(imageId, generation.outputImageUrls[i])
                savedOutputUrls.push(imageId)
              } catch (e) {
                console.warn(`[Store] Failed to save output image ${i} to IndexedDB:`, e)
              }
            }
            
            // Save input image
            const inputImageId = `${generation.id}_input`
            try {
              await saveImage(inputImageId, generation.inputImageUrl)
            } catch (e) {
              console.warn('[Store] Failed to save input image to IndexedDB:', e)
            }
            
            // Store generation metadata with image references
            const genToStore = {
              ...generation,
              inputImageRef: inputImageId,
              outputImageRefs: savedOutputUrls,
            }
            try {
              await dbPut(STORES.GENERATIONS, genToStore)
              console.log('[Store] Generation saved to IndexedDB')
            } catch (e) {
              console.warn('[Store] Failed to save generation to IndexedDB:', e)
            }
            
            // Sync to cloud (除非 skipCloudSync，表示后端已经写入)
            if (skipCloudSync) {
              console.log('[Store] Skipping cloud sync - backend already saved')
              return
            }
            
            if (currentUserId) {
              console.log('[Store] Syncing generation to cloud for user:', currentUserId)
              try {
                const result = await syncService.saveGeneration(currentUserId, generation)
                if (result) {
                  console.log('[Store] Generation sync success, cloud ID:', result.id)
                  // 如果云端返回了不同的 ID，更新内存状态
                  if (result.id !== generation.id) {
                    set((state) => ({
                      generations: state.generations.map(g => 
                        g.id === generation.id ? { ...g, id: result.id } : g
                      )
                    }))
                  }
                } else {
                  console.warn('[Store] Generation sync failed, data remains local')
                }
              } catch (e) {
                console.error('[Store] Error syncing to cloud:', e)
              }
            } else {
              console.warn('[Store] Not syncing generation - no currentUserId')
            }
          } catch (e) {
            console.error('[Store] Error in background save:', e)
          }
        }, 0)
      },
      
      setGenerations: (generations) => set({ generations }),
      
      deleteGeneration: async (id) => {
        const { currentUserId } = get()
        
        await dbDelete(STORES.GENERATIONS, id)
        set((state) => ({
          generations: state.generations.filter(g => g.id !== id)
        }))
        
        // Sync to cloud if logged in
        if (currentUserId) {
          await syncService.deleteGeneration(currentUserId, id)
        }
      },
      
      // Delete a single image from a generation
      deleteGenerationImage: async (generationId, imageIndex) => {
        const { currentUserId, generations } = get()
        
        const generation = generations.find(g => g.id === generationId)
        if (!generation) return
        
        const newOutputUrls = [...(generation.outputImageUrls || [])]
        newOutputUrls.splice(imageIndex, 1)
        
        // If no images left, delete the whole generation
        if (newOutputUrls.length === 0) {
          await get().deleteGeneration(generationId)
          return
        }
        
        // Update with remaining images
        const updatedGeneration = {
          ...generation,
          outputImageUrls: newOutputUrls,
          // Also update related arrays if they exist
          outputModelTypes: generation.outputModelTypes?.filter((_, i) => i !== imageIndex),
          outputGenModes: generation.outputGenModes?.filter((_, i) => i !== imageIndex),
          prompts: generation.prompts?.filter((_, i) => i !== imageIndex),
        }
        
        // Update IndexedDB
        await dbPut(STORES.GENERATIONS, updatedGeneration)
        
        // Update state
        set((state) => ({
          generations: state.generations.map(g => 
            g.id === generationId ? updatedGeneration : g
          )
        }))
        
        // Sync to cloud if logged in
        if (currentUserId) {
          await syncService.updateGenerationImages(currentUserId, generationId, newOutputUrls)
        }
        
        // Also remove any favorites for this image index
        const { favorites } = get()
        const favoritesToRemove = favorites.filter(
          f => f.generationId === generationId && f.imageIndex === imageIndex
        )
        for (const fav of favoritesToRemove) {
          await get().removeFavorite(fav.id)
        }
        
        // Update favorites with shifted indices
        const favoritesToUpdate = favorites.filter(
          f => f.generationId === generationId && f.imageIndex > imageIndex
        )
        for (const fav of favoritesToUpdate) {
          // This is complex - for now just remove them
          // In a real app you'd want to update the index
          await get().removeFavorite(fav.id)
        }
      },
      
      addCollection: (collection) => set((state) => ({
        collections: [...state.collections, collection]
      })),
      
      setCollections: (collections) => set({ collections }),
      
      deleteCollection: (id) => set((state) => ({
        collections: state.collections.filter(c => c.id !== id)
      })),
      
      // Favorite with IndexedDB and cloud sync
      addFavorite: async (favoriteData) => {
        const { currentUserId } = get()
        
        console.log('[Store] Adding favorite, currentUserId:', currentUserId, 'data:', favoriteData)
        
        const favorite: Favorite = {
          ...favoriteData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        
        // Save to IndexedDB
        await dbPut(STORES.FAVORITES, favorite)
        
        set((state) => ({
          favorites: [...state.favorites, favorite]
        }))
        
        // Sync to cloud if logged in
        if (currentUserId) {
          console.log('[Store] Syncing favorite to cloud for user:', currentUserId)
          const result = await syncService.saveFavorite(currentUserId, favorite)
          console.log('[Store] Favorite sync result:', result ? 'success' : 'failed')
        } else {
          console.warn('[Store] Not syncing favorite - no currentUserId')
        }
      },
      
      removeFavorite: async (id) => {
        const { currentUserId } = get()
        
        await dbDelete(STORES.FAVORITES, id)
        set((state) => ({
          favorites: state.favorites.filter(f => f.id !== id)
        }))
        
        // Sync to cloud if logged in
        if (currentUserId) {
          await syncService.deleteFavorite(currentUserId, id)
        }
      },
      
      setFavorites: (favorites) => set({ favorites }),
      
      isFavorited: (generationId, imageIndex) => {
        const { favorites } = get()
        return favorites.some(
          f => f.generationId === generationId && f.imageIndex === imageIndex
        )
      },
      
      // 简化版：不再从 IndexedDB 加载 generations，全部依赖云端 API
      loadFromDB: async () => {
        if (get()._hasLoadedFromDB) {
          console.log('[Store] loadFromDB: already loaded, skipping')
          return
        }
        
        try {
          console.log('[Store] loadFromDB: starting initial load')
          
          // 检查是否可能有登录用户
          let hasSession = false
          if (typeof window !== 'undefined') {
            const keys = Object.keys(localStorage)
            hasSession = keys.some(key => key.startsWith('sb-') && key.includes('auth-token'))
          }
          
          if (hasSession) {
            console.log('[Store] loadFromDB: session detected, waiting for syncWithCloud')
            set({ _hasLoadedFromDB: true })
            // syncWithCloud 会处理所有数据加载
            return
          }
          
          // 未登录用户：直接标记完成，不加载任何数据
          // Gallery 页面会通过 API 获取数据，这里不需要预加载
          console.log('[Store] loadFromDB: no session, skipping (not logged in)')
          set({
            _hasLoadedFromDB: true,
            isInitialLoading: false,
          })
        } catch (error) {
          console.error('Error in loadFromDB:', error)
          set({ _hasLoadedFromDB: true, isInitialLoading: false })
        }
      },
      
      // Load more generations (pagination)
      loadMoreGenerations: async () => {
        const { currentUserId, generationsPage, hasMoreGenerations, isSyncing, generations } = get()
        
        if (!currentUserId || !hasMoreGenerations || isSyncing) {
          console.log('[Store] Cannot load more:', { currentUserId, hasMoreGenerations, isSyncing })
          return
        }
        
        const nextPage = generationsPage + 1
        console.log('[Store] Loading more generations, page:', nextPage)
        
        set({ isSyncing: true })
        
        try {
          const result = await syncService.fetchGenerations(currentUserId, nextPage)
          
          // Merge with existing generations
          const existingIds = new Set(generations.map(g => g.id))
          const newGenerations = result.generations.filter(g => !existingIds.has(g.id))
          
          // Save to IndexedDB
          for (const gen of newGenerations) {
            try {
              await dbPut(STORES.GENERATIONS, gen)
            } catch (e) {
              console.warn('[Store] Failed to save generation to IndexedDB:', gen.id)
            }
          }
          
          set({
            generations: [...generations, ...newGenerations],
            generationsPage: nextPage,
            hasMoreGenerations: result.hasMore,
            isSyncing: false,
          })
          
          console.log('[Store] Loaded', newGenerations.length, 'more generations, hasMore:', result.hasMore)
        } catch (error) {
          console.error('[Store] Failed to load more generations:', error)
          set({ isSyncing: false })
        }
      },
      
      // Sync with cloud - fetch all data from Supabase
      // 简化版：只从云端加载，不再混合 IndexedDB
      syncWithCloud: async (userId) => {
        // Always set currentUserId immediately, even if sync is skipped
        // This ensures subsequent operations can sync to cloud
        set({ currentUserId: userId })
        
        // Prevent multiple simultaneous syncs
        if (get().isSyncing) {
          console.log('[Store] Sync already in progress, skipping (but userId is set)')
          return
        }
        
        set({ isSyncing: true })
        
        const startTime = Date.now()
        
        try {
          console.log('[Sync] Starting sync for user:', userId)
          
          // 只从云端加载数据
          const cloudData = await syncService.syncAllData(userId)
          
          const duration = Date.now() - startTime
          console.log('[Sync] Cloud data received in', duration, 'ms:', {
            models: cloudData.userModels.length,
            backgrounds: cloudData.userBackgrounds.length,
            products: cloudData.userProducts.length,
            vibes: cloudData.userVibes.length,
            generations: cloudData.generations.length,
            favorites: cloudData.favorites.length,
            pinnedPresets: cloudData.pinnedPresetIds.size,
          })
          
          // 直接使用云端数据，不再混合 IndexedDB
          // Gallery 页面现在使用 API 获取数据，这里只更新资产和收藏等
          set({
            userModels: cloudData.userModels,
            userBackgrounds: cloudData.userBackgrounds,
            userProducts: cloudData.userProducts,
            userVibes: cloudData.userVibes,
            generations: cloudData.generations,
            favorites: cloudData.favorites,
            pinnedPresetIds: cloudData.pinnedPresetIds,
            lastSyncAt: new Date().toISOString(),
            isSyncing: false,
            isInitialLoading: false,  // 结束首次加载
            generationsPage: 0,
            hasMoreGenerations: cloudData.hasMoreGenerations || false,
          })
          
          console.log('[Sync] Cloud sync completed successfully')
        } catch (error) {
          console.error('[Sync] Cloud sync failed after', Date.now() - startTime, 'ms:', error)
          // Always reset isSyncing on error, also end initial loading
          set({ isSyncing: false, isInitialLoading: false, lastSyncAt: new Date().toISOString() })
        }
      },
      
      // Clear user data when logging out
      clearUserData: () => {
        set({
          userModels: [],
          userBackgrounds: [],
          userProducts: [],
          userVibes: [],
          generations: [],
          favorites: [],
          pinnedPresetIds: new Set(),
          currentUserId: null,
          lastSyncAt: null,
        })
      },
    }),
    {
      name: 'asset-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        userModels: state.userModels,
        userBackgrounds: state.userBackgrounds,
        userProducts: state.userProducts,
        userVibes: state.userVibes,
        collections: state.collections,
        currentUserId: state.currentUserId,
        lastSyncAt: state.lastSyncAt,
        // Convert Set to Array for JSON serialization
        pinnedPresetIds: Array.from(state.pinnedPresetIds),
      }),
      // Custom merge to convert array back to Set
      merge: (persistedState: any, currentState) => {
        return {
          ...currentState,
          ...persistedState,
          pinnedPresetIds: new Set(persistedState?.pinnedPresetIds || []),
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        // Load generations and favorites from IndexedDB after hydration
        state?.loadFromDB()
      },
    }
  )
)
