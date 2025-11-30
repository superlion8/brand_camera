import { create } from 'zustand'
import { Asset, Generation, Collection, Favorite } from '@/types'

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
  
  // Generations
  generations: Generation[]
  
  // Collections
  collections: Collection[]
  favorites: Favorite[]
  
  // Actions
  setPresetModels: (models: Asset[]) => void
  setPresetBackgrounds: (backgrounds: Asset[]) => void
  setPresetVibes: (vibes: Asset[]) => void
  setUserModels: (models: Asset[]) => void
  setUserBackgrounds: (backgrounds: Asset[]) => void
  setUserProducts: (products: Asset[]) => void
  setUserVibes: (vibes: Asset[]) => void
  addGeneration: (generation: Generation) => void
  setGenerations: (generations: Generation[]) => void
  addCollection: (collection: Collection) => void
  setCollections: (collections: Collection[]) => void
  addFavorite: (favorite: Favorite) => void
  removeFavorite: (id: string) => void
  setFavorites: (favorites: Favorite[]) => void
}

export const useAssetStore = create<AssetState>((set) => ({
  presetModels: [],
  presetBackgrounds: [],
  presetVibes: [],
  userModels: [],
  userBackgrounds: [],
  userProducts: [],
  userVibes: [],
  generations: [],
  collections: [],
  favorites: [],
  
  setPresetModels: (models) => set({ presetModels: models }),
  setPresetBackgrounds: (backgrounds) => set({ presetBackgrounds: backgrounds }),
  setPresetVibes: (vibes) => set({ presetVibes: vibes }),
  setUserModels: (models) => set({ userModels: models }),
  setUserBackgrounds: (backgrounds) => set({ userBackgrounds: backgrounds }),
  setUserProducts: (products) => set({ userProducts: products }),
  setUserVibes: (vibes) => set({ userVibes: vibes }),
  addGeneration: (generation) => set((state) => ({ 
    generations: [generation, ...state.generations] 
  })),
  setGenerations: (generations) => set({ generations }),
  addCollection: (collection) => set((state) => ({
    collections: [...state.collections, collection]
  })),
  setCollections: (collections) => set({ collections }),
  addFavorite: (favorite) => set((state) => ({
    favorites: [...state.favorites, favorite]
  })),
  removeFavorite: (id) => set((state) => ({
    favorites: state.favorites.filter(f => f.id !== id)
  })),
  setFavorites: (favorites) => set({ favorites }),
}))

