"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ModelShotConfig, PageMode, ModelShotState, ModelShotActions } from "./types"
import { ModelGender } from "@/types"
import { useCameraPermission } from "@/hooks/useCameraPermission"
import { useTaskRecovery } from "@/hooks/useTaskRecovery"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { useGenerationTaskStore, TaskType } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { useFavorite } from "@/hooks/useFavorite"
import { useAuth } from "@/components/providers/AuthProvider"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { generateId, compressBase64Image } from "@/lib/utils"

interface ReserveOptions {
  taskId: string
  imageCount: number
  taskType: string
}

interface ReserveResult {
  success: boolean
  reservationId?: string
  error?: string
}

export interface UseModelShotStateReturn {
  // State
  state: ModelShotState
  // Actions
  actions: ModelShotActions
  // Camera permission
  hasCamera: boolean
  cameraReady: boolean
  permissionChecked: boolean
  // Device detection
  isDesktop: boolean
  isMobile: boolean
  screenLoading: boolean
  // Auth
  user: any
  authLoading: boolean
  // Quota
  quota: any
  checkQuota: () => Promise<boolean>
  reserveQuota: (options: ReserveOptions) => Promise<ReserveResult>
  confirmQuota: () => Promise<void>
  refundQuota: (taskId: string) => Promise<void>
  partialRefund: (taskId: string, successCount: number) => Promise<void>
  // Favorite
  toggleFavorite: (imageIndex: number) => Promise<void>
  isFavorited: (imageIndex: number) => boolean
  // Task management
  tasks: any[]
  addTask: (type: TaskType, inputImageUrl: string, params?: any, expectedImageCount?: number) => string
  updateTaskStatus: (taskId: string, status: any, outputImageUrls?: string[], error?: string) => void
  updateImageSlot: (taskId: string, index: number, data: any) => void
  initImageSlots: (taskId: string, count: number) => void
  // Asset management
  userModels: any[]
  userBackgrounds: any[]
  userProducts: any[]
  addUserAsset: (asset: any) => Promise<void>
  addGeneration: (gen: any) => void
  // Task recovery helpers
  saveTaskId: (taskId: string) => void
  clearTaskId: () => void
  // Mode ref for async callbacks
  modeRef: React.MutableRefObject<PageMode>
}

export function useModelShotState(config: ModelShotConfig): UseModelShotStateReturn {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Camera permission
  const { hasCamera, cameraReady, permissionChecked } = useCameraPermission(isDesktop, screenLoading)
  
  // Core state
  const [mode, setModeInternal] = useState<PageMode>("camera")
  const modeRef = useRef<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [additionalProducts, setAdditionalProducts] = useState<string[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  const [selectedModelGender, setSelectedModelGender] = useState<ModelGender | null>(null)
  
  // Results state
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<string[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<string[]>([])
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([])
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Keep modeRef in sync
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  
  // Wrapped setMode to update both state and ref
  const setMode = useCallback((newMode: PageMode) => {
    setModeInternal(newMode)
    modeRef.current = newMode
  }, [])
  
  // Stores
  const { tasks, addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { userModels, userBackgrounds, userProducts, addUserAsset, addGeneration } = useAssetStore()
  
  // Quota
  const { quota, checkQuota } = useQuota()
  const { reserveQuota, confirmQuota, refundQuota, partialRefund } = useQuotaReservation()
  
  // Favorite
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  
  // Task recovery
  const { saveTaskId, clearTaskId } = useTaskRecovery(
    {
      storageKey: config.storageKey,
      logPrefix: config.logPrefix,
    },
    {
      setMode,
      setCurrentTaskId,
      setCurrentGenerationId,
      setGeneratedImages,
      setGeneratedModelTypes,
      setGeneratedGenModes,
      setGeneratedPrompts,
    },
    tasks.length
  )
  
  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])
  
  // Actions
  const addAdditionalProduct = useCallback((image: string) => {
    if (config.additionalProductMode === 'single') {
      // Single mode: replace
      setAdditionalProducts([image])
    } else {
      // Array mode: add if under limit
      setAdditionalProducts(prev => {
        if (prev.length >= config.maxAdditionalProducts) return prev
        return [...prev, image]
      })
    }
  }, [config.additionalProductMode, config.maxAdditionalProducts])
  
  const removeAdditionalProduct = useCallback((index: number) => {
    setAdditionalProducts(prev => prev.filter((_, i) => i !== index))
  }, [])
  
  const clearAdditionalProducts = useCallback(() => {
    setAdditionalProducts([])
  }, [])
  
  const regenerate = useCallback(() => {
    // Clear previous results for skeleton loading
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setCurrentGenerationId(null)
    setMode('review')
  }, [setMode])
  
  const reset = useCallback(() => {
    setCapturedImage(null)
    setAdditionalProducts([])
    setSelectedModelId(null)
    setSelectedBgId(null)
    setSelectedModelGender(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setCurrentTaskId(null)
    setCurrentGenerationId(null)
    setIsProcessing(false)
    setError(null)
    setMode('camera')
    clearTaskId()
  }, [clearTaskId, setMode])
  
  // Placeholder for startGeneration - will be implemented by each page
  const startGeneration = useCallback(async () => {
    console.warn('startGeneration should be implemented by the page using this hook')
  }, [])
  
  // Construct state object
  const state: ModelShotState = {
    mode,
    capturedImage,
    additionalProducts,
    selectedModelId,
    selectedBgId,
    selectedModelGender,
    generatedImages,
    generatedModelTypes,
    generatedGenModes,
    generatedPrompts,
    currentTaskId,
    currentGenerationId,
    isProcessing,
    error,
  }
  
  // Construct actions object
  const actions: ModelShotActions = {
    setMode,
    setCapturedImage,
    addAdditionalProduct,
    removeAdditionalProduct,
    clearAdditionalProducts,
    setSelectedModelId,
    setSelectedBgId,
    setSelectedModelGender,
    setGeneratedImages,
    setCurrentTaskId,
    setCurrentGenerationId,
    startGeneration,
    regenerate,
    reset,
  }
  
  return {
    state,
    actions,
    hasCamera,
    cameraReady,
    permissionChecked,
    isDesktop,
    isMobile,
    screenLoading,
    user,
    authLoading,
    quota,
    checkQuota,
    reserveQuota,
    confirmQuota,
    refundQuota,
    partialRefund,
    toggleFavorite,
    isFavorited,
    tasks,
    addTask,
    updateTaskStatus,
    updateImageSlot,
    initImageSlots,
    userModels,
    userBackgrounds,
    userProducts,
    addUserAsset,
    addGeneration,
    saveTaskId,
    clearTaskId,
    modeRef,
  }
}
