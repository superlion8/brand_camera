"use client"

import { useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"

type PageMode = "camera" | "review" | "processing" | "results"

interface TaskRecoveryConfig {
  /** Storage key for taskId, e.g., 'proStudioTaskId', 'lifestyleTaskId' */
  storageKey: string
  /** Log prefix for debugging, e.g., '[ProStudio]', '[Lifestyle]' */
  logPrefix: string
}

interface TaskRecoveryCallbacks {
  setMode: (mode: PageMode) => void
  setCurrentTaskId: (taskId: string | null) => void
  setCurrentGenerationId: (genId: string | null) => void
  setGeneratedImages: (images: string[]) => void
  setGeneratedModelTypes?: (types: string[]) => void
  setGeneratedGenModes?: (modes: string[]) => void
  setGeneratedPrompts?: (prompts: string[]) => void
}

/**
 * Hook to recover task state from URL params and sessionStorage
 * Handles page refresh recovery by fetching data from database
 */
export function useTaskRecovery(
  config: TaskRecoveryConfig,
  callbacks: TaskRecoveryCallbacks,
  tasksLength: number
) {
  const searchParams = useSearchParams()
  const { storageKey, logPrefix } = config
  const {
    setMode,
    setCurrentTaskId,
    setCurrentGenerationId,
    setGeneratedImages,
    setGeneratedModelTypes,
    setGeneratedGenModes,
    setGeneratedPrompts,
  } = callbacks

  // Recover from URL params
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as PageMode)
      const savedTaskId = sessionStorage.getItem(storageKey)
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)

        // If results mode and tasks are empty (page refreshed), recover from database
        if (urlMode === 'results' && tasksLength === 0) {
          console.log(`${logPrefix} Recovering images from database for task:`, savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modelTypes = gen.output_model_types || []
                const genModes = gen.output_gen_modes || []
                const prompts = gen.output_prompts || []
                
                if (images.length > 0) {
                  console.log(`${logPrefix} Recovered ${images.length} images from database`)
                  setGeneratedImages(images)
                  setGeneratedModelTypes?.(modelTypes)
                  setGeneratedGenModes?.(genModes)
                  setGeneratedPrompts?.(prompts)
                  setCurrentGenerationId(gen.id)
                } else {
                  console.log(`${logPrefix} No images found in database, returning to camera`)
                  setMode('camera')
                  sessionStorage.removeItem(storageKey)
                }
              } else {
                console.log(`${logPrefix} Task not found in database, returning to camera`)
                setMode('camera')
                sessionStorage.removeItem(storageKey)
              }
            })
            .catch(err => {
              console.error(`${logPrefix} Failed to recover images:`, err)
              setMode('camera')
              sessionStorage.removeItem(storageKey)
            })
        }
      }
    }
  }, [searchParams, tasksLength, storageKey, logPrefix, setMode, setCurrentTaskId, setCurrentGenerationId, setGeneratedImages, setGeneratedModelTypes, setGeneratedGenModes, setGeneratedPrompts])

  // Helper to save task ID to session storage
  const saveTaskId = useCallback((taskId: string) => {
    sessionStorage.setItem(storageKey, taskId)
  }, [storageKey])

  // Helper to clear task ID from session storage
  const clearTaskId = useCallback(() => {
    sessionStorage.removeItem(storageKey)
  }, [storageKey])

  return { saveTaskId, clearTaskId }
}
