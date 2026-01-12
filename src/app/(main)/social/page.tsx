"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
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
import { PRESET_PRODUCTS } from "@/data/presets"
import { usePresetStore } from "@/stores/presetStore"
import { useQuota } from "@/hooks/useQuota"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || '资源紧张，请稀后重试'
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
  const [capturedImage2, setCapturedImage2] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [product2FromPhone, setProduct2FromPhone] = useState(false)
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [product2SourceTab, setProduct2SourceTab] = useState<'album' | 'asset'>('album')
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
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("all")
  const [zoomProductImage, setZoomProductImage] = useState<string | null>(null)
  const [activeCustomTab, setActiveCustomTab] = useState("model")
  const [productSourceTab, setProductSourceTab] = useState<"user" | "preset">("preset")
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [modelSubcategory, setModelSubcategory] = useState<'mine' | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<'mine' | null>(null)
  
  const { addGeneration, addUserAsset, userModels, userBackgrounds, userProducts, addFavorite, removeFavorite, isFavorited, favorites, generations } = useAssetStore()
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
  const { quota, checkQuota, refreshQuota } = useQuota()
  
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
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return
    
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
    router.replace('/camera/social?mode=processing')
    
    // Trigger fly animation
    triggerFlyToGallery()
    
    // Reserve quota in background
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: SOCIAL_NUM_IMAGES,
        taskType: 'social',
      }),
    }).then(() => {
      console.log('[Social] Reserved', SOCIAL_NUM_IMAGES, 'images for task', taskId)
      refreshQuota()
    }).catch(e => {
      console.warn('[Social] Failed to reserve quota:', e)
    })
    
    // Start background generation
    runBackgroundGeneration(
      taskId,
      capturedImage,
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
    model: Asset | undefined,
    background: Asset | undefined,
    modelIsUserSelected: boolean,
    bgIsUserSelected: boolean
  ) => {
    try {
      console.log("[Social] Starting generation...")
      console.log("User selected model:", model?.name || 'none (will use random)')
      console.log("User selected background:", background?.name || 'none (will use random)')
      
      // 压缩图片以减少请求体大小（Vercel 限制 4.5MB）
      console.log("[Social] Compressing product image...")
      const compressedImage = await compressBase64Image(inputImage, 1280)
      console.log(`[Social] Compressed: ${(inputImage.length / 1024).toFixed(0)}KB -> ${(compressedImage.length / 1024).toFixed(0)}KB`)
      
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
                    if (window.location.pathname === '/camera/social') {
                      router.replace('/camera/social?mode=results')
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
      
      // Calculate refund for failed images
      const failedCount = SOCIAL_NUM_IMAGES - successCount
      if (failedCount > 0) {
        console.log(`[Social] Refunding ${failedCount} failed images`)
        try {
          await fetch('/api/quota/reserve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              actualImageCount: successCount,
              refundCount: failedCount,
            }),
          })
        } catch (e) {
          console.warn('[Social] Failed to refund:', e)
        }
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
        
        await refreshQuota()
        
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
          if (window.location.pathname === '/camera/social') {
            router.replace('/camera/social?mode=results')
          }
        }
        
        sessionStorage.removeItem('socialTaskId')
      } else {
        // All tasks failed - refund all reserved quota
        console.log('[Social] All tasks failed, refunding all', SOCIAL_NUM_IMAGES, 'images')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        } catch (e) {
          console.warn('[Social] Failed to refund on total failure:', e)
        }
        
        throw new Error(t.camera?.generationFailed || '生成失败')
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.camera?.generationFailed)
      
      // Refund quota on error
      console.log('[Social] Error occurred, refunding reserved quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        await refreshQuota()
      } catch (e) {
        console.warn('[Social] Failed to refund on error:', e)
      }
      
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
  const handleGoToEdit = (imageUrl: string) => {
    sessionStorage.setItem('editImage', imageUrl)
    router.push("/edit/general")
  }
  
  // Handle favorite toggle for result images
  const handleResultFavorite = async (imageIndex: number) => {
    if (!currentGenerationId) return
    
    const currentlyFavorited = isFavorited(currentGenerationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === currentGenerationId && f.imageIndex === imageIndex
      )
      if (fav) {
        await removeFavorite(fav.id)
      }
    } else {
      await addFavorite({
        generationId: currentGenerationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  // Handle download
  const handleDownload = async (url: string, generationId?: string, imageIndex?: number) => {
    fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        generationId,
        imageIndex,
        source: 'social',
      }),
    }).catch(() => {})
    
    try {
      let blob: Blob
      
      if (url.startsWith('data:')) {
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        const response = await fetch(url)
        blob = await response.blob()
      }
      
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `social-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      const link = document.createElement("a")
      link.href = url
      link.download = `social-${Date.now()}.jpg`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  // Asset grid component with upload card
  const AssetGrid = ({ 
    items, 
    selectedId, 
    onSelect,
    onUpload,
    uploadLabel = t.common?.upload || '上传'
  }: { 
    items: Asset[]
    selectedId: string | null
    onSelect: (id: string) => void
    onUpload?: () => void
    uploadLabel?: string
  }) => (
    <div className="grid grid-cols-3 gap-3 p-1 pb-20">
      {onUpload && (
        <button
          onClick={onUpload}
          className="aspect-square rounded-lg overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-pink-500 transition-all flex flex-col items-center justify-center bg-zinc-100 hover:bg-pink-50"
        >
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5 text-pink-600" />
          </div>
          <span className="text-xs text-zinc-600 font-medium">{uploadLabel}</span>
        </button>
      )}
      {items.map(asset => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`aspect-square rounded-lg overflow-hidden relative border-2 transition-all group ${
            selectedId === asset.id 
              ? "border-pink-600 ring-2 ring-pink-200" 
              : "border-transparent hover:border-zinc-200"
          }`}
        >
          <Image src={asset.imageUrl} alt={asset.name || ""} fill className="object-cover" />
          {selectedId === asset.id && (
            <div className="absolute inset-0 bg-pink-600/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          )}
          {asset.isPinned && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm z-10">
              <Pin className="w-2.5 h-2.5" />
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
            <p className="text-[10px] text-white truncate text-center">{asset.name}</p>
          </div>
        </button>
      ))}
    </div>
  )
  
  // 登录状态检查中或未登录时显示加载
  if (authLoading || !user) {
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
          if (file) {
            const base64 = await fileToBase64(file)
            setCapturedImage2(base64)
            setProduct2FromPhone(true)
          }
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
            {/* Top Return Button - Hide on PC camera mode (has its own header) */}
            {!(mode === "camera" && isDesktop) && (
              <div className="absolute top-4 left-4 z-20">
                <button
                  onClick={mode === "review" ? handleRetake : handleReturn}
                  className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
                >
                  {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
                </button>
              </div>
            )}
            
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
                      
                      {/* Right: Image Upload - Click to open Assets panel */}
                      <div className="w-[380px] shrink-0">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                          <button
                            onClick={() => setShowProductPanel(true)}
                            className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 flex flex-col items-center justify-center gap-3 transition-all"
                          >
                            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-zinc-700">{t.social?.uploadProduct || '上传商品图片'}</p>
                              <p className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || 'Click to upload or drag and drop'}</p>
                            </div>
                          </button>
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
                /* Desktop Review Mode - Three Column Layout */
                <div className="absolute inset-0 overflow-y-auto bg-zinc-50">
                  {/* PC Header */}
                  <div className="bg-white border-b border-zinc-200">
                    <div className="max-w-7xl mx-auto px-8 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleRetake}
                          className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5 text-zinc-600" />
                        </button>
                        <h1 className="text-lg font-semibold text-zinc-900">{t.social?.title || '社媒种草'}</h1>
                      </div>
                    </div>
                  </div>
                  
                  {/* Three-column content */}
                  <div className="max-w-7xl mx-auto px-8 py-6">
                    <div className="flex gap-6">
                      {/* Left: Product Image & Generate Button */}
                      <div className="w-[320px] shrink-0 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                          <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-900">{t.social?.productImage || '商品图'}</span>
                            <button onClick={handleRetake} className="text-xs text-zinc-500 hover:text-zinc-700">
                              {t.common?.change || '更换'}
                            </button>
                          </div>
                          <div className="aspect-square relative bg-zinc-50">
                            <img src={capturedImage || ""} alt="商品" className="w-full h-full object-contain" />
                          </div>
                        </div>
                        
                        {/* Additional Products */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-zinc-900">{t.proStudio?.additionalProducts || 'Additional Products (Optional)'}</span>
                            <span className="text-xs text-zinc-400">{(t.proStudio?.maxItems || 'Max {count} items').replace('{count}', '4')}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {capturedImage2 ? (
                              <div className="aspect-square rounded-lg overflow-hidden relative group border border-zinc-200">
                                <img src={capturedImage2} alt="商品2" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setCapturedImage2(null)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ) : null}
                            {!capturedImage2 && (
                              <button
                                onClick={() => setShowProduct2Panel(true)}
                                className="aspect-square rounded-lg border-2 border-dashed border-zinc-300 hover:border-pink-400 flex flex-col items-center justify-center gap-1 transition-colors"
                              >
                                <Plus className="w-5 h-5 text-zinc-400" />
                                <span className="text-[10px] text-zinc-400">{t.proStudio?.add || 'Add'}</span>
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-3">
                            {t.proStudio?.addMoreTip || '💡 Add more products for outfit combination effect'}
                          </p>
                        </div>
                        
                        {/* Generate Button */}
                        <button
                          onClick={(e) => {
                            triggerFlyToGallery(e)
                            handleShootIt()
                          }}
                          className="w-full h-14 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-pink-200/50"
                        >
                          <Wand2 className="w-5 h-5" />
                          {t.social?.generate || '生成种草图'}
                          <CreditCostBadge cost={4} className="ml-2" />
                        </button>
                      </div>
                      
                      {/* Middle: Model Selection */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-zinc-900">{t.social?.selectModel || '选择模特'}</h3>
                            <div className="flex items-center gap-2">
                              {selectedModel && (
                                <button onClick={() => setSelectedModel(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除'}
                                </button>
                              )}
                              {allModels.length > 5 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("model")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                                >
                                  {t.common?.viewMore || '查看更多'} ({allModels.length})
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mb-3">{t.common?.randomMatchHint || '不选则随机匹配'}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => modelUploadRef.current?.click()}
                              className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-pink-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">{t.proStudio?.upload || '上传'}</span>
                            </button>
                            {allModels.slice(0, 5).map(model => (
                              <button
                                key={model.id}
                                onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                                className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all ${
                                  selectedModel === model.id 
                                    ? 'border-pink-500 ring-2 ring-pink-500/30' 
                                    : 'border-transparent hover:border-pink-300'
                                }`}
                              >
                                <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                {selectedModel === model.id && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Background Selection */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-zinc-900">{t.social?.selectBackground || '选择背景'}</h3>
                            <div className="flex items-center gap-2">
                              {selectedBg && (
                                <button onClick={() => setSelectedBg(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除'}
                                </button>
                              )}
                              {allBackgrounds.length > 5 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("bg")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                                >
                                  {t.common?.viewMore || '查看更多'} ({allBackgrounds.length})
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mb-3">{t.common?.randomMatchHint || '不选则随机匹配'}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => bgUploadRef.current?.click()}
                              className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-pink-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">{t.proStudio?.upload || '上传'}</span>
                            </button>
                            {allBackgrounds.slice(0, 5).map(bg => (
                              <button
                                key={bg.id}
                                onClick={() => setSelectedBg(selectedBg === bg.id ? null : bg.id)}
                                className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all ${
                                  selectedBg === bg.id 
                                    ? 'border-pink-500 ring-2 ring-pink-500/30' 
                                    : 'border-transparent hover:border-pink-300'
                                }`}
                              >
                                <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                                {selectedBg === bg.id && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Desktop Modal for View More */}
                  <AnimatePresence>
                    {showCustomPanel && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 bg-black/40 z-40"
                          onClick={() => setShowCustomPanel(false)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-[90vw] max-w-3xl bg-white rounded-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-xl pointer-events-auto"
                          >
                          <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                            <div className="flex gap-4">
                              <button 
                                onClick={() => setActiveCustomTab("model")}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                  activeCustomTab === "model" ? "bg-pink-500 text-white" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.common?.model || '模特'}
                              </button>
                              <button 
                                onClick={() => setActiveCustomTab("bg")}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                  activeCustomTab === "bg" ? "bg-pink-500 text-white" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.common?.background || '背景'}
                              </button>
                            </div>
                            <button 
                              onClick={() => setShowCustomPanel(false)} 
                              className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                            >
                              <X className="w-5 h-5 text-zinc-500" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6">
                            {activeCustomTab === "model" && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-zinc-600">{t.social?.selectModel || '选择模特（不选则随机）'}</span>
                                  {selectedModel && (
                                    <button onClick={() => setSelectedModel(null)} className="text-xs text-pink-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => modelUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">{t.common?.upload || 'Upload'}</span>
                                  </button>
                                  {allModels.map(model => (
                                    <button
                                      key={model.id}
                                      onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedModel === model.id 
                                          ? 'border-pink-500 ring-2 ring-pink-500/30' 
                                          : 'border-transparent hover:border-pink-300'
                                      }`}
                                    >
                                      <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                      {selectedModel === model.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                                          <Check className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {activeCustomTab === "bg" && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-zinc-600">{t.social?.selectBackground || '选择背景（不选则随机）'}</span>
                                  {selectedBg && (
                                    <button onClick={() => setSelectedBg(null)} className="text-xs text-pink-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => bgUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">{t.common?.upload || 'Upload'}</span>
                                  </button>
                                  {allBackgrounds.map(bg => (
                                    <button
                                      key={bg.id}
                                      onClick={() => setSelectedBg(selectedBg === bg.id ? null : bg.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedBg === bg.id 
                                          ? 'border-pink-500 ring-2 ring-pink-500/30' 
                                          : 'border-transparent hover:border-pink-300'
                                      }`}
                                    >
                                      <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                                      {selectedBg === bg.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                                          <Check className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="h-16 border-t flex items-center justify-center px-6">
                            <button 
                              onClick={() => setShowCustomPanel(false)}
                              className="px-8 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium transition-colors"
                            >
                              {t.common?.confirm || '确定'}
                            </button>
                          </div>
                          </motion.div>
                        </div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Mobile Review Mode */
                <div className="absolute inset-0">
                  <img 
                    src={capturedImage || ""} 
                    alt="商品" 
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-md">
                    商品图
                  </span>
                </div>
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
                      className="w-full max-w-xs lg:px-8 h-14 rounded-full text-lg font-semibold gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 shadow-[0_0_20px_rgba(236,72,153,0.3)] flex items-center justify-center transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      {t.social?.generate || '生成种草图'}
                      <CreditCostBadge cost={4} className="ml-2" />
                    </motion.button>
                  </div>
                </div>
              ) : isDesktop ? (
                /* Desktop: Hide bottom controls in camera mode */
                <div className="hidden" />
              ) : (
                <div className="flex items-center justify-center gap-8 pb-4">
                  {/* Album - Left of shutter */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">{t.camera?.album || '相册'}</span>
                  </button>

                  {/* Shutter - Mobile only */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-pink-400/50 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-gradient-to-r from-pink-400 to-purple-400 rounded-full group-active:from-pink-500 group-active:to-purple-500 transition-colors border-2 border-black" />
                  </button>

                  {/* Asset Library - Right of shutter */}
                  <button 
                    onClick={() => setShowProductPanel(true)}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <FolderHeart className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">{t.camera?.assetLibrary || '素材库'}</span>
                  </button>
                </div>
              )}
            </div>
            )}
            
            {/* Slide-up Panel: Custom - Mobile only */}
            <AnimatePresence>
              {showCustomPanel && !isDesktop && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowCustomPanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold text-lg">{t.camera?.customConfig || '自定义配置'}</span>
                      <button 
                        onClick={() => setShowCustomPanel(false)} 
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-700 text-white font-medium text-sm transition-colors"
                      >
                        {t.camera?.nextStep || '下一步'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                      {[
                        { id: "model", label: t.common?.model || '模特' },
                        { id: "bg", label: t.common?.background || '背景' }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setActiveCustomTab(tab.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                            activeCustomTab === tab.id 
                              ? "bg-pink-600 text-white" 
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      {activeCustomTab === "model" && (
                        <div className="space-y-4">
                          {/* Model Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setModelSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !modelSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {t.camera?.allModels || '全部'}
                            </button>
                            <button
                              onClick={() => setModelSubcategory(modelSubcategory === 'mine' ? null : 'mine')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                modelSubcategory === 'mine'
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {t.camera?.myModels || '我的'}
                              {userModels.length > 0 && <span className="ml-1 text-zinc-400">({userModels.length})</span>}
                            </button>
                          </div>
                          <AssetGrid 
                            items={allModels} 
                            selectedId={selectedModel} 
                            onSelect={(id) => {
                              setSelectedModel(selectedModel === id ? null : id)
                            }}
                            onUpload={() => modelUploadRef.current?.click()}
                            uploadLabel={t.camera?.uploadModel || '上传模特'}
                          />
                        </div>
                      )}
                      {activeCustomTab === "bg" && (
                        <div className="space-y-4">
                          {/* Background Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setBgSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !bgSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {t.camera?.allBackgrounds || '全部'}
                            </button>
                            <button
                              onClick={() => setBgSubcategory(bgSubcategory === 'mine' ? null : 'mine')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                bgSubcategory === 'mine'
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {t.camera?.myBackgrounds || '我的'}
                              {userBackgrounds.length > 0 && <span className="ml-1 text-zinc-400">({userBackgrounds.length})</span>}
                            </button>
                          </div>
                          <AssetGrid 
                            items={allBackgrounds} 
                            selectedId={selectedBg} 
                            onSelect={(id) => setSelectedBg(selectedBg === id ? null : id)}
                            onUpload={() => bgUploadRef.current?.click()}
                            uploadLabel={t.camera?.uploadBackground || '上传背景'}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            
            {/* Product Panel - PC: centered modal */}
            <AnimatePresence>
              {showProductPanel && isDesktop && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 z-40"
                    onClick={() => setShowProductPanel(false)}
                  />
                  <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="w-[90vw] max-w-3xl bg-white rounded-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-xl pointer-events-auto"
                    >
                      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                        <span className="font-semibold text-lg">{t.camera?.selectProduct || '选择商品'}</span>
                        <button 
                          onClick={() => setShowProductPanel(false)} 
                          className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                        >
                          <X className="w-5 h-5 text-zinc-500" />
                        </button>
                      </div>
                      
                      <div className="px-6 py-3 border-b bg-white shrink-0">
                        <div className="flex bg-zinc-100 rounded-lg p-1 max-w-md">
                          <button
                            onClick={() => setProductSourceTab("preset")}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                              productSourceTab === "preset"
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700"
                            }`}
                          >
                            {t.camera?.officialExamples || '官方示例'}
                            <span className="ml-1 text-zinc-400">({PRESET_PRODUCTS.length})</span>
                          </button>
                          <button
                            onClick={() => setProductSourceTab("user")}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                              productSourceTab === "user"
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700"
                            }`}
                          >
                            {t.camera?.myProducts || '我的商品'}
                            {userProducts.length > 0 && (
                              <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                            )}
                          </button>
                        </div>
                        
                        {productSourceTab === "user" && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {PRODUCT_SUB_TABS.map(cat => {
                              const count = cat === "all" 
                                ? userProducts.length 
                                : userProducts.filter(p => p.category === cat).length
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setProductSubTab(cat)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                                    productSubTab === cat
                                      ? "bg-pink-500 text-white"
                                      : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                                  }`}
                                >
                                  {getProductCategoryLabel(cat, t)}
                                  <span className="ml-1 opacity-70">({count})</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6">
                        {productSourceTab === "preset" ? (
                          <div className="grid grid-cols-5 gap-4">
                            {/* Upload from Album - First cell */}
                            <button
                              onClick={() => {
                                setShowProductPanel(false)
                                fileInputRef.current?.click()
                              }}
                              className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-500 flex flex-col items-center justify-center gap-2 transition-colors bg-zinc-50 hover:bg-pink-50"
                            >
                              <Plus className="w-8 h-8 text-zinc-400" />
                              <span className="text-xs text-zinc-500 text-center px-2">{t.proStudio?.fromAlbum || 'From Album'}</span>
                            </button>
                            {PRESET_PRODUCTS.map(product => (
                              <div 
                                key={product.id} 
                                className="relative group cursor-pointer"
                                onClick={() => {
                                  setCapturedImage(product.imageUrl)
                                  setMode("review")
                                  setShowProductPanel(false)
                                }}
                              >
                                <div className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all">
                                  <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                                  <span className="absolute top-2 left-2 bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                                    {t.common?.official || '官方'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-600 mt-2 truncate text-center">{product.name}</p>
                              </div>
                            ))}
                          </div>
                        ) : (() => {
                          const filteredProducts = productSubTab === "all" 
                            ? userProducts 
                            : userProducts.filter(p => p.category === productSubTab)
                          
                          return (
                            <div className="grid grid-cols-5 gap-4">
                              {/* Upload from Album - First cell */}
                              <button
                                onClick={() => {
                                  setShowProductPanel(false)
                                  fileInputRef.current?.click()
                                }}
                                className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-500 flex flex-col items-center justify-center gap-2 transition-colors bg-zinc-50 hover:bg-pink-50"
                              >
                                <Plus className="w-8 h-8 text-zinc-400" />
                                <span className="text-xs text-zinc-500 text-center px-2">{t.proStudio?.fromAlbum || 'From Album'}</span>
                              </button>
                              {filteredProducts.map(product => (
                                <div 
                                  key={product.id} 
                                  className="relative group cursor-pointer"
                                  onClick={() => {
                                    setCapturedImage(product.imageUrl)
                                    setMode("review")
                                    setShowProductPanel(false)
                                  }}
                                >
                                  <div className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all">
                                    <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                                  </div>
                                  <p className="text-xs text-zinc-600 mt-2 truncate text-center">{product.name}</p>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </motion.div>
                  </div>
                </>
              )}
            </AnimatePresence>
            
            {/* Product Panel - Mobile: slide-up */}
            <AnimatePresence>
              {showProductPanel && !isDesktop && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowProductPanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">{t.camera?.selectProduct || '选择商品'}</span>
                      <button 
                        onClick={() => setShowProductPanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Source Tabs */}
                    <div className="px-4 py-2 border-b bg-white dark:bg-zinc-900 shrink-0">
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                          onClick={() => setProductSourceTab("preset")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "preset"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          {t.camera?.officialExamples || '官方示例'}
                          <span className="ml-1 text-zinc-400">({PRESET_PRODUCTS.length})</span>
                        </button>
                        <button
                          onClick={() => setProductSourceTab("user")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "user"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          {t.camera?.myProducts || '我的商品'}
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
                      
                      {productSourceTab === "user" && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {PRODUCT_SUB_TABS.map(cat => {
                            const count = cat === "all" 
                              ? userProducts.length 
                              : userProducts.filter(p => p.category === cat).length
                            return (
                              <button
                                key={cat}
                                onClick={() => setProductSubTab(cat)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                  productSubTab === cat
                                    ? "bg-pink-600 text-white"
                                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                }`}
                              >
                                {getProductCategoryLabel(cat, t)}
                                <span className="ml-1 opacity-70">({count})</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      {productSourceTab === "preset" ? (
                        <div className="grid grid-cols-3 gap-3 pb-20 relative">
                          {isLoadingAssets && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
                              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                            </div>
                          )}
                          {PRESET_PRODUCTS.map(product => (
                            <div key={product.id} className="relative group">
                              <button
                                disabled={isLoadingAssets}
                                onClick={() => {
                                  setCapturedImage(product.imageUrl)
                                  setMode("review")
                                  setShowProductPanel(false)
                                }}
                                className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all disabled:opacity-50 w-full"
                              >
                                <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                                <span className="absolute top-1 left-1 bg-pink-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                  {t.common?.official || '官方'}
                                </span>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                  <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                </div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setZoomProductImage(product.imageUrl)
                                }}
                                className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ZoomIn className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (() => {
                        const filteredProducts = productSubTab === "all" 
                          ? userProducts 
                          : userProducts.filter(p => p.category === productSubTab)
                        
                        return filteredProducts.length > 0 ? (
                          <div className="grid grid-cols-3 gap-3 pb-20">
                            {filteredProducts.map(product => (
                              <div 
                                key={product.id} 
                                className="relative group cursor-pointer"
                                style={{ touchAction: 'manipulation' }}
                                onClick={() => {
                                  setCapturedImage(product.imageUrl)
                                  setMode("review")
                                  setShowProductPanel(false)
                                }}
                              >
                                <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-pink-500 active:border-pink-600 transition-all w-full">
                                  <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 pointer-events-none">
                                    <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setZoomProductImage(product.imageUrl)
                                  }}
                                  className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <ZoomIn className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                            <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">{t.camera?.noMyProducts || '暂无商品'}</p>
                            <p className="text-xs mt-1">{t.camera?.uploadInAssets || '请在资产库上传'}</p>
                            <button 
                              onClick={() => {
                                setShowProductPanel(false)
                                router.push("/brand-assets")
                              }}
                              className="mt-4 px-4 py-2 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 transition-colors"
                            >
                              {t.camera?.goUpload || '去上传'}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  </motion.div>
                  
                  {/* 商品放大预览 */}
                  <AnimatePresence>
                    {zoomProductImage && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
                        onClick={() => setZoomProductImage(null)}
                      >
                        <button
                          onClick={() => setZoomProductImage(null)}
                          className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
                        >
                          <X className="w-6 h-6 text-white" />
                        </button>
                        <img 
                          src={zoomProductImage} 
                          alt="商品预览" 
                          className="max-w-[90%] max-h-[80%] object-contain rounded-lg"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 bg-gradient-to-b from-zinc-950 to-purple-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-6">
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-pink-500/30 to-purple-500/30 blur-xl rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <Loader2 className="w-16 h-16 text-pink-400 animate-spin relative z-10" />
            </div>
            
            <h3 className="text-white text-2xl font-bold mb-2">{t.social?.generating || '正在生成种草图...'}</h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              <p>{t.social?.generatingDesc || '4 张图片生成中，请稍候'}</p>
              {activeModel && <p>使用模特: {activeModel.name}</p>}
              {activeBg && <p>使用背景: {activeBg.name}</p>}
            </div>
            
            {/* Progress dots */}
            <div className="flex gap-2 mb-8">
              {Array.from({ length: SOCIAL_NUM_IMAGES }).map((_, i) => {
                const task = tasks.find(t => t.id === currentTaskId)
                const slot = task?.imageSlots?.[i]
                const isCompleted = slot?.status === 'completed'
                const isGenerating = slot?.status === 'generating'
                
                return (
                  <motion.div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      isCompleted ? 'bg-green-500' : isGenerating ? 'bg-pink-500' : 'bg-zinc-600'
                    }`}
                    animate={isGenerating ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )
              })}
            </div>
            
            {/* Action buttons during processing */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-500 text-xs mb-4">{t.camera?.continueInBackground || '可以继续拍摄其他商品'}</p>
              <button
                onClick={handleNewPhotoDuringProcessing}
                className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t.camera?.shootNew || '拍新的'}
              </button>
              <button
                onClick={handleReturnDuringProcessing}
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                {t.camera?.returnHome || '返回首页'}
              </button>
            </div>
            
            <BottomNav forceShow />
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            <div className="h-14 flex items-center px-4 border-b bg-white z-10">
              <button 
                onClick={handleRetake} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold ml-2">{t.social?.result || '本次成片'}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-8">
              {/* 2组 × 2图 网格布局 */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-1 h-4 bg-gradient-to-b from-pink-500 to-purple-500 rounded-full" />
                  {t.social?.resultTitle || '社媒种草图'}
                </h3>
                <span className="text-[10px] text-zinc-400">{t.social?.description || '4 张社媒风格图'}</span>
              </div>
              
              {/* 按组显示 */}
              {Array.from({ length: SOCIAL_NUM_GROUPS }).map((_, groupIndex) => (
                <div key={groupIndex} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      groupIndex === 0 
                        ? 'bg-pink-100 text-pink-600' 
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      {t.social?.group || '组'} {GROUP_LABELS[groupIndex]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: SOCIAL_IMAGES_PER_GROUP }).map((_, localIndex) => {
                      const globalIndex = groupIndex * SOCIAL_IMAGES_PER_GROUP + localIndex
                      const currentTask = tasks.find(t => t.id === currentTaskId)
                      const slot = currentTask?.imageSlots?.[globalIndex]
                      const url = slot?.imageUrl || generatedImages[globalIndex]
                      const status = slot?.status || (url ? 'completed' : 'failed')
                      
                      if (status === 'pending' || status === 'generating') {
                        return (
                          <div key={globalIndex} className="aspect-[3/4] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                            <Loader2 className="w-5 h-5 text-pink-400 animate-spin mb-1" />
                            <span className="text-[9px] text-zinc-400">{t.common?.generating || '生成中'}</span>
                          </div>
                        )
                      }
                      
                      if (status === 'failed' || !url) {
                        return (
                          <div key={globalIndex} className="aspect-[3/4] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-[10px] px-2 text-center">
                            {slot?.error || t.camera?.generationFailed || '生成失败'}
                          </div>
                        )
                      }
                      
                      return (
                        <div 
                          key={globalIndex} 
                          className="group relative aspect-[3/4] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                          onClick={() => setSelectedResultIndex(globalIndex)}
                        >
                          <Image src={url} alt={`Result ${globalIndex + 1}`} fill className="object-cover" />
                          <button 
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                              currentGenerationId && isFavorited(currentGenerationId, globalIndex) 
                                ? "bg-red-500 text-white" 
                                : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResultFavorite(globalIndex)
                            }}
                          >
                            <Heart className={`w-3 h-3 ${currentGenerationId && isFavorited(currentGenerationId, globalIndex) ? "fill-current" : ""}`} />
                          </button>
                          {/* 图片标签：组+序号 */}
                          <div className="absolute bottom-1.5 left-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              groupIndex === 0 
                                ? 'bg-pink-500/80 text-white' 
                                : 'bg-purple-500/80 text-white'
                            }`}>
                              {GROUP_LABELS[groupIndex]}-{localIndex + 1}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 pb-20 bg-white border-t shadow-up">
              <button 
                onClick={handleRetake}
                className="w-full h-12 text-lg rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors"
              >
                {t.camera?.shootNextSet || '继续拍摄'}
              </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && (() => {
              const currentTask = tasks.find(t => t.id === currentTaskId)
              const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
              const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
              
              if (!selectedImageUrl) return null
              
              return (
              <div className="fixed inset-0 z-50 bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                    <button
                      onClick={() => setSelectedResultIndex(null)}
                      className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-700" />
                    </button>
                    <span className="font-semibold text-zinc-900">{t.common?.detail || '详情'}</span>
                    <div className="w-10" />
                  </div>

                  <div className="flex-1 overflow-y-auto bg-zinc-100 pb-24">
                    <div className="bg-zinc-900">
                      <div 
                        className="relative aspect-[3/4] cursor-pointer group"
                        onClick={() => setFullscreenImage(selectedImageUrl)}
                      >
                        <img 
                          src={selectedImageUrl} 
                          alt="Detail" 
                          className="w-full h-full object-contain" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <ZoomIn className="w-6 h-6 text-zinc-700" />
                          </div>
                        </div>
                      </div>
                      <p className="text-center text-zinc-500 text-xs py-2">{t.imageActions?.longPressSave || '长按图片可保存'}</p>
                    </div>
                    
                    <div className="p-4 pb-8 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700">
                              {t.social?.title || '社媒种草'}
                            </span>
                            {/* 组标签 */}
                            {(() => {
                              const groupIdx = Math.floor(selectedResultIndex / SOCIAL_IMAGES_PER_GROUP)
                              const localIdx = selectedResultIndex % SOCIAL_IMAGES_PER_GROUP
                              return (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  groupIdx === 0 
                                    ? 'bg-pink-100 text-pink-600' 
                                    : 'bg-purple-100 text-purple-600'
                                }`}>
                                  {t.social?.group || '组'} {GROUP_LABELS[groupIdx]}-{localIdx + 1}
                                </span>
                              )
                            })()}
                          </div>
                          <p className="text-xs text-zinc-400">
                            {t.common?.justNow || '刚刚'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResultFavorite(selectedResultIndex)}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                              currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex)
                                ? "bg-red-50 border-red-200 text-red-500"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex) ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleDownload(selectedImageUrl, currentGenerationId || undefined, selectedResultIndex)}
                            className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Debug Mode - Generation Parameters */}
                      {debugMode && (() => {
                        // Get generation record from store to display saved params
                        const generation = currentGenerationId 
                          ? generations.find(g => g.id === currentGenerationId)
                          : null
                        const savedParams = generation?.params
                        
                        return (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.camera?.debugParams || '生成参数'}</h3>
                          
                          {/* Reference images grid */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              {/* Input Product Image */}
                              {(capturedImage || generation?.inputImageUrl) && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(capturedImage || generation?.inputImageUrl || '')}
                                  >
                                    <img 
                                      src={capturedImage || generation?.inputImageUrl || ''} 
                                      alt={t.camera?.productOriginal || '商品原图'} 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">{t.common?.product || '商品'}</p>
                                </div>
                              )}
                              
                              {/* Model Image */}
                              {(() => {
                                const modelUrl = savedParams?.modelImage || activeModel?.imageUrl
                                const modelName = savedParams?.model || activeModel?.name
                                if (!modelUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                                    <div 
                                      className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                      onClick={() => setFullscreenImage(modelUrl)}
                                    >
                                      <Image 
                                        src={modelUrl} 
                                        alt="模特" 
                                        width={56}
                                        height={56}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                      {modelName || t.common?.model || '模特'}
                                    </p>
                                  </div>
                                )
                              })()}
                              
                              {/* Background Image */}
                              {(() => {
                                const bgUrl = savedParams?.backgroundImage || activeBg?.imageUrl
                                const bgName = savedParams?.background || activeBg?.name
                                if (!bgUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                                    <div 
                                      className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                      onClick={() => setFullscreenImage(bgUrl)}
                                    >
                                      <Image 
                                        src={bgUrl} 
                                        alt="背景" 
                                        width={56}
                                        height={56}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                                      {bgName || t.common?.background || '背景'}
                                    </p>
                                  </div>
                                )
                              })()}
                            </div>
                            
                            {/* Model Version (AI Model used) */}
                            {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) && (
                              <div className="mt-3 mb-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                  (generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'pro' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {t.gallery?.aiModel || '模型'}: Gemini {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'pro' ? '3.0 Pro' : '2.5 Flash'}
                                  {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'flash' && ` (${t.gallery?.fallback || '降级'})`}
                                </span>
                              </div>
                            )}
                            
                            {/* Model/Background selection status */}
                            <div className="flex gap-2 flex-wrap">
                              {savedParams?.modelIsUserSelected !== undefined && (
                                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                  savedParams.modelIsUserSelected 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-zinc-100 text-zinc-600'
                                }`}>
                                  {t.common?.model || '模特'}: {savedParams.modelIsUserSelected ? (t.gallery?.userUploaded || '用户选择') : (t.social?.autoSelect || '随机')}
                                </span>
                              )}
                              {savedParams?.bgIsUserSelected !== undefined && (
                                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                  savedParams.bgIsUserSelected 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-zinc-100 text-zinc-600'
                                }`}>
                                  {t.common?.background || '背景'}: {savedParams.bgIsUserSelected ? (t.gallery?.userUploaded || '用户选择') : (t.social?.autoSelect || '随机')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        )
                      })()}
                      
                      {/* Go to Edit button */}
                      <button 
                        onClick={() => {
                          setSelectedResultIndex(null)
                          handleGoToEdit(selectedImageUrl)
                        }}
                        className="w-full h-12 mt-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        {t.gallery?.goEdit || '去修图'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}
            
            <BottomNav forceShow />
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
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
              onPinchingStop={(ref) => {
                if (ref.state.scale < 1) {
                  ref.resetTransform()
                }
              }}
            >
              {({ resetTransform }) => (
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
              <span className="text-white/60 text-sm">{t.imageActions?.longPressSaveZoom || '长按可保存，双击还原'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 第二件商品选择面板 - PC: centered modal */}
      <AnimatePresence>
        {showProduct2Panel && isDesktop && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setShowProduct2Panel(false)}
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-[90vw] max-w-3xl bg-white rounded-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-xl pointer-events-auto"
              >
                <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                  <span className="font-semibold text-lg">{t.proStudio?.styleOutfit || '搭配商品'}</span>
                  <button 
                    onClick={() => setShowProduct2Panel(false)} 
                    className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
                
                <div className="px-6 py-3 border-b bg-white shrink-0">
                  <div className="flex bg-zinc-100 rounded-lg p-1 max-w-md">
                    <button
                      onClick={() => setProduct2SourceTab("album")}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        product2SourceTab === "album"
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {t.proStudio?.fromAlbum || '从相册上传'}
                    </button>
                    <button
                      onClick={() => setProduct2SourceTab("asset")}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        product2SourceTab === "asset"
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {t.proStudio?.fromAssets || '从资产库选择'}
                      {userProducts.length > 0 && (
                        <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {product2SourceTab === "album" ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <button
                        onClick={() => {
                          setShowProduct2Panel(false)
                          fileInputRef2.current?.click()
                        }}
                        className="w-40 h-40 rounded-2xl bg-zinc-100 flex flex-col items-center justify-center gap-3 hover:bg-zinc-200 transition-colors border-2 border-dashed border-zinc-300"
                      >
                        <ImageIcon className="w-12 h-12 text-zinc-400" />
                        <span className="text-sm text-zinc-600">{t.proStudio?.clickToUpload || 'Click to upload'}</span>
                      </button>
                      <p className="text-xs text-zinc-500 mt-4">{t.proStudio?.supportedFormats || 'Supports JPG, PNG formats'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-4">
                      {PRESET_PRODUCTS.map(product => (
                        <div 
                          key={product.id}
                          className="relative group cursor-pointer"
                          onClick={() => {
                            setCapturedImage2(product.imageUrl)
                            setProduct2FromPhone(false)
                            setShowProduct2Panel(false)
                          }}
                        >
                          <div className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all">
                            <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                            <span className="absolute top-2 left-2 bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {t.common?.official || '官方'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 mt-2 truncate text-center">{product.name}</p>
                        </div>
                      ))}
                      {userProducts.map(product => (
                        <div 
                          key={product.id}
                          className="relative group cursor-pointer"
                          onClick={() => {
                            setCapturedImage2(product.imageUrl)
                            setProduct2FromPhone(false)
                            setShowProduct2Panel(false)
                          }}
                        >
                          <div className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all">
                            <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                          </div>
                          <p className="text-xs text-zinc-600 mt-2 truncate text-center">{product.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      
      {/* 第二件商品选择面板 - Mobile: slide-up */}
      <AnimatePresence>
        {showProduct2Panel && !isDesktop && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
              onClick={() => setShowProduct2Panel(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.proStudio?.styleOutfit || '搭配商品'}</span>
                <button 
                  onClick={() => setShowProduct2Panel(false)} 
                  className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="px-4 py-2 border-b bg-white dark:bg-zinc-900">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setProduct2SourceTab("album")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      product2SourceTab === "album"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.proStudio?.fromAlbum || '从相册上传'}
                  </button>
                  <button
                    onClick={() => setProduct2SourceTab("asset")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      product2SourceTab === "asset"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.proStudio?.fromAssets || '从资产库选择'}
                    {userProducts.length > 0 && (
                      <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                {product2SourceTab === "album" ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <button
                      onClick={() => {
                        setShowProduct2Panel(false)
                        fileInputRef2.current?.click()
                      }}
                      className="w-32 h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <ImageIcon className="w-10 h-10 text-zinc-500" />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">{t.proStudio?.clickToUpload || 'Click to upload'}</span>
                    </button>
                    <p className="text-xs text-zinc-500 mt-4">{t.proStudio?.supportedFormats || 'Supports JPG, PNG formats'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 pb-20">
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setCapturedImage2(product.imageUrl)
                          setProduct2FromPhone(false)
                          setShowProduct2Panel(false)
                        }}
                        className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all"
                      >
                        <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-pink-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                          {t.common?.official || '官方'}
                        </span>
                      </button>
                    ))}
                    {userProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setCapturedImage2(product.imageUrl)
                          setProduct2FromPhone(false)
                          setShowProduct2Panel(false)
                        }}
                        className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all"
                      >
                        <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
