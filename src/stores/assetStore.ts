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
        
        // Store generation metadata with image references
        const genToStore = {
          ...generation,
          inputImageRef: inputImageId,
          outputImageRefs: savedOutputUrls,
        }
        await dbPut(STORES.GENERATIONS, genToStore)
        
        // Sync to cloud if logged in - do this BEFORE updating local state
        // so we can get the cloud-generated UUID
        let cloudGeneration = generation
        if (currentUserId) {
          console.log('[Store] Syncing generation to cloud for user:', currentUserId)
          const result = await syncService.saveGeneration(currentUserId, generation)
          if (result) {
            console.log('[Store] Generation sync success, cloud ID:', result.id)
            // Use the cloud-generated ID for the local state
            cloudGeneration = { ...generation, id: result.id }
          } else {
            console.warn('[Store] Generation sync failed, using local ID')
          }
        } else {
          console.warn('[Store] Not syncing generation - no currentUserId')
        }
        
        set((state) => ({ 
          generations: [cloudGeneration, ...state.generations] 
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
          const [generations, favorites, collections] = await Promise.all([
            dbGetAll<Generation>(STORES.GENERATIONS),
            dbGetAll<Favorite>(STORES.FAVORITES),
            dbGetAll<Collection>(STORES.COLLECTIONS),
          ])
          
          // Sort by createdAt desc
          generations.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          
          set({
            generations,
            favorites,
            collections,
          })
        } catch (error) {
          console.error('Error loading from IndexedDB:', error)
        }
      },
      
      // Sync with cloud - fetch all data from Supabase
      syncWithCloud: async (userId) => {
        set({ isSyncing: true, currentUserId: userId })
        
        try {
          console.log('[Store] Starting cloud sync for user:', userId)
          const cloudData = await syncService.syncAllData(userId)
          
          console.log('[Store] Cloud data received:', {
            models: cloudData.userModels.length,
            backgrounds: cloudData.userBackgrounds.length,
            products: cloudData.userProducts.length,
            vibes: cloudData.userVibes.length,
            generations: cloudData.generations.length,
            favorites: cloudData.favorites.length,
            pinnedPresets: cloudData.pinnedPresetIds.size,
          })
          
          // Always update from cloud when logged in
          // Cloud data is the source of truth for logged-in users
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
          })
          
          console.log('[Store] Cloud sync completed, generations:', cloudData.generations.length)
        } catch (error) {
          console.error('[Store] Cloud sync failed:', error)
          set({ isSyncing: false })
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
