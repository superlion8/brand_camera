'use client'

import { useCallback } from 'react'
import { useAssetStore } from '@/stores/assetStore'

/**
 * Hook to manage favorite state for generated images
 * Provides a clean API to toggle and check favorite status
 * 
 * @param generationId - The current generation ID (null if no generation)
 * @returns toggleFavorite - Function to toggle favorite status for an image index
 * @returns isFavorited - Function to check if an image index is favorited
 */
export function useFavorite(generationId: string | null) {
  const { favorites, addFavorite, removeFavorite, isFavorited: checkIsFavorited } = useAssetStore()
  
  const toggleFavorite = useCallback(async (imageIndex: number) => {
    if (!generationId) return
    
    const currentlyFavorited = checkIsFavorited(generationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === generationId && f.imageIndex === imageIndex
      )
      if (fav) {
        await removeFavorite(fav.id)
      }
    } else {
      await addFavorite({
        generationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }, [generationId, favorites, checkIsFavorited, addFavorite, removeFavorite])
  
  const isFavorited = useCallback((imageIndex: number): boolean => {
    return generationId ? checkIsFavorited(generationId, imageIndex) : false
  }, [generationId, checkIsFavorited])
  
  return { toggleFavorite, isFavorited }
}
