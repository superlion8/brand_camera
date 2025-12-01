import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Asset, AssetType, Generation, Collection, Favorite } from '@/types'
import { indexedDBStorage, dbPut, dbGet, dbGetAll, dbDelete, STORES, saveImage } from '@/lib/indexeddb'
import { generateId } from '@/lib/utils'

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
  addUserAsset: (asset: Asset) => void
  
  // Pin actions
  togglePin: (type: AssetType, id: string) => void
  togglePresetPin: (id: string) => void
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
      
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      setPresetModels: (models) => set({ presetModels: models }),
      setPresetBackgrounds: (backgrounds) => set({ presetBackgrounds: backgrounds }),
      setPresetVibes: (vibes) => set({ presetVibes: vibes }),
      setUserModels: (models) => set({ userModels: models }),
      setUserBackgrounds: (backgrounds) => set({ userBackgrounds: backgrounds }),
      setUserProducts: (products) => set({ userProducts: products }),
      setUserVibes: (vibes) => set({ userVibes: vibes }),
      
      // Add single asset to appropriate collection
      addUserAsset: (asset) => {
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
      },
      
      // Toggle pin for user assets
      togglePin: (type, id) => {
        const updateAssets = (assets: Asset[]) =>
          assets.map(a => a.id === id ? { ...a, isPinned: !a.isPinned } : a)
        
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
      },
      
      // Toggle pin for preset assets
      togglePresetPin: (id) => {
        set((state) => {
          const newPinnedIds = new Set(state.pinnedPresetIds)
          if (newPinnedIds.has(id)) {
            newPinnedIds.delete(id)
          } else {
            newPinnedIds.add(id)
          }
          return { pinnedPresetIds: newPinnedIds }
        })
      },
      
      // Check if preset is pinned
      isPresetPinned: (id) => {
        return get().pinnedPresetIds.has(id)
      },
      
      // Generation with IndexedDB
      addGeneration: async (generation) => {
        // Save images to IndexedDB
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
        
        set((state) => ({ 
          generations: [generation, ...state.generations] 
        }))
      },
      
      setGenerations: (generations) => set({ generations }),
      
      deleteGeneration: async (id) => {
        await dbDelete(STORES.GENERATIONS, id)
        set((state) => ({
          generations: state.generations.filter(g => g.id !== id)
        }))
      },
      
      addCollection: (collection) => set((state) => ({
        collections: [...state.collections, collection]
      })),
      
      setCollections: (collections) => set({ collections }),
      
      deleteCollection: (id) => set((state) => ({
        collections: state.collections.filter(c => c.id !== id)
      })),
      
      // Favorite with IndexedDB
      addFavorite: async (favoriteData) => {
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
      },
      
      removeFavorite: async (id) => {
        await dbDelete(STORES.FAVORITES, id)
        set((state) => ({
          favorites: state.favorites.filter(f => f.id !== id)
        }))
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
