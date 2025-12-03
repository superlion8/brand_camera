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
  lastSyncAt: string | null
  currentUserId: string | null
  
  // Hydration status
  _hasHydrated: boolean
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
  addGeneration: (generation: Generation) => Promise<void>
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
  clearUserData: () => void
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
      lastSyncAt: null,
      currentUserId: null,
      
      _hasHydrated: false,
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
      addGeneration: async (generation) => {
        const { currentUserId } = get()
        
        console.log('[Store] Adding generation, currentUserId:', currentUserId, 'generationId:', generation.id)
        
        // Save images to IndexedDB (for offline/local cache)
        const savedOutputUrls: string[] = []
        for (let i = 0; i < generation.outputImageUrls.length; i++) {
          const imageId = `${generation.id}_output_${i}`
          await saveImage(imageId, generation.outputImageUrls[i])
          savedOutputUrls.push(imageId)
        }
        
        // Save input image
        const inputImageId = `${generation.id}_input`
        await saveImage(inputImageId, generation.inputImageUrl)
        
        // Sync to cloud first to get the cloud-generated ID
        // This ensures both IndexedDB and memory use the same ID
        let finalGeneration = generation
        if (currentUserId) {
          console.log('[Store] Syncing generation to cloud for user:', currentUserId)
          const result = await syncService.saveGeneration(currentUserId, generation)
          if (result) {
            console.log('[Store] Generation sync success, cloud ID:', result.id)
            // Use the cloud-generated ID for consistency
            finalGeneration = { ...generation, id: result.id }
          } else {
            console.warn('[Store] Generation sync failed, using local ID')
          }
        } else {
          console.warn('[Store] Not syncing generation - no currentUserId')
        }
        
        // Store generation metadata with image references
        // Use the final ID (cloud ID if synced, otherwise local ID)
        const genToStore = {
          ...finalGeneration,
          inputImageRef: inputImageId,
          outputImageRefs: savedOutputUrls,
        }
        await dbPut(STORES.GENERATIONS, genToStore)
        
        // Update memory state with the same ID as IndexedDB
        set((state) => ({ 
          generations: [finalGeneration, ...state.generations] 
        }))
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
      
      // Load from IndexedDB
      loadFromDB: async () => {
        try {
          const [dbGenerations, dbFavorites, dbCollections] = await Promise.all([
            dbGetAll<Generation>(STORES.GENERATIONS),
            dbGetAll<Favorite>(STORES.FAVORITES),
            dbGetAll<Collection>(STORES.COLLECTIONS),
          ])
          
          // Get current state to merge with (avoid losing recent in-memory data)
          const { generations: currentGenerations } = get()
          const now = Date.now()
          const RECENT_THRESHOLD_MS = 30000 // 30 seconds
          
          // Find very recent generations in memory that might not be in DB yet
          // (e.g., still being processed/saved)
          const recentInMemory = currentGenerations.filter(gen => {
            const createdAt = new Date(gen.createdAt).getTime()
            const isRecent = (now - createdAt) < RECENT_THRESHOLD_MS
            // Keep if recent AND not in DB (by ID)
            const existsInDb = dbGenerations.some(dbGen => dbGen.id === gen.id)
            return isRecent && !existsInDb
          })
          
          // Merge: DB generations + recent in-memory ones
          const mergedGenerations = [...dbGenerations, ...recentInMemory]
          
          // Sort by createdAt desc
          mergedGenerations.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          
          // Remove duplicates (by ID)
          const uniqueGenerations = mergedGenerations.filter((gen, index, self) =>
            index === self.findIndex(g => g.id === gen.id)
          )
          
          if (recentInMemory.length > 0) {
            console.log('[Store] loadFromDB: preserved', recentInMemory.length, 'recent in-memory generations')
          }
          
          set({
            generations: uniqueGenerations,
            favorites: dbFavorites,
            collections: dbCollections,
          })
        } catch (error) {
          console.error('Error loading from IndexedDB:', error)
        }
      },
      
      // Sync with cloud - fetch all data from Supabase
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
          console.log('[Store] Starting cloud sync for user:', userId)
          const cloudData = await syncService.syncAllData(userId)
          
          const duration = Date.now() - startTime
          console.log('[Store] Cloud data received in', duration, 'ms:', {
            models: cloudData.userModels.length,
            backgrounds: cloudData.userBackgrounds.length,
            products: cloudData.userProducts.length,
            vibes: cloudData.userVibes.length,
            generations: cloudData.generations.length,
            favorites: cloudData.favorites.length,
            pinnedPresets: cloudData.pinnedPresetIds.size,
          })
          
          // Merge cloud and local data
          // For generations: keep recent local ones that might not be in cloud yet
          const { generations: localGenerations } = get()
          const now = Date.now()
          const RECENT_THRESHOLD_MS = 60000 // 60 seconds
          
          // Find local generations that are recent (might not be synced to cloud yet)
          const recentLocalGenerations = localGenerations.filter(localGen => {
            const createdAt = new Date(localGen.createdAt).getTime()
            const isRecent = (now - createdAt) < RECENT_THRESHOLD_MS
            // Keep if recent AND not in cloud data (by ID)
            const existsInCloud = cloudData.generations.some(cloudGen => cloudGen.id === localGen.id)
            return isRecent && !existsInCloud
          })
          
          // Merge: cloud generations first, then recent local ones
          const mergedGenerations = [...cloudData.generations, ...recentLocalGenerations]
            // Sort by createdAt descending
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          
          if (recentLocalGenerations.length > 0) {
            console.log('[Store] Preserving', recentLocalGenerations.length, 'recent local generations not yet in cloud')
          }
          
          set({
            userModels: cloudData.userModels,
            userBackgrounds: cloudData.userBackgrounds,
            userProducts: cloudData.userProducts,
            userVibes: cloudData.userVibes,
            generations: mergedGenerations,
            favorites: cloudData.favorites,
            pinnedPresetIds: cloudData.pinnedPresetIds,
            lastSyncAt: new Date().toISOString(),
            isSyncing: false,
          })
          
          console.log('[Store] Cloud sync completed successfully')
        } catch (error) {
          console.error('[Store] Cloud sync failed after', Date.now() - startTime, 'ms:', error)
          // Always reset isSyncing on error
          set({ isSyncing: false, lastSyncAt: new Date().toISOString() })
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
