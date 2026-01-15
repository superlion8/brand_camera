"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Check, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, Pin, ZoomIn, FolderHeart, Plus, Upload, Sparkles
} from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore, base64ToBlobUrl } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image } from "@/lib/utils"
import { Asset } from "@/types"
import Image from "next/image"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { ModelPickerPanel } from "@/components/shared/ModelPickerPanel"
import { ScenePickerPanel } from "@/components/shared/ScenePickerPanel"
import { AssetGrid } from "@/components/shared/AssetGrid"
import { CustomPickerPanel } from "@/components/shared/CustomPickerPanel"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { useImageDownload } from "@/hooks/useImageDownload"
import { useFavorite } from "@/hooks/useFavorite"
import { navigateToEdit } from "@/lib/navigation"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { ResultsView } from "@/components/shared/ResultsView"
import { usePresetStore } from "@/stores/presetStore"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { ReviewModeLayout } from "@/components/shared/ReviewModeLayout"
import { MobilePageHeader } from "@/components/shared/MobilePageHeader"
import { CameraBottomBar } from "@/components/shared/CameraBottomBar"
import { ProductPreviewArea } from "@/components/shared/ProductPreviewArea"

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || 'Resource busy, please try again later'
  }
  return error
}

type SocialMode = "camera" | "review" | "processing" | "results"

// 商品分类
type ProductSubTab = "all" | "top" | "pants" | "inner" | "shoes" | "hat"
const PRODUCT_SUB_TABS: ProductSubTab[] = ["all", "top", "pants", "inner", "shoes", "hat"]

// 商品分类翻译映射
const getProductCategoryLabel = (cat: ProductSubTab, t: any): string => {
  switch (cat) {
    case "all": return t.common?.all || "全部"
    case "top": return t.assets?.productTop || "上衣"
    case "pants": return t.assets?.productPants || "裤子"
    case "inner": return t.assets?.productInner || "内衬"
    case "shoes": return t.assets?.productShoes || "鞋子"
    case "hat": return t.assets?.productHat || "帽子"
    default: return cat
  }
}

// Social Generation config - 4 images total (2 groups × 2 images)
// 每组共用模特和背景，每组生成 2 张图（prompt1 和 prompt2）
const SOCIAL_NUM_IMAGES = 4
const SOCIAL_NUM_GROUPS = 2
const SOCIAL_IMAGES_PER_GROUP = 2

// 组标签配置
const GROUP_LABELS = ['A', 'B'] as const

function SocialPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const t = useLanguageStore(state => state.t)
  
  // 未登录时重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Mode and state
  const [mode, setMode] = useState<SocialMode>("camera")
  const modeRef = useRef<SocialMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [additionalProducts, setAdditionalProducts] = useState<string[]>([]) // Up to 3 additional products
  const MAX_ADDITIONAL_PRODUCTS = 3
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [additionalFromPhone, setAdditionalFromPhone] = useState<boolean[]>([])
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Keep modeRef in sync with mode
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  
  // 注意：不在组件卸载时中止 SSE 请求
  // 用户离开页面后，后端会继续生成并保存到数据库
  
  // Check camera permission on mount - skip on PC Web
  useEffect(() => {
    const checkCameraPermission = async () => {
      // Skip camera permission check on desktop - only upload is available
      if (isDesktop) {
        setHasCamera(false)
        setPermissionChecked(true)
        return
      }
      
      try {
        const cachedPermission = localStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
          setPermissionChecked(true)
          return
        }
        
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
            localStorage.setItem('cameraPermissionGranted', 'true')
          } else if (result.state === 'denied') {
            setHasCamera(false)
            localStorage.setItem('cameraPermissionGranted', 'false')
          }
          
          result.addEventListener('change', () => {
            if (result.state === 'granted') {
              setCameraReady(true)
              localStorage.setItem('cameraPermissionGranted', 'true')
            } else if (result.state === 'denied') {
              setHasCamera(false)
              localStorage.setItem('cameraPermissionGranted', 'false')
            }
          })
        }
      } catch (e) {
        console.log('Permission API not supported, trying direct stream access')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(track => track.stop())
          setCameraReady(true)
          localStorage.setItem('cameraPermissionGranted', 'true')
        } catch (streamError) {
          console.log('Camera access denied or unavailable')
          setHasCamera(false)
        }
      }
      setPermissionChecked(true)
    }
    
    // Wait for screen loading to determine if desktop
    if (!screenLoading) {
      checkCameraPermission()
    }
  }, [isDesktop, screenLoading])
  
  // Panel states
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showScenePicker, setShowScenePicker] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("all")
  const [zoomProductImage, setZoomProductImage] = useState<string | null>(null)
  const [activeCustomTab, setActiveCustomTab] = useState("model")
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [modelSubcategory, setModelSubcategory] = useState<'mine' | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<'mine' | null>(null)
  
  const { addGeneration, addUserAsset, userModels, userBackgrounds, userProducts, generations } = useAssetStore()
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  
  // 从 URL 参数读取 mode（刷新后恢复）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as SocialMode)
      const savedTaskId = sessionStorage.getItem('socialTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[Social] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modelTypes = gen.output_model_types || []
                if (images.length > 0) {
                  console.log('[Social] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                  setGeneratedModelTypes(modelTypes)
                  setCurrentGenerationId(gen.id)
                } else {
                  console.log('[Social] No images found in database, returning to camera')
                  setMode('camera')
                  sessionStorage.removeItem('socialTaskId')
                }
              } else {
                console.log('[Social] Task not found in database, returning to camera')
                setMode('camera')
                sessionStorage.removeItem('socialTaskId')
              }
            })
            .catch(err => {
              console.error('[Social] Failed to recover images:', err)
              setMode('camera')
              sessionStorage.removeItem('socialTaskId')
            })
        }
      }
    }
  }, [searchParams, tasks.length])

  // Recovery effect: 当任务已完成但界面还在 processing 时，自动切换到 results
  useEffect(() => {
    if (mode !== 'processing' || !currentTaskId) return

    const currentTask = tasks.find(t => t.id === currentTaskId)
    
    // 如果任务在 store 中不存在
    if (!currentTask) {
      if (generatedImages.length > 0 && generatedImages.some(img => img)) {
        console.log('[Social] Task not found but has images, switching to results mode')
        setMode('results')
        router.replace('/social?mode=results')
      } else {
        console.log('[Social] Task not found and no images, returning to camera mode')
        setMode('camera')
        router.replace('/social')
      }
      return
    }

    // 如果任务状态已经是 completed 或 failed，直接切换
    if (currentTask.status === 'completed' || currentTask.status === 'failed') {
      console.log(`[Social] Task status is ${currentTask.status}, switching to results mode`)
      const images = currentTask.imageSlots?.map(s => s.imageUrl || '') || currentTask.outputImageUrls || []
      setGeneratedImages(images)
      setMode('results')
      router.replace('/social?mode=results')
      return
    }

    if (!currentTask.imageSlots) return

    // 检查是否有任何一张图片完成
    const hasAnyCompleted = currentTask.imageSlots.some(s => s.status === 'completed')
    // 检查是否所有图片都已处理完毕
    const allProcessed = currentTask.imageSlots.every(s => s.status === 'completed' || s.status === 'failed')

    if (hasAnyCompleted) {
      console.log('[Social] Task has completed images, switching to results mode')
      const images = currentTask.imageSlots.map(s => s.imageUrl || '')
      setGeneratedImages(images)
      setMode('results')
      router.replace('/social?mode=results')
    } else if (allProcessed) {
      console.log('[Social] All images failed, switching to results mode')
      setGeneratedImages([])
      setMode('results')
      router.replace('/social?mode=results')
    }
  }, [mode, currentTaskId, tasks, generatedImages, router])
  
  // Preset Store - 动态从云端加载
  const { 
    visibleModels, 
    visibleBackgrounds,
    isLoaded: presetsLoaded,
    loadPresets,
    getRandomModel,
    getRandomBackground,
  } = usePresetStore()
  
  // 组件加载时获取预设
  useEffect(() => {
    loadPresets()
  }, [loadPresets])
  
  // Quota management
  const { quota, checkQuota } = useQuota()
  const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
  
  // Helper to sort by pinned status
  const sortByPinned = (assets: Asset[]) => 
    [...assets].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
  
  // 监听任务完成，自动切换到 results 模式
  useEffect(() => {
    if (mode !== 'processing' || !currentTaskId) return
    
    const currentTask = tasks.find(t => t.id === currentTaskId)
    if (!currentTask?.imageSlots) return
    
    const hasAnyCompleted = currentTask.imageSlots.some(s => s.status === 'completed')
    
    if (hasAnyCompleted) {
      console.log('[Social] Task has completed images, switching to results mode')
      const images = currentTask.imageSlots.map(s => s.imageUrl || '')
      const modelTypes = currentTask.imageSlots.map(s => (s.modelType === 'pro' || s.modelType === 'flash' ? s.modelType : 'pro') as 'pro' | 'flash')
      setGeneratedImages(images)
      setGeneratedModelTypes(modelTypes)
      setMode('results')
    }
  }, [mode, currentTaskId, tasks])
  
  // Filter assets by category
  const filteredModels = modelSubcategory === 'mine'
    ? sortByPinned(userModels)
    : [...sortByPinned(userModels), ...visibleModels]
  
  const filteredBackgrounds = bgSubcategory === 'mine'
    ? sortByPinned(userBackgrounds)
    : [...sortByPinned(userBackgrounds), ...visibleBackgrounds]
  
  const allModels = filteredModels
  const allBackgrounds = filteredBackgrounds
  
  // Get selected assets from merged arrays
  const activeModel = allModels.find(m => m.id === selectedModel)
  const activeBg = allBackgrounds.find(b => b.id === selectedBg)
  
  // 拍照
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setMode("review")
      }
    }
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setMode("review")
    }
  }, [])
  
  // Upload model image directly in selector
  const handleModelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newAsset = {
        id: generateId(),
        type: 'model' as const,
        name: `${t.common.model} ${new Date().toLocaleDateString()}`,
        imageUrl: base64,
      }
      addUserAsset(newAsset)
      setSelectedModel(newAsset.id)
    }
    if (e.target) e.target.value = ''
  }, [addUserAsset, t.common.model])
  
  // Upload background image directly in selector
  const handleBgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newAsset = {
        id: generateId(),
        type: 'background' as const,
        name: `${t.common.background} ${new Date().toLocaleDateString()}`,
        imageUrl: base64,
      }
      addUserAsset(newAsset)
      setSelectedBg(newAsset.id)
    }
    if (e.target) e.target.value = ''
  }, [addUserAsset, t.common.background])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
    localStorage.setItem('cameraPermissionGranted', 'true')
  }, [])
  
  const handleRetake = () => {
    setCapturedImage(null)
    setAdditionalProducts([])
    setAdditionalFromPhone([])
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return

    // Clear previous results first (for Regenerate to show skeleton)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    
    // Check quota before starting generation
    const hasQuota = await checkQuota(SOCIAL_NUM_IMAGES)
    if (!hasQuota) {
      return
    }
    
    // Capture current selections BEFORE any async operations
    const currentModel = activeModel
    const currentBg = activeBg
    
    const modelIsUserSelected = !!activeModel
    const bgIsUserSelected = !!activeBg
    
    // Create task and switch to processing mode
    const params = {
      model: currentModel?.name || '每张随机',
      background: currentBg?.name || '每张随机',
      modelIsUserSelected,
      bgIsUserSelected,
    }
    
    const taskId = addTask('social', capturedImage, params, SOCIAL_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, SOCIAL_NUM_IMAGES)
    setMode("processing")
    
    sessionStorage.setItem('socialTaskId', taskId)
    router.replace('/social?mode=processing')
    
    // Trigger fly animation
    triggerFlyToGallery()
    
    // 预扣配额（使用统一 hook）
    const reserveResult = await reserveQuota({
        taskId,
        imageCount: SOCIAL_NUM_IMAGES,
        taskType: 'social',
    })
    
    if (!reserveResult.success) {
      console.error('[Social] Failed to reserve quota:', reserveResult.error)
      setMode('camera')
      router.replace('/social')
      return
    }
    
    // Start background generation
    runBackgroundGeneration(
      taskId,
      capturedImage,
      additionalProducts,
      currentModel,
      currentBg,
      modelIsUserSelected,
      bgIsUserSelected
    )
  }
  
  // Background generation function
  const runBackgroundGeneration = async (
    taskId: string,
    inputImage: string,
    additionalImages: string[],
    model: Asset | undefined,
    background: Asset | undefined,
    modelIsUserSelected: boolean,
    bgIsUserSelected: boolean
  ) => {
    try {
      console.log("[Social] Starting generation...")
      console.log("User selected model:", model?.name || 'none (will use random)')
      console.log("User selected background:", background?.name || 'none (will use random)')
      console.log(`[Social] Additional products: ${additionalImages.length}`)
      
      // 压缩图片以减少请求体大小（Vercel 限制 4.5MB）
      console.log("[Social] Compressing product images...")
      const compressedImage = await compressBase64Image(inputImage, 1280)
      const compressedAdditional = await Promise.all(
        additionalImages.map(img => compressBase64Image(img, 1280))
      )
      console.log(`[Social] Compressed main: ${(inputImage.length / 1024).toFixed(0)}KB -> ${(compressedImage.length / 1024).toFixed(0)}KB`)
      console.log(`[Social] Compressed ${compressedAdditional.length} additional products`)
      
      const userModelUrl = model?.imageUrl || null
      const userBgUrl = background?.imageUrl || null
      
      // 初始化所有 slots 为 pending
      for (let i = 0; i < SOCIAL_NUM_IMAGES; i++) {
        updateImageSlot(taskId, i, { status: 'pending' })
      }
      
      console.log(`[Social] Starting SSE generation for ${SOCIAL_NUM_IMAGES} images...`)
      
      // 发送 SSE 请求到 generate-social API
      // 注意：不使用 AbortController，用户离开页面后后端继续生成
      const response = await fetch('/api/generate-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productImage: compressedImage,
          additionalProducts: compressedAdditional, // Array of up to 3 additional products
          modelImage: userModelUrl || 'random',
          taskId,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      // 处理 SSE 流
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      const allImages: (string | null)[] = Array(SOCIAL_NUM_IMAGES).fill(null)
      const allModelTypes: (('pro' | 'flash') | null)[] = Array(SOCIAL_NUM_IMAGES).fill(null)
      let successCount = 0
      let firstDbId: string | null = null // 跟踪第一个有效的 dbId
      
      if (reader) {
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'start') {
                  console.log(`[Social] Starting ${data.totalGroups} groups, ${data.totalImages} total images`)
                } else if (data.type === 'progress') {
                  // 新工作流：progress 事件包含 groupIndex, step, message
                  const groupLabel = typeof data.groupIndex === 'number' ? `G${data.groupIndex}` : ''
                  console.log(`[Social] Progress [${groupLabel}/${data.step}]: ${data.message}`)
                  if (typeof data.globalIndex === 'number') {
                    updateImageSlot(taskId, data.globalIndex, { status: 'generating' })
                  }
                } else if (data.type === 'model_selected') {
                  console.log(`[Social] G${data.groupIndex} AI selected model: ${data.modelId} (${data.reason})`)
                } else if (data.type === 'background_selected') {
                  console.log(`[Social] G${data.groupIndex} Background: ${data.fileName}`)
                } else if (data.type === 'outfit_ready') {
                  console.log(`[Social] G${data.groupIndex} Outfit instructions ready`)
                } else if (data.type === 'image') {
                  const globalIdx = data.globalIndex
                  console.log(`[Social] G${data.groupIndex} Image ${data.localIndex + 1}: ✓ (global: ${globalIdx}, dbId: ${data.dbId})`)
                  
                  allImages[globalIdx] = data.image
                  allModelTypes[globalIdx] = 'pro' // 新工作流固定使用 pro 模型
                  successCount++
                  
                  // 捕获第一个有效的 dbId，用于收藏功能
                  // 使用 !firstDbId 而不是 successCount === 1，以处理图片乱序返回或第一张没有 dbId 的情况
                  if (data.dbId && !firstDbId) {
                    firstDbId = data.dbId
                    setCurrentGenerationId(data.dbId)
                    console.log(`[Social] Set currentGenerationId to dbId: ${data.dbId}`)
                  }
                  
                  updateImageSlot(taskId, globalIdx, {
                    status: 'completed',
                    imageUrl: data.image,
                    modelType: 'pro',
                    genMode: 'simple', // Social 模式统一使用 simple
                    dbId: data.dbId,  // 存储数据库 UUID
                  })
                  
                  // 第一张图片完成时，切换到 results 模式
                  // 检查是否仍在social页面，避免用户离开后强制跳转
                  if (modeRef.current === 'processing' && successCount === 1) {
                    console.log('[Social] First image ready, switching to results mode')
                    setMode('results')
                    if (window.location.pathname === '/social') {
                      router.replace('/social?mode=results')
                    }
                  }
                } else if (data.type === 'image_error') {
                  const globalIdx = data.globalIndex
                  console.log(`[Social] G${data.groupIndex} Image ${data.localIndex + 1}: ✗ (${data.error})`)
                  updateImageSlot(taskId, globalIdx, {
                    status: 'failed',
                    error: data.error,
                  })
                } else if (data.type === 'error') {
                  // 错误（可能是组级别或全局）
                  const prefix = typeof data.groupIndex === 'number' ? `G${data.groupIndex} ` : ''
                  console.error(`[Social] ${prefix}Error: ${data.error}`)
                } else if (data.type === 'complete') {
                  console.log(`[Social] Complete: ${data.totalSuccess}/${SOCIAL_NUM_IMAGES} images`)
                }
              } catch (e) {
                console.warn('[Social] Failed to parse SSE data:', line)
              }
            }
          }
        }
      }
      
      // 部分退款（使用统一 hook）
      if (successCount > 0 && successCount < SOCIAL_NUM_IMAGES) {
        await partialRefund(taskId, successCount)
      }
      
      if (successCount > 0) {
        updateTaskStatus(taskId, 'completed', allImages.filter(Boolean) as string[])
        
        // Save to IndexedDB/history
        const id = taskId
        const savedImages = allImages.filter(Boolean) as string[]
        const savedModelTypes = allModelTypes.filter(Boolean) as ('pro' | 'flash')[]
        
        // Social 模式统一使用 simple
        const genModes = savedImages.map(() => 'simple' as const)
        
        await addGeneration({
          id,
          type: "social",
          inputImageUrl: inputImage,
          outputImageUrls: savedImages,
          outputModelTypes: savedModelTypes,
          outputGenModes: genModes,
          createdAt: new Date().toISOString(),
          params: {
            model: model?.name,
            background: background?.name,
            modelImage: model?.imageUrl,
            backgroundImage: background?.imageUrl,
            modelIsUserSelected,
            bgIsUserSelected,
          },
        }, true)
        
        await confirmQuota()
        
        if (modeRef.current === "processing") {
          setGeneratedImages(allImages.filter(Boolean) as string[])
          setGeneratedModelTypes(savedModelTypes)
          // 如果没有任何图片返回 dbId（后端保存都失败），使用 taskId 作为 fallback
          if (!firstDbId) {
            setCurrentGenerationId(taskId)
            console.log(`[Social] No dbId received, using taskId as fallback: ${taskId}`)
          }
          setMode("results")
          // 检查是否仍在social页面，避免用户离开后强制跳转
          if (window.location.pathname === '/social') {
            router.replace('/social?mode=results')
          }
        }
        
        sessionStorage.removeItem('socialTaskId')
      } else {
        // 全部失败，全额退款（使用统一 hook）
        await refundQuota(taskId)
        throw new Error(t.camera?.generationFailed || 'Generation failed')
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.camera?.generationFailed)
      
      // 异常退款（使用统一 hook）
      await refundQuota(taskId)
      
      if (modeRef.current === "processing") {
        const errorMsg = getErrorMessage(error.message, t) || t.errors?.generateFailed
        alert(errorMsg)
        setMode("review")
      }
      
      sessionStorage.removeItem('socialTaskId')
    }
  }
  
  // Handle return during processing
  const handleReturnDuringProcessing = () => {
    router.push("/")
  }
  
  // Handle taking new photo during processing
  const handleNewPhotoDuringProcessing = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode("camera")
  }
  
  const handleReturn = () => {
    router.push("/")
  }
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => navigateToEdit(router, imageUrl)
  
  // Handle download - using shared hook with tracking
  const { downloadImage } = useImageDownload({ 
    trackingSource: 'social', 
    filenamePrefix: 'social' 
  })
  const handleDownload = (url: string, generationId?: string, imageIndex?: number) =>
    downloadImage(url, { generationId, imageIndex })
  
  // 登录状态检查中显示加载（未登录时 useEffect 会重定向）
  if (authLoading) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">{t.common?.loading || '加载中...'}</p>
        </div>
      </div>
    )
  }
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className={`h-full relative flex flex-col ${isDesktop ? 'bg-zinc-50' : 'bg-black'}`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload}
      />
      <input 
        type="file" 
        ref={fileInputRef2} 
        className="hidden" 
        accept="image/*" 
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file && additionalProducts.length < MAX_ADDITIONAL_PRODUCTS) {
            const base64 = await fileToBase64(file)
            setAdditionalProducts(prev => [...prev, base64])
            setAdditionalFromPhone(prev => [...prev, true])
            setShowProduct2Panel(false)
          }
          e.target.value = '' // Reset so same file can be selected again
        }}
      />
      <input 
        type="file" 
        ref={modelUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleModelUpload}
      />
      <input 
        type="file" 
        ref={bgUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleBgUpload}
      />

      <AnimatePresence mode="wait">
        {(mode === "camera" || mode === "review") && (
          <motion.div 
            key="camera-view"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 relative overflow-hidden flex flex-col"
          >
            {/* Top Return Button - Mobile only */}
            <MobilePageHeader
              show={!isDesktop}
              backAction={mode === "review" ? "close" : "home"}
              onBack={mode === "review" ? handleRetake : handleReturn}
            />
            
            {/* Social Mode Badge */}
            <div className="absolute top-4 right-4 z-20">
              <span className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-semibold rounded-full">
                {t.home?.socialMode || '社媒种草'}
              </span>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className={`flex-1 relative ${isDesktop && mode === "camera" ? 'bg-zinc-50' : ''}`}>
              {/* PC Desktop: Show upload interface with wider layout */}
              {mode === "camera" && isDesktop ? (
                <div className="absolute inset-0 overflow-y-auto bg-zinc-50">
                  {/* PC Header */}
                  <div className="bg-white border-b border-zinc-200">
                    <div className="max-w-7xl mx-auto px-8 py-5">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => router.push('/')}
                          className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                        >
                          <Home className="w-5 h-5 text-zinc-600" />
                        </button>
                        <h1 className="text-lg font-semibold text-zinc-900">{t.social?.title || '社媒种草'}</h1>
                      </div>
                    </div>
                  </div>
                  
                  {/* Two-column content */}
                  <div className="max-w-5xl mx-auto px-8 py-8">
                    <div className="flex gap-8">
                      {/* Left: Feature Showcase Card */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                          {/* Showcase Image */}
                          <div className="relative aspect-[16/9] overflow-hidden group">
                            <Image 
                              src="https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage/features/social.jpg" 
                              alt="Social Mode" 
                              fill 
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-lg font-bold text-white">{t.social?.socialMode || '社媒种草模式'}</h3>
                              <p className="text-sm text-white/80 mt-1">{t.home?.socialModeSubtitle || '小红书INS风格'}</p>
                            </div>
                          </div>
                          
                          {/* Feature Tags */}
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.social?.xiaohongshuStyle || '小红书风格'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.social?.outfitDisplay || '精致穿搭展示'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.social?.plantingPowerMax || '种草力 MAX'}
                              </span>
                              </div>
                              </div>
                            </div>
                              </div>
                      
                      {/* Right: Image Upload - Click to open Assets panel or drag & drop */}
                      <div className="w-[380px] shrink-0">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                          <div
                            onClick={() => setShowProductPanel(true)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-pink-400', 'bg-pink-50') }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50') }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50')
                              const file = e.dataTransfer.files?.[0]
                              if (file && file.type.startsWith('image/')) {
                                const base64 = await fileToBase64(file)
                                setCapturedImage(base64)
                                setMode("review")
                              }
                            }}
                            className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer"
                          >
                            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                              </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-zinc-700">{t.social?.uploadProduct || '上传商品图片'}</p>
                              <p className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || 'Click to upload or drag and drop'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : mode === "camera" && hasCamera && permissionChecked && !isDesktop ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={{
                    facingMode: "environment",
                    width: { min: 1080, ideal: 1920 },
                    height: { min: 1080, ideal: 1920 }
                  }}
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : mode === "camera" && !permissionChecked && !isDesktop ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                    <p className="text-sm">{t.camera?.initializingCamera || 'Initializing camera...'}</p>
                  </div>
                </div>
              ) : mode === "camera" && !hasCamera && !isDesktop ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">{t.camera?.cameraUnavailable || 'Camera unavailable'}</p>
                    <p className="text-xs mt-1">{t.camera?.productPlaceholder || '请上传商品图片'}</p>
                  </div>
                </div>
              ) : mode === "review" && isDesktop ? (
                /* Desktop Review Mode - Using shared ReviewModeLayout */
                <ReviewModeLayout
                  title={t.social?.title || 'Social UGC'}
                  onBack={handleRetake}
                  mainProductImage={capturedImage}
                  onMainProductChange={handleRetake}
                  onMainProductZoom={(url) => setFullscreenImage(url)}
                  additionalProducts={additionalProducts}
                  maxAdditionalProducts={MAX_ADDITIONAL_PRODUCTS}
                  onAddProduct={() => setShowProduct2Panel(true)}
                  onRemoveProduct={(idx) => {
                    setAdditionalProducts(prev => prev.filter((_, i) => i !== idx))
                    setAdditionalFromPhone(prev => prev.filter((_, i) => i !== idx))
                  }}
                  onDropProduct={(base64) => {
                    if (additionalProducts.length < MAX_ADDITIONAL_PRODUCTS) {
                      setAdditionalProducts(prev => [...prev, base64])
                      setAdditionalFromPhone(prev => [...prev, true])
                    }
                  }}
                  models={allModels}
                  selectedModelId={selectedModel}
                  onSelectModel={setSelectedModel}
                  onModelUpload={() => modelUploadRef.current?.click()}
                  onModelZoom={(url) => setFullscreenImage(url)}
                  onViewMoreModels={() => setShowModelPicker(true)}
                  onModelDrop={async (base64) => {
                    const newAsset = {
                      id: generateId(),
                      type: 'model' as const,
                      name: `${t.common.model} ${new Date().toLocaleDateString()}`,
                      imageUrl: base64,
                    }
                    await addUserAsset(newAsset)
                    setSelectedModel(newAsset.id)
                  }}
                  backgrounds={allBackgrounds}
                  selectedBgId={selectedBg}
                  onSelectBg={setSelectedBg}
                  onBgUpload={() => bgUploadRef.current?.click()}
                  onBgZoom={(url) => setFullscreenImage(url)}
                  onViewMoreBgs={() => {
                                    setActiveCustomTab("bg")
                                    setShowCustomPanel(true)
                                  }}
                  onBgDrop={async (base64) => {
                    const newAsset = {
                      id: generateId(),
                      type: 'background' as const,
                      name: `${t.common.background} ${new Date().toLocaleDateString()}`,
                      imageUrl: base64,
                    }
                    await addUserAsset(newAsset)
                    setSelectedBg(newAsset.id)
                  }}
                  creditCost={4}
                  onGenerate={() => {
                            handleShootIt()
                          }}
                  t={t}
                />
              ) : (
                /* Mobile Review Mode - Use shared ProductPreviewArea */
                <ProductPreviewArea
                  mainImage={capturedImage}
                  additionalImages={mode === "review" ? additionalProducts : []}
                  maxAdditionalImages={MAX_ADDITIONAL_PRODUCTS}
                  onAddProduct={mode === "review" ? () => setShowProduct2Panel(true) : undefined}
                  onRemoveProduct={mode === "review" ? (index) => {
                    setAdditionalProducts(prev => prev.filter((_, i) => i !== index))
                    setAdditionalFromPhone(prev => prev.filter((_, i) => i !== index))
                  } : undefined}
                  addLabel={t.proStudio?.add || '添加'}
                  badges={mode === "review" ? [
                    ...(activeModel ? [{ label: t.common?.model || '模特', value: activeModel.name ?? '' }] : []),
                    ...(activeBg ? [{ label: t.common?.background || '背景', value: activeBg.name ?? '' }] : []),
                  ] : []}
                />
              )}
              
              {/* Selection Badges Overlay */}
              <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {activeModel && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.common?.model || '模特'}: {activeModel.name}
                  </span>
                )}
                {activeBg && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.common?.background || '背景'}: {activeBg.name}
                  </span>
                )}
              </div>

              {/* Camera overlays - Mobile only */}
              {mode === "camera" && !isDesktop && (
                <>
                  {/* Grid Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Focus Frame */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-pink-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-pink-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-pink-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-pink-400" />
                    </div>
                  </div>
                  
                  <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                    {t.camera?.shootYourProduct || '拍摄你的商品'}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Controls Area - Hide on PC review mode (already has buttons in 3-column layout) */}
            {!(mode === "review" && isDesktop) && (
            <div className={`flex flex-col justify-end pb-safe pt-6 px-6 relative z-20 shrink-0 ${
              isDesktop 
                ? 'bg-white border-t border-zinc-200 min-h-[6rem]' 
                : 'bg-black min-h-[9rem]'
            }`}>
              {mode === "review" ? (
                <div className="space-y-4 pb-4 lg:flex lg:items-center lg:justify-center lg:gap-4 lg:space-y-0">
                  {/* Custom button in review mode */}
                  <div className="flex justify-center lg:order-1">
                    <button 
                      onClick={() => setShowCustomPanel(true)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-colors border ${
                        isDesktop 
                          ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-300'
                          : 'bg-white/10 text-white/90 hover:bg-white/20 border-white/20'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.camera?.customizeModelBg || '自定义模特和背景'}</span>
                    </button>
                  </div>
                  
                  {/* Shoot It button */}
                  <div className="w-full flex justify-center lg:w-auto lg:order-2">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => {
                        triggerFlyToGallery(e)
                        handleShootIt()
                      }}
                      className={`w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 flex items-center justify-center transition-colors ${
                        isDesktop
                          ? 'bg-pink-600 text-white hover:bg-pink-700 shadow-lg'
                          : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                      }`}
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
                      <CreditCostBadge cost={4} className="ml-1" />
                    </motion.button>
                  </div>
                </div>
              ) : isDesktop ? (
                /* Desktop: Hide bottom controls in camera mode */
                <div className="hidden" />
              ) : (
                <CameraBottomBar
                  onAlbumClick={() => fileInputRef.current?.click()}
                  onShutterClick={handleCapture}
                  onAssetClick={() => setShowProductPanel(true)}
                  shutterDisabled={!hasCamera}
                  shutterVariant="gradient-pink"
                  albumLabel={t.camera?.album || '相册'}
                  assetLabel={t.camera?.assetLibrary || '素材库'}
                />
              )}
                        </div>
                      )}
            
            {/* Model and Scene Pickers are rendered at the page level */}
            
            {/* 主商品选择面板 - 使用统一的 AssetPickerPanel */}
            <AssetPickerPanel
              open={showProductPanel}
              onClose={() => setShowProductPanel(false)}
              onSelect={(imageUrl) => {
                setCapturedImage(imageUrl)
                                  setMode("review")
              }}
              onUploadClick={() => fileInputRef.current?.click()}
              themeColor="purple"
              title={t.camera?.selectProduct || '选择商品'}
            />
          </motion.div>
        )}

        {mode === "processing" && (
          <ProcessingView
            numImages={SOCIAL_NUM_IMAGES}
            generatedImages={generatedImages}
            imageSlots={tasks.find(t => t.id === currentTaskId)?.imageSlots?.map(slot => ({
              url: slot.imageUrl,
              status: slot.status as 'generating' | 'completed' | 'failed'
            }))}
            themeColor="pink"
            title={t.social?.generating || 'Creating social photos'}
            mobileStatusLines={[
              t.social?.generatingDesc || 'Generating 4 images, please wait',
              ...(activeModel ? [`Model: ${activeModel.name}`] : []),
              ...(activeBg ? [`Background: ${activeBg.name}`] : []),
            ]}
            showProgressDots
            onShootMore={handleNewPhotoDuringProcessing}
            onReturnHome={handleReturnDuringProcessing}
            onDownload={(url, i) => handleDownload(url, currentGenerationId || undefined, i)}
          />
        )}

        {mode === "results" && (
          <ResultsView
            title={t.social?.result || 'Social Results'}
            onBack={handleRetake}
            images={Array.from({ length: SOCIAL_NUM_GROUPS * SOCIAL_IMAGES_PER_GROUP }).map((_, globalIndex) => {
                      const currentTask = tasks.find(t => t.id === currentTaskId)
                      const slot = currentTask?.imageSlots?.[globalIndex]
                      const url = slot?.imageUrl || generatedImages[globalIndex]
                      const status = slot?.status || (url ? 'completed' : 'failed')
              return {
                url,
                status: status as 'completed' | 'pending' | 'generating' | 'failed',
                error: slot?.error,
              }
            })}
            getBadge={(globalIndex) => {
              const groupIndex = Math.floor(globalIndex / SOCIAL_IMAGES_PER_GROUP)
              const localIndex = globalIndex % SOCIAL_IMAGES_PER_GROUP
              return {
                text: `${GROUP_LABELS[groupIndex]}-${localIndex + 1}`,
                className: groupIndex === 0 ? 'bg-pink-500' : 'bg-purple-500',
              }
            }}
            themeColor="pink"
            onFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onDownload={(url, i) => handleDownload(url, currentGenerationId || undefined, i)}
            onShootNext={handleRetake}
            onGoEdit={handleGoToEdit}
            onRegenerate={handleShootIt}
            onImageClick={(i) => setSelectedResultIndex(i)}
          >
            {/* Photo Detail Dialog */}
            <PhotoDetailDialog
              open={selectedResultIndex !== null && !!(() => {
                const currentTask = tasks.find(t => t.id === currentTaskId)
                const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex!]
                return selectedSlot?.imageUrl || generatedImages[selectedResultIndex!]
              })()}
              onClose={() => setSelectedResultIndex(null)}
              imageUrl={(() => {
                if (selectedResultIndex === null) return ''
                const currentTask = tasks.find(t => t.id === currentTaskId)
                const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                return selectedSlot?.imageUrl || generatedImages[selectedResultIndex] || ''
              })()}
              badges={selectedResultIndex !== null ? [
                { text: t.social?.title || 'Social', className: 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' },
                {
                  text: `${t.social?.group || 'Group'} ${GROUP_LABELS[Math.floor(selectedResultIndex / SOCIAL_IMAGES_PER_GROUP)]}-${(selectedResultIndex % SOCIAL_IMAGES_PER_GROUP) + 1}`,
                  className: Math.floor(selectedResultIndex / SOCIAL_IMAGES_PER_GROUP) === 0 ? 'bg-pink-500 text-white' : 'bg-purple-500 text-white'
                }
              ] : []}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={() => {
                if (selectedResultIndex === null) return
              const currentTask = tasks.find(t => t.id === currentTaskId)
              const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
              const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                if (selectedImageUrl) handleDownload(selectedImageUrl, currentGenerationId || undefined, selectedResultIndex)
              }}
              onFullscreen={() => {
                if (selectedResultIndex === null) return
                const currentTask = tasks.find(t => t.id === currentTaskId)
                const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                if (selectedImageUrl) setFullscreenImage(selectedImageUrl)
              }}
              quickActions={selectedResultIndex !== null ? [
                createQuickActions.tryOn(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (selectedImageUrl) {
                    sessionStorage.setItem('tryOnImage', selectedImageUrl)
                    router.push('/try-on')
                  }
                }),
                createQuickActions.edit(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  setSelectedResultIndex(null)
                  if (selectedImageUrl) handleGoToEdit(selectedImageUrl)
                }),
                createQuickActions.groupShoot(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (selectedImageUrl) {
                    sessionStorage.setItem('groupShootImage', selectedImageUrl)
                    router.push('/group-shot')
                  }
                }),
                createQuickActions.material(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (selectedImageUrl) {
                    sessionStorage.setItem('modifyMaterial_outputImage', selectedImageUrl)
                    sessionStorage.setItem('modifyMaterial_inputImages', JSON.stringify([capturedImage].filter(Boolean)))
                    router.push('/gallery/modify-material')
                  }
                }),
              ] : []}
              inputImages={[
                ...(capturedImage ? [{ url: capturedImage, label: `${t.common?.product || 'Product'} 1` }] : []),
                ...additionalProducts.map((img, idx) => ({ url: img, label: `${t.common?.product || 'Product'} ${idx + 2}` })),
              ]}
              onInputImageClick={(url) => setFullscreenImage(url)}
            >
              {/* Debug content */}
              {debugMode && selectedResultIndex !== null && (() => {
                const generation = currentGenerationId ? generations.find(g => g.id === currentGenerationId) : null
                        const savedParams = generation?.params
                        
                        return (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.camera?.debugParams || 'Debug'}</h3>
                            <div className="grid grid-cols-3 gap-2">
                              {(() => {
                                const modelUrl = savedParams?.modelImage || activeModel?.imageUrl
                                if (!modelUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer" onClick={() => setFullscreenImage(modelUrl)}>
                              <Image src={modelUrl} alt="Model" width={56} height={56} className="w-full h-full object-cover" />
                                      </div>
                            <p className="text-[10px] text-zinc-500 mt-1">{t.common?.model || 'Model'}</p>
                                  </div>
                                )
                              })()}
                              {(() => {
                                const bgUrl = savedParams?.backgroundImage || activeBg?.imageUrl
                                if (!bgUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer" onClick={() => setFullscreenImage(bgUrl)}>
                              <Image src={bgUrl} alt="Background" width={56} height={56} className="w-full h-full object-cover" />
                                      </div>
                            <p className="text-[10px] text-zinc-500 mt-1">{t.common?.background || 'Background'}</p>
                                  </div>
                                )
                              })()}
                          </div>
                        </div>
                        )
                      })()}
            </PhotoDetailDialog>
          </ResultsView>
        )}
      </AnimatePresence>

      {/* Custom Panel - Mobile only, using shared component */}
      {!isDesktop && (
        <CustomPickerPanel
          open={showCustomPanel}
          onClose={() => setShowCustomPanel(false)}
          themeColor="pink"
          tabs={[
            { id: "model", label: t.proStudio?.proModel || "模特" },
            { id: "bg", label: t.proStudio?.studioBg || "背景" }
          ]}
          activeTab={activeCustomTab}
          onTabChange={(id) => setActiveCustomTab(id)}
          modelItems={allModels}
          selectedModelId={selectedModel}
          onSelectModel={setSelectedModel}
          onModelUpload={() => modelUploadRef.current?.click()}
          bgItems={allBackgrounds}
          selectedBgId={selectedBg}
          onSelectBg={setSelectedBg}
          onBgUpload={() => bgUploadRef.current?.click()}
          onZoom={(url) => setFullscreenImage(url)}
          t={{
            customConfig: t.proStudio?.customConfig,
            nextStep: t.proStudio?.nextStep,
            selectModel: t.proStudio?.selectModel,
            selectBg: t.proStudio?.selectBg,
            clearSelection: t.proStudio?.clearSelection,
            upload: t.common.upload,
          }}
        />
      )}
            
      {/* Fullscreen Image Viewer - Using shared component */}
      <FullscreenImageViewer
        open={!!fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        imageUrl={fullscreenImage || ''}
      />
      
      {/* 额外商品选择面板 */}
      <AssetPickerPanel
        open={showProduct2Panel}
        onClose={() => setShowProduct2Panel(false)}
        onSelect={(imageUrl) => {
          if (additionalProducts.length < MAX_ADDITIONAL_PRODUCTS) {
            setAdditionalProducts(prev => [...prev, imageUrl])
            setAdditionalFromPhone(prev => [...prev, false])
          }
          setShowProduct2Panel(false)
        }}
        onUploadClick={() => fileInputRef2.current?.click()}
        themeColor="purple"
        title={t.proStudio?.styleOutfit || '搭配商品'}
      />
      
      {/* Model Picker */}
      <ModelPickerPanel
        open={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        selectedId={selectedModel}
        customModels={allModels}
        onSelect={(model) => setSelectedModel(model.id)}
        onCustomUpload={(model) => {
          addUserAsset(model)
        }}
        themeColor="pink"
        allowUpload
      />
      
      {/* Scene Picker */}
      <ScenePickerPanel
        open={showScenePicker}
        onClose={() => setShowScenePicker(false)}
        selectedId={selectedBg}
        customScenes={allBackgrounds}
        onSelect={(scene) => setSelectedBg(scene.id)}
        sceneType="studio"
        themeColor="pink"
        allowUpload={false}
      />
    </div>
  )
}

// Default export with Suspense wrapper
export default function SocialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
      </div>
    }>
      <SocialPageContent />
    </Suspense>
  )
}
