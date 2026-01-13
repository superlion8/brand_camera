"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Check, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, Pin, ZoomIn, FolderHeart, Plus, Upload
} from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore, base64ToBlobUrl } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, fetchWithTimeout, ensureBase64, saveProductToAssets } from "@/lib/utils"
import { ensureImageUrl } from "@/lib/supabase/storage"
import { Asset, ModelStyle, ModelGender } from "@/types"
import Image from "next/image"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { ModelPickerPanel } from "@/components/shared/ModelPickerPanel"
import { ScenePickerPanel } from "@/components/shared/ScenePickerPanel"
import { AssetGrid } from "@/components/shared/AssetGrid"
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

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || 'Resource busy, please try again later'
  }
  return error
}

// Gender IDs - labels come from translations
const MODEL_GENDER_IDS: ModelGender[] = ["female", "male", "girl", "boy"]

type CameraMode = "camera" | "review" | "processing" | "results"

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

// Generation config - 4 images total (2 simple + 2 extended)
const CAMERA_NUM_IMAGES = 4
const CAMERA_NUM_SIMPLE = 2

function CameraPageContent() {
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
  
  // Build gender options with translations
  const MODEL_GENDERS = MODEL_GENDER_IDS.map(id => ({
    id,
    label: t.common[id as keyof typeof t.common] || id,
  }))
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null) // For second product image
  const modelUploadRef = useRef<HTMLInputElement>(null) // For model upload
  const bgUploadRef = useRef<HTMLInputElement>(null) // For background/environment upload
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Mode and state
  const [mode, setMode] = useState<CameraMode>("camera")
  const modeRef = useRef<CameraMode>("camera") // Track mode for async callbacks
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedImage2, setCapturedImage2] = useState<string | null>(null) // Second product image
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<('extended' | 'simple')[]>([])
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([])
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null) // Track current task
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Keep modeRef in sync with mode
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  
  // Check camera permission on mount - use sessionStorage to avoid repeated prompts
  // Skip on PC Web - camera features are only for mobile
  useEffect(() => {
    const checkCameraPermission = async () => {
      // Skip camera permission check on desktop - only upload is available
      if (isDesktop) {
        setHasCamera(false)
        setPermissionChecked(true)
        return
      }
      
      try {
        // First check localStorage for cached permission state
        const cachedPermission = localStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
          setPermissionChecked(true)
          return
        }
        
        // Check if permission API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
            localStorage.setItem('cameraPermissionGranted', 'true')
          } else if (result.state === 'denied') {
            setHasCamera(false)
            localStorage.setItem('cameraPermissionGranted', 'false')
          }
          
          // Listen for permission changes
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
        // Permission API not supported, try to get stream directly
        console.log('Permission API not supported, trying direct stream access')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          // Permission granted, stop the stream (Webcam will create its own)
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
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState("model")
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedModelStyle, setSelectedModelStyle] = useState<ModelStyle | null>(null)
  const [selectedModelGender, setSelectedModelGender] = useState<ModelGender | null>(null)
  const [modelSubcategory, setModelSubcategory] = useState<'mine' | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<'mine' | null>(null)
  
  // Track if product images came from phone upload (not asset library)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [product2FromPhone, setProduct2FromPhone] = useState(false)
  
  const { addGeneration, addUserAsset, userModels, userBackgrounds, userProducts, generations } = useAssetStore()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  
  // 从 URL 参数读取 mode（从 outfit 页面跳转过来时）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as CameraMode)
      // 从 sessionStorage 恢复 taskId
      const savedTaskId = sessionStorage.getItem('buyerShowTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[Camera] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modelTypes = gen.output_model_types || []
                const genModes = gen.output_gen_modes || []
                if (images.length > 0) {
                  console.log('[Camera] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                  setGeneratedModelTypes(modelTypes)
                  setGeneratedGenModes(genModes)
                  setCurrentGenerationId(gen.id)
                } else {
                  console.log('[Camera] No images found in database, returning to camera')
                  setMode('camera')
                  sessionStorage.removeItem('buyerShowTaskId')
                }
              } else {
                console.log('[Camera] Task not found in database, returning to camera')
                setMode('camera')
                sessionStorage.removeItem('buyerShowTaskId')
              }
            })
            .catch(err => {
              console.error('[Camera] Failed to recover images:', err)
              setMode('camera')
              sessionStorage.removeItem('buyerShowTaskId')
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
  const { quota, checkQuota } = useQuota()
  const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
  
  // Helper to sort by pinned status
  const sortByPinned = (assets: Asset[]) => 
    [...assets].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
  
  // 监听任务完成，自动切换到 results 模式（从 outfit 页面跳转过来时）
  useEffect(() => {
    if (mode !== 'processing' || !currentTaskId) return
    
    const currentTask = tasks.find(t => t.id === currentTaskId)
    if (!currentTask?.imageSlots) return
    
    // 检查是否有任何一张图片完成
    const hasAnyCompleted = currentTask.imageSlots.some(s => s.status === 'completed')
    
    if (hasAnyCompleted) {
      console.log('[Camera] Task has completed images, switching to results mode')
      // 更新 generatedImages 从 imageSlots
      const images = currentTask.imageSlots.map(s => s.imageUrl || '')
      const modelTypes = currentTask.imageSlots.map(s => (s.modelType === 'pro' || s.modelType === 'flash' ? s.modelType : 'pro') as 'pro' | 'flash')
      const genModes = currentTask.imageSlots.map(s => s.genMode || 'simple')
      setGeneratedImages(images)
      setGeneratedModelTypes(modelTypes)
      setGeneratedGenModes(genModes)
      setMode('results')
      // 检查是否仍在buyer-show页面，避免用户离开后强制跳转
      if (window.location.pathname === '/buyer-show') {
        router.replace('/buyer-show?mode=results')
      }
    }
  }, [mode, currentTaskId, tasks, router])
  
  // Filter assets by category - 'mine' shows only user assets
  const filteredModels = modelSubcategory === 'mine'
    ? sortByPinned(userModels)
    : [...sortByPinned(userModels), ...visibleModels]
  
  const filteredBackgrounds = bgSubcategory === 'mine'
    ? sortByPinned(userBackgrounds)
    : [...sortByPinned(userBackgrounds), ...visibleBackgrounds]
  
  // Aliases for compatibility
  const allModels = filteredModels
  const allBackgrounds = filteredBackgrounds
  
  // Get selected assets from merged arrays
  const activeModel = allModels.find(m => m.id === selectedModel)
  const activeBg = allBackgrounds.find(b => b.id === selectedBg)
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  // 拍照 - 使用 WebRTC 高分辨率
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      // 获取视频的实际分辨率，保持正确的宽高比
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      // 使用视频的实际分辨率进行截图，避免变形
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setProductFromPhone(true) // Mark as captured from camera (phone)
        setMode("review")
      }
    }
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setProductFromPhone(true) // Mark as uploaded from phone
      setMode("review")
    }
  }, [])
  
  // Upload second product image
  const handleUpload2 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage2(base64)
      setProduct2FromPhone(true) // Mark as uploaded from phone
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
    // Reset input so same file can be selected again
    if (e.target) e.target.value = ''
  }, [addUserAsset])
  
  // Upload background/environment image directly in selector
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
    // Reset input so same file can be selected again
    if (e.target) e.target.value = ''
  }, [addUserAsset])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
    // Cache permission state in localStorage
    localStorage.setItem('cameraPermissionGranted', 'true')
  }, [])
  
  const handleRetake = () => {
    setCapturedImage(null)
    setCapturedImage2(null)
    setProductFromPhone(false)
    setProduct2FromPhone(false)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return
    
    // Clear previous results first (for Regenerate to show skeleton)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    
    // Check quota before starting generation
    const hasQuota = await checkQuota(CAMERA_NUM_IMAGES)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Capture current selections BEFORE any async operations
    const currentModelStyle = selectedModelStyle
    const currentModelGender = selectedModelGender
    const currentModel = activeModel // May be undefined - random selection happens per-image
    const currentBg = activeBg       // May be undefined - random selection happens per-image
    const currentProduct2 = capturedImage2
    const currentProductFromPhone = productFromPhone
    const currentProduct2FromPhone = product2FromPhone
    
    // Track if user selected or will use random (per-image)
    const modelIsUserSelected = !!activeModel
    const bgIsUserSelected = !!activeBg
    
    // Note: Random model/background selection now happens per-image in runBackgroundGeneration
    // This ensures each of the 6 images can have different random model/background
    
    // Save phone-uploaded product images to asset library BEFORE generation
    // This ensures products are saved even if generation fails
    if (currentProductFromPhone && capturedImage) {
      saveProductToAssets(capturedImage, addUserAsset, t.common.product)
    }
    if (currentProduct2FromPhone && currentProduct2) {
      saveProductToAssets(currentProduct2, addUserAsset, t.common.product)
    }
    
    // Create task and switch to processing mode
    const params = {
      modelStyle: currentModelStyle || undefined,
      modelGender: currentModelGender || undefined,
      model: currentModel?.name || '每张随机',
      background: currentBg?.name || '每张随机',
      hasProduct2: !!currentProduct2,
      modelIsUserSelected, // Track if user selected or system random
      bgIsUserSelected,    // Track if user selected or system random
    }
    
    const taskId = addTask('camera', capturedImage, params, CAMERA_NUM_IMAGES)
    setCurrentTaskId(taskId)
    // 初始化 imageSlots - 每张图一个独立状态
    initImageSlots(taskId, CAMERA_NUM_IMAGES)
    setMode("processing")
    
    // 保存 taskId 到 sessionStorage（刷新后可恢复）
    sessionStorage.setItem('buyerShowTaskId', taskId)
    
    // 更新 URL（便于刷新后恢复状态）
    router.replace('/buyer-show?mode=processing')
    
    // 预扣配额（使用统一 hook）
    const reserveResult = await reserveQuota({
          taskId,
          imageCount: CAMERA_NUM_IMAGES,
          taskType: 'model_studio',
    })
    
    if (!reserveResult.success) {
      console.error('[BuyerShow] Failed to reserve quota:', reserveResult.error)
      setMode('camera')
      router.replace('/buyer-show')
      return
    }
    
    // Start background generation with captured values
    runBackgroundGeneration(
      taskId, 
      capturedImage,
      currentProduct2,
      currentModelStyle,
      currentModelGender,
      currentModel,
      currentBg,
      currentProductFromPhone,
      currentProduct2FromPhone,
      modelIsUserSelected,
      bgIsUserSelected
    )
  }
  
  // Background generation function (runs async, doesn't block UI)
  // All parameters are passed explicitly to avoid closure issues
  const runBackgroundGeneration = async (
    taskId: string, 
    inputImage: string,
    inputImage2: string | null,
    modelStyle: ModelStyle | null,
    modelGender: ModelGender | null,
    model: Asset | undefined,
    background: Asset | undefined,
    fromPhone: boolean,
    fromPhone2: boolean,
    modelIsUserSelected: boolean,
    bgIsUserSelected: boolean
  ) => {
    try {
      // Compress and prepare images before sending
      console.log("Preparing images...")
      console.log("User selected model:", model?.name || 'none (will use random per image)')
      console.log("User selected background:", background?.name || 'none (will use random per image)')
      console.log("Has second product:", !!inputImage2)
      
      // 压缩图片以减少请求体大小（Vercel 限制 4.5MB）
      console.log("[Camera] Compressing product images...")
      const compressedProduct = await compressBase64Image(inputImage, 1280)
      const compressedProduct2 = inputImage2 ? await compressBase64Image(inputImage2, 1280) : null
      console.log(`[Camera] Compressed: ${(inputImage.length / 1024).toFixed(0)}KB -> ${(compressedProduct.length / 1024).toFixed(0)}KB`)
      
      // 直接使用 URL，后端会转换为 base64（减少前端请求体大小）
      const userModelUrl = model?.imageUrl || null
      const userBgUrl = background?.imageUrl || null
      
      // For saving purposes, if user didn't select model/background, 
      // pick a random one as "representative" for the generation record
      let representativeModelUrl = model?.imageUrl
      let representativeModelName = model?.name
      let representativeBgUrl = background?.imageUrl
      let representativeBgName = background?.name
      
      if (!model) {
        const randomModelForSave = getRandomModel()
        if (randomModelForSave) {
          representativeModelUrl = randomModelForSave.imageUrl
          representativeModelName = randomModelForSave.name
        }
      }
      if (!background) {
        const randomBgForSave = getRandomBackground()
        if (randomBgForSave) {
          representativeBgUrl = randomBgForSave.imageUrl
          representativeBgName = randomBgForSave.name
        }
      }
      
      // Use the constants defined at module level
      const NUM_IMAGES = CAMERA_NUM_IMAGES
      const NUM_SIMPLE = CAMERA_NUM_SIMPLE
      
      console.log(`Sending ${NUM_IMAGES} staggered generation requests (1s apart)...`)
      console.log(`Config: ${NUM_SIMPLE} simple + ${NUM_IMAGES - NUM_SIMPLE} extended`)
      
      const staggerDelay = 1000 // 1 second between each request
      
      // 使用同步标志防止多张图片同时完成时重复设置 currentGenerationId
      // modeRef.current 通过 useEffect 异步更新，不能可靠地防止并发
      let firstImageReceived = false
      
      // Track per-image model/background for saving later
      const perImageModels: { name: string; imageUrl: string; isRandom: boolean; isPreset: boolean }[] = Array(NUM_IMAGES).fill(null)
      const perImageBackgrounds: { name: string; imageUrl: string; isRandom: boolean; isPreset: boolean }[] = Array(NUM_IMAGES).fill(null)
      
      // Helper to check if URL is from preset storage
      const isPresetUrl = (url: string) => url?.includes('/presets/') || url?.includes('presets%2F')
      
      // Result type for image generation
      interface ImageResult {
        index: number
        success: boolean
        image?: string
        modelType?: 'pro' | 'flash'
        genMode?: 'simple' | 'extended'
        prompt?: string
        duration?: number
        error?: string
        savedToDb?: boolean // 后端是否已写入数据库
        dbId?: string // 数据库 UUID，用于收藏功能
      }
      
      // Helper to create a delayed request for model images
      // Each request gets its own model/background (random if not user-selected)
      const createModelRequest = async (index: number, delayMs: number, simpleMode: boolean): Promise<ImageResult> => {
        // For each image, use user's selection or pick random
        // 直接使用 URL，后端会转换为 base64
        let modelForThisImage = userModelUrl
        let bgForThisImage = userBgUrl
        let modelNameForThis = model?.name || ''
        let bgNameForThis = background?.name || ''
        let modelUrlForThis = model?.imageUrl || ''
        let bgUrlForThis = background?.imageUrl || ''
        let modelIsRandom = false
        let bgIsRandom = false
        
        // If user didn't select model, pick a random one for this image
        if (!modelForThisImage) {
          const randomModel = getRandomModel()
          if (!randomModel) {
            console.error(`Image ${index + 1}: No models available`)
            updateImageSlot(taskId, index, { status: 'failed', error: '没有可用的模特' })
            return { index, success: false, error: '没有可用的模特' }
          }
          modelForThisImage = randomModel.imageUrl
          modelNameForThis = randomModel.name || t.common.model
          modelUrlForThis = randomModel.imageUrl || ''
          modelIsRandom = true
          console.log(`Image ${index + 1}: Random model = ${randomModel.name}`)
        }
        
        // If user didn't select background, pick a random one for this image
        if (!bgForThisImage) {
          const randomBg = getRandomBackground()
          if (!randomBg) {
            console.error(`Image ${index + 1}: No backgrounds available`)
            updateImageSlot(taskId, index, { status: 'failed', error: '没有可用的背景' })
            return { index, success: false, error: '没有可用的背景' }
          }
          bgForThisImage = randomBg.imageUrl
          bgNameForThis = randomBg.name || t.common.background
          bgUrlForThis = randomBg.imageUrl || ''
          bgIsRandom = true
          console.log(`Image ${index + 1}: Random background = ${randomBg.name}`)
        }
        
        // Save per-image model/background info with isRandom and isPreset flags
        perImageModels[index] = { 
          name: modelNameForThis, 
          imageUrl: modelUrlForThis, 
          isRandom: modelIsRandom,
          isPreset: isPresetUrl(modelUrlForThis)
        }
        perImageBackgrounds[index] = { 
          name: bgNameForThis, 
          imageUrl: bgUrlForThis, 
          isRandom: bgIsRandom,
          isPreset: isPresetUrl(bgUrlForThis)
        }
        
        const payload = {
          productImage: compressedProduct,
          productImage2: compressedProduct2,
          modelImage: modelForThisImage,
          modelStyle: modelStyle,
          modelGender: modelGender,
          backgroundImage: bgForThisImage,
          type: 'model',
          index,
          simpleMode,
          // Pass model/bg info for logging
          modelName: modelNameForThis,
          bgName: bgNameForThis,
          // 传递 taskId，让后端直接写入数据库
          taskId,
          inputParams: {
            modelStyle,
            modelGender,
            model: modelNameForThis,
            background: bgNameForThis,
            modelIsUserSelected: !modelIsRandom,
            bgIsUserSelected: !bgIsRandom,
            // 当前图片的模特/背景详细信息
            perImageModels: [{ 
              name: modelNameForThis, 
              imageUrl: modelUrlForThis, 
              isRandom: modelIsRandom,
              isPreset: isPresetUrl(modelUrlForThis)
            }],
            perImageBackgrounds: [{ 
              name: bgNameForThis, 
              imageUrl: bgUrlForThis, 
              isRandom: bgIsRandom,
              isPreset: isPresetUrl(bgUrlForThis)
            }],
            modelImage: modelUrlForThis,
            backgroundImage: bgUrlForThis,
          },
        }
        
        // 返回处理结果而不是 Response（因为我们需要在这里解析并实时更新状态）
        return new Promise<ImageResult>((resolve) => {
          setTimeout(async () => {
            const mode = simpleMode ? 'simple' : 'extended'
            console.log(`Starting Image ${index + 1} (${mode}) - Model: ${modelNameForThis}, Bg: ${bgNameForThis}`)
            
            // 更新状态为 generating
            updateImageSlot(taskId, index, { status: 'generating' })
            
            try {
              const response = await fetch("/api/generate-single", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(payload),
              })
              
              // 处理响应并立即更新状态
              // 先获取响应文本，以便处理非 JSON 响应
              const responseText = await response.text()
              let result: any
              
              try {
                result = JSON.parse(responseText)
              } catch (parseError) {
                // 响应不是有效的 JSON
                console.error(`Image ${index + 1}: Response is not JSON:`, responseText.substring(0, 100))
                let errorMsg = '服务器返回格式错误'
                if (response.status === 413) {
                  errorMsg = '图片太大，请使用较小的图片'
                } else if (response.status >= 500) {
                  errorMsg = '服务器繁忙，请稍后重试'
                } else if (responseText.toLowerCase().includes('rate') || responseText.toLowerCase().includes('limit')) {
                  errorMsg = '请求太频繁，请稍后再试'
                }
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorMsg 
                })
                resolve({ index, success: false, error: errorMsg })
                return
              }
              
              if (!response.ok) {
                const errorMsg = getErrorMessage(result.error || 'Unknown error', t)
                console.log(`Image ${index + 1}: ✗ HTTP ${response.status} (${errorMsg})`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorMsg 
                })
                resolve({ index, success: false, error: errorMsg })
                return
              }
              if (result.success && result.image) {
                const genMode = result.generationMode || (simpleMode ? 'simple' : 'extended')
                // 如果是 Storage URL 直接用，如果是 base64 转换为 Blob URL
                const imageUrl = result.image.startsWith('data:') 
                  ? base64ToBlobUrl(result.image) 
                  : result.image
                console.log(`Image ${index + 1}: ✓ (${result.modelType}, ${mode}, ${result.duration}ms, savedToDb: ${result.savedToDb})`)
                updateImageSlot(taskId, index, {
                  status: 'completed',
                  imageUrl: imageUrl,
                  modelType: result.modelType,
                  genMode: genMode,
                  dbId: result.dbId, // 存储数据库 UUID
                })
                
                // 第一张图片完成时，立即切换到 results 模式
                // 使用 firstImageReceived 同步标志（而非 modeRef）防止并发图片重复触发
                if (!firstImageReceived && modeRef.current === "processing") {
                  firstImageReceived = true
                  console.log(`[Camera] First image ready, switching to results mode`)
                  setMode("results")
                  // 设置 currentGenerationId 为数据库 UUID，用于收藏
                  // 如果没有 dbId（后端保存失败），则使用临时 taskId 作为 fallback
                  const generationId = result.dbId || taskId
                  setCurrentGenerationId(generationId)
                  console.log(`[Camera] Set currentGenerationId to: ${generationId} (dbId: ${result.dbId})`)
                }
                
                resolve({ 
                  index, 
                  success: true, 
                  image: result.image, // Storage URL 或 base64
                  modelType: result.modelType,
                  genMode: genMode,
                  prompt: result.prompt,
                  duration: result.duration,
                  savedToDb: result.savedToDb, // 后端是否已写入数据库
                  dbId: result.dbId, // 数据库 UUID
                })
              } else {
                const errorMsg = result.error || '生成失败'
                console.log(`Image ${index + 1}: ✗ (${errorMsg})`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorMsg 
                })
                resolve({ index, success: false, error: errorMsg })
              }
            } catch (e: any) {
              // 处理常见的网络错误
              let errorMsg = e.message || '网络错误'
              // Safari: "Load failed", Chrome: "Failed to fetch"
              if (errorMsg.toLowerCase().includes('load failed') || 
                  errorMsg.toLowerCase().includes('failed to fetch') ||
                  errorMsg.toLowerCase().includes('network') ||
                  errorMsg.toLowerCase().includes('abort')) {
                errorMsg = t.errors.networkError || '网络请求失败，请重试'
              }
              console.log(`Image ${index + 1}: ✗ (${e.message} -> ${errorMsg})`)
              updateImageSlot(taskId, index, { 
                status: 'failed', 
                error: errorMsg 
              })
              resolve({ index, success: false, error: errorMsg })
            }
          }, delayMs)
        })
      }
      
      // Create model image requests:
      // First NUM_SIMPLE: 极简模式 (simple mode)
      // Rest: 扩展模式 (extended mode)
      const requests = []
      for (let i = 0; i < NUM_IMAGES; i++) {
        const isSimple = i < NUM_SIMPLE
        requests.push(createModelRequest(i, staggerDelay * i, isSimple))
      }
      
      // Wait for all to complete (UI already updated in real-time via updateImageSlot)
      const results = await Promise.all(requests)
      
      // Collect results for saving to assetStore
      const allImages: (string | null)[] = Array(NUM_IMAGES).fill(null)
      const allModelTypes: (('pro' | 'flash') | null)[] = Array(NUM_IMAGES).fill(null)
      const allPrompts: (string | null)[] = Array(NUM_IMAGES).fill(null)
      const allGenModes: (('extended' | 'simple') | null)[] = Array(NUM_IMAGES).fill(null)
      let maxDuration = 0
      let allSavedToDb = true // 检查是否所有成功的图片都已被后端保存
      let firstDbId: string | null = null // 追踪第一个有效的 dbId，用于 fallback
      
      for (const result of results) {
        if (result.success && result.image) {
          allImages[result.index] = result.image
          allModelTypes[result.index] = result.modelType || 'pro'
          allPrompts[result.index] = result.prompt || null
          allGenModes[result.index] = result.genMode || 'extended'
          maxDuration = Math.max(maxDuration, result.duration || 0)
          if (!result.savedToDb) {
            allSavedToDb = false
          }
          // 追踪第一个有效的 dbId（无论是哪张图片返回的）
          if (result.dbId && !firstDbId) {
            firstDbId = result.dbId
          }
        }
      }
      
      // Keep arrays as-is (with nulls) to preserve position mapping
      // Simple mode: indices 0, 1, 2
      // Extended mode: indices 3, 4, 5
      const successCount = allImages.filter(img => img !== null).length
      
      // Create combined data object - preserve positions (nulls become empty strings for display)
      const data = {
        success: successCount > 0,
        images: allImages.map(img => img || ''), // Replace null with empty string
        modelTypes: allModelTypes.map(t => t || 'pro'), // Default to 'pro'
        genModes: allGenModes.map(m => m || 'extended'), // Default to 'extended'
        prompts: allPrompts.map(p => p || ''), // Replace null with empty string
        stats: {
          total: NUM_IMAGES,
          successful: successCount,
          duration: maxDuration,
        }
      }
      
      console.log(`Generation complete: ${successCount}/${NUM_IMAGES} images in ~${maxDuration}ms`)
      console.log('Final images array:', allImages.map((img, i) => img ? `✓[${i}]` : `✗[${i}]`).join(' '))
      
      // 部分退款（使用统一 hook）
      if (successCount > 0 && successCount < NUM_IMAGES) {
        await partialRefund(taskId, successCount)
      }
      
      if (data.success && data.images.length > 0) {
        
        // Update task with results
        updateTaskStatus(taskId, 'completed', data.images)
        
        // Note: Product images are now saved in handleShootIt() before generation starts
        // This ensures products are saved even if generation fails
        
        // Save to IndexedDB/history - filter out empty strings (failed images)
        const id = taskId
        const savedImages: string[] = []
        const savedModelTypes: ('pro' | 'flash')[] = []
        const savedGenModes: ('extended' | 'simple')[] = []
        const savedPrompts: string[] = []
        
        data.images.forEach((img, i) => {
          if (img) {
            savedImages.push(img)
            savedModelTypes.push(data.modelTypes[i])
            savedGenModes.push(data.genModes[i])
            savedPrompts.push(data.prompts[i])
          }
        })
        
        // Filter per-image info to match saved images (only successful ones)
        const savedPerImageModels: { name: string; imageUrl: string }[] = []
        const savedPerImageBgs: { name: string; imageUrl: string }[] = []
        data.images.forEach((img, i) => {
          if (img) {
            savedPerImageModels.push(perImageModels[i])
            savedPerImageBgs.push(perImageBackgrounds[i])
          }
        })
        
        // 如果后端已经写入数据库，跳过云端同步（避免重复写入）
        // addGeneration 仍会更新本地 store 和 IndexedDB
        await addGeneration({
          id,
          type: "camera_model",
          inputImageUrl: inputImage,
          inputImage2Url: inputImage2 || undefined,
          outputImageUrls: savedImages,
          outputModelTypes: savedModelTypes, // Pro or Flash for each image
          outputGenModes: savedGenModes, // Simple or Extended for each image
          prompts: savedPrompts, // Per-image prompts
          createdAt: new Date().toISOString(),
          params: { 
            modelStyle: modelStyle || undefined,
            modelGender: modelGender || undefined,
            model: representativeModelName,
            background: representativeBgName,
            modelImage: representativeModelUrl,
            backgroundImage: representativeBgUrl,
            modelIsUserSelected, // true = user selected, false = system random
            bgIsUserSelected,    // true = user selected, false = system random
            perImageModels: savedPerImageModels,
            perImageBackgrounds: savedPerImageBgs,
          },
        }, allSavedToDb) // 后端已写入数据库时，跳过前端的云端同步
        
        // 刷新配额显示（使用统一 hook）
        await confirmQuota()
        
        // If still on processing mode for this task, show results
        // Use modeRef.current to get the latest mode value (avoid stale closure)
        if (modeRef.current === "processing") {
          setGeneratedImages(data.images)
          setGeneratedModelTypes(data.modelTypes || [])
          setGeneratedGenModes(data.genModes || [])
          setGeneratedPrompts(data.prompts || [])
          // 只有当第一张图片成功时没有设置 currentGenerationId（即 firstDbId 为 null）时才设置 fallback
          // 这避免了重复调用 setCurrentGenerationId 和潜在的 race condition
          if (!firstDbId) {
            setCurrentGenerationId(taskId)
            console.log(`[Camera] Fallback: No dbId received, using taskId: ${taskId}`)
          }
          setMode("results")
          // 更新 URL 为 results 模式（检查是否仍在buyer-show页面）
          if (window.location.pathname === '/buyer-show') {
            router.replace('/buyer-show?mode=results')
          }
        }
        
        // 清理 sessionStorage（任务完成）
        sessionStorage.removeItem('buyerShowTaskId')
      } else {
        // 全部失败，全额退款（使用统一 hook）
        await refundQuota(taskId)
        
        // Log more details
        const failedCount = results.filter(r => !r.success).length
        console.error(`All tasks failed. Failed: ${failedCount}/${results.length}`)
        throw new Error(t.camera.generationFailed)
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.camera.generationFailed)
      
      // 异常退款（使用统一 hook）
      await refundQuota(taskId)
      
      // Only alert if still on processing screen
      // Use modeRef.current to get the latest mode value
      if (modeRef.current === "processing") {
        if (error.name === 'AbortError') {
          alert(t.errors.generateFailed)
        } else {
          const errorMsg = getErrorMessage(error.message, t) || t.errors.generateFailed
          alert(errorMsg)
        }
        setMode("review")
      }
      
      // 清理 sessionStorage（任务失败）
      sessionStorage.removeItem('buyerShowTaskId')
    }
  }
  
  // Handle return during processing - allow going home
  const handleReturnDuringProcessing = () => {
    router.push("/")
  }
  
  // Handle taking new photo during processing
  const handleNewPhotoDuringProcessing = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setMode("camera")
  }
  
  const handleReturn = () => {
    router.push("/")
  }
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => navigateToEdit(router, imageUrl)
  
  // Handle download - using shared hook with tracking
  const { downloadImage } = useImageDownload({ 
    trackingSource: 'camera', 
    filenamePrefix: 'brand-camera' 
  })
  const handleDownload = (url: string, generationId?: string, imageIndex?: number) =>
    downloadImage(url, { generationId, imageIndex })
  
  // 登录状态检查中或未登录时显示加载
  if (authLoading || !user) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">{t.common.loading}</p>
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
        onChange={handleUpload2}
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
            {!isDesktop && (
              <div className="absolute top-4 left-4 z-20">
                <button
                  onClick={mode === "review" ? handleRetake : handleReturn}
                  className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
                >
                  {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
                </button>
              </div>
            )}

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
                        <h1 className="text-lg font-semibold text-zinc-900">{t.camera?.title || '买家秀'}</h1>
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
                              src="https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage/features/buyer-show.jpg" 
                              alt="Buyer Show Mode" 
                              fill 
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-lg font-bold text-white">{t.camera?.buyerShowMode || 'Buyer Show Mode'}</h3>
                              <p className="text-sm text-white/80 mt-1">{t.home?.modelStudioSubtitle || '真实生活场景'}</p>
                            </div>
                          </div>
                          
                          {/* Feature Tags */}
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.camera?.realScene || 'Real Scene'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.camera?.diverseStyles || 'Diverse Styles'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.proStudio?.highQualityOutput || 'High Quality Output'}
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
                            className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-3 transition-all"
                          >
                            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-zinc-700">{t.camera?.uploadProduct || '上传商品图片'}</p>
                              <p className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || '点击上传或拖拽图片'}</p>
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
                    <p className="text-xs mt-1">{t.camera.productPlaceholder}</p>
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
                        <h1 className="text-lg font-semibold text-zinc-900">{t.camera?.title || '买家秀'}</h1>
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
                            <span className="text-sm font-medium text-zinc-900">{t.camera?.product1 || '商品图'}</span>
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
                                className="aspect-square rounded-lg border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
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
                          onClick={async (e) => {
                            triggerFlyToGallery(e)
                            handleShootIt()
                          }}
                          className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-200/50"
                        >
                          <Wand2 className="w-5 h-5" />
                          {t.proStudio?.startGenerate || '开始生成'}
                          <CreditCostBadge cost={4} className="ml-2" />
                        </button>
                      </div>
                      
                      {/* Middle: Model Selection */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-zinc-900">{t.camera?.selectModel || '选择模特'}</h3>
                            <div className="flex items-center gap-2">
                              {selectedModel && (
                                <button onClick={() => setSelectedModel(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除'}
                                </button>
                              )}
                              {allModels.length > 5 && (
                                <button 
                                  onClick={() => setShowModelPicker(true)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                              className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">{t.proStudio?.upload || 'Upload'}</span>
                            </button>
                            {allModels.slice(0, 5).map(model => (
                              <div
                                key={model.id}
                                className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all group ${
                                  selectedModel === model.id 
                                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                    : 'border-transparent hover:border-blue-300'
                                }`}
                              >
                                <button
                                  onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                                  className="absolute inset-0"
                              >
                                <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                </button>
                                {selectedModel === model.id && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFullscreenImage(model.imageUrl)
                                  }}
                                  className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <ZoomIn className="w-3 h-3 text-white" />
                              </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Background Selection */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-zinc-900">{t.camera?.selectBg || '选择背景'}</h3>
                            <div className="flex items-center gap-2">
                              {selectedBg && (
                                <button onClick={() => setSelectedBg(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除'}
                                </button>
                              )}
                              {allBackgrounds.length > 5 && (
                                <button 
                                  onClick={() => setShowScenePicker(true)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                              className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">{t.proStudio?.upload || 'Upload'}</span>
                            </button>
                            {allBackgrounds.slice(0, 5).map(bg => (
                              <div
                                key={bg.id}
                                className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all group ${
                                  selectedBg === bg.id 
                                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                    : 'border-transparent hover:border-blue-300'
                                }`}
                              >
                                <button
                                  onClick={() => setSelectedBg(selectedBg === bg.id ? null : bg.id)}
                                  className="absolute inset-0"
                              >
                                <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                                </button>
                                {selectedBg === bg.id && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                              <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFullscreenImage(bg.imageUrl)
                                  }}
                                  className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <ZoomIn className="w-3 h-3 text-white" />
                              </button>
                            </div>
                                  ))}
                                </div>
                              </div>
                                </div>
                                        </div>
                                </div>
                  
                  {/* Model and Scene Pickers are rendered at the page level */}
                </div>
              ) : (
                /* Mobile Review Mode */
                <div className="absolute inset-0 flex">
                  {/* Main product image */}
                  <div className={`relative ${capturedImage2 ? 'w-1/2' : 'w-full'} h-full`}>
                    <img 
                      src={capturedImage || ""} 
                      alt={t.camera.product1} 
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-md">
                      {t.camera.product1}
                    </span>
                  </div>
                  
                  {/* Second product image or add button */}
                  {capturedImage2 ? (
                    <div className="relative w-1/2 h-full border-l-2 border-white/30">
                      <img 
                        src={capturedImage2} 
                        alt={t.camera.product2} 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-md">
                        {t.camera.product2}
                      </span>
                      <button
                        onClick={() => setCapturedImage2(null)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : mode === "review" && !capturedImage2 && (
                    <button
                      onClick={async () => {
                        // 上传图片到 Storage，避免 sessionStorage 存大量 base64
                        const imageUrl = user?.id 
                          ? await ensureImageUrl(capturedImage!, user.id, 'product')
                          : capturedImage!
                        sessionStorage.setItem('product1Image', imageUrl)
                        sessionStorage.removeItem('product2Image')
                        router.push('/pro-studio/outfit?mode=camera')
                      }}
                      className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/70 transition-colors border border-white/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.outfit?.title || '搭配商品'}</span>
                    </button>
                  )}
                </div>
              )}
              
              {/* Selection Badges Overlay */}
              <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {selectedModelGender && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.common.gender}: {MODEL_GENDERS.find(g => g.id === selectedModelGender)?.label}
                  </span>
                )}
                {selectedModelStyle && selectedModelStyle !== 'auto' && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    风格: {selectedModelStyle === 'korean' ? '韩系' : selectedModelStyle === 'western' ? '欧美' : selectedModelStyle}
                  </span>
                )}
                {activeModel && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.common.model}: {activeModel.name}
                  </span>
                )}
                {activeBg && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.common.background}: {activeBg.name}
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
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                    </div>
                  </div>
                  
                  <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                    {t.camera.shootYourProduct}
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
                  {/* Custom button */}
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
                      <span className="text-sm font-medium">{t.camera.customizeModelBg}</span>
                    </button>
                  </div>
                  
                  {/* Generate button */}
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
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                          : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                      }`}
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
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
                    <span className="text-[10px]">{t.camera.album}</span>
                  </button>

                  {/* Shutter - Mobile only */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
                  </button>

                  {/* Asset Library - Right of shutter */}
                  <button 
                    onClick={() => setShowProductPanel(true)}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <FolderHeart className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">{t.camera.assetLibrary}</span>
                  </button>
                </div>
              )}
            </div>
            )}
            
            {/* Model and Scene Pickers are rendered at the page level */}

            
            {/* Product Selection Panel */}
            <AssetPickerPanel
              open={showProductPanel}
              onClose={() => setShowProductPanel(false)}
              onSelect={(imageUrl) => {
                setCapturedImage(imageUrl)
                                  setProductFromPhone(false)
                                  setMode("review")
              }}
              onUploadClick={() => fileInputRef.current?.click()}
              themeColor="blue"
              title={t.camera.selectProduct}
            />
            
            {/* 第二件商品选择面板 */}
            <AssetPickerPanel
              open={showProduct2Panel}
              onClose={() => setShowProduct2Panel(false)}
              onSelect={(imageUrl) => {
                setCapturedImage2(imageUrl)
                                setProduct2FromPhone(false)
              }}
              onUploadClick={() => fileInputRef2.current?.click()}
              themeColor="blue"
              title={t.proStudio?.styleOutfit || '搭配商品'}
            />
          </motion.div>
        )}

        {mode === "processing" && (
          <ProcessingView
            numImages={CAMERA_NUM_IMAGES}
            generatedImages={generatedImages}
            imageSlots={tasks.find(t => t.id === currentTaskId)?.imageSlots?.map(slot => ({
              url: slot.imageUrl,
              status: slot.status as 'generating' | 'completed' | 'failed'
            }))}
            themeColor="blue"
            title={t.camera?.generating || 'Creating buyer show photos'}
            mobileStatusLines={[
              t.camera?.analyzeProduct || 'Analyzing product',
              ...(activeModel ? [`${t.camera?.generateModel || 'Using model'} ${activeModel.name} ...`] : []),
              ...(selectedModelStyle && selectedModelStyle !== 'auto' && !activeModel ? [t.camera?.matchingStyle || 'Matching style...'] : []),
              ...(activeBg ? [t.camera?.renderScene || 'Rendering scene'] : []),
            ]}
            onShootMore={handleNewPhotoDuringProcessing}
            onReturnHome={handleReturnDuringProcessing}
            onDownload={(url, i) => handleDownload(url, currentGenerationId || undefined, i)}
          />
        )}

        {mode === "results" && (
          <ResultsView
            title={t.camera?.thisResults || 'Results'}
            onBack={handleRetake}
            images={[0, 1, 2, 3].map((i) => {
                    const currentTask = tasks.find(t => t.id === currentTaskId)
                    const slot = currentTask?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'failed')
              return {
                url,
                status: status as 'completed' | 'pending' | 'generating' | 'failed',
                error: slot?.error,
              }
            })}
            getBadge={(i) => ({
              text: i < 2 ? (t.gallery?.simpleMode || 'Simple') : (t.gallery?.extendedMode || 'Extended'),
              className: i < 2 ? 'bg-green-500' : 'bg-blue-500',
            })}
            themeColor="blue"
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
                {
                  text: selectedResultIndex < 2 ? (t.gallery?.simpleMode || "Simple") : (t.gallery?.extendedMode || "Extended"),
                  className: selectedResultIndex < 2 ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                },
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
                ...(capturedImage2 ? [{ url: capturedImage2, label: `${t.common?.product || 'Product'} 2` }] : []),
              ]}
              onInputImageClick={(url) => setFullscreenImage(url)}
            >
              {/* Debug content */}
              {debugMode && selectedResultIndex !== null && (() => {
                const generation = currentGenerationId ? generations.find(g => g.id === currentGenerationId) : null
                        const savedParams = generation?.params
                        
                        return (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.camera.debugParams}</h3>
                          
                          {generatedPrompts[selectedResultIndex] && (
                            <div className="mb-4">
                              <p className="text-xs font-medium text-zinc-500 mb-2">Prompt</p>
                              <div className="bg-zinc-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                                <pre className="text-[11px] text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
                                  {generatedPrompts[selectedResultIndex]}
                                </pre>
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-2">
                              {(capturedImage || generation?.inputImageUrl) && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(capturedImage || generation?.inputImageUrl || '')}
                                  >
                              <img src={capturedImage || generation?.inputImageUrl || ''} alt={t.camera.productOriginal} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">{t.camera.productOriginal}</p>
                                </div>
                              )}
                              
                              {(() => {
                                const perImageModel = savedParams?.perImageModels?.[selectedResultIndex]
                                const modelUrl = perImageModel?.imageUrl || savedParams?.modelImage || activeModel?.imageUrl
                                const modelName = perImageModel?.name || savedParams?.model || activeModel?.name
                                if (!modelUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                              <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group" onClick={() => setFullscreenImage(modelUrl)}>
                                <Image src={modelUrl} alt="Model" width={56} height={56} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                              <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{modelName || t.common.model}</p>
                                  </div>
                                )
                              })()}
                              
                              {(() => {
                                const perImageBg = savedParams?.perImageBackgrounds?.[selectedResultIndex]
                                const bgUrl = perImageBg?.imageUrl || savedParams?.backgroundImage || activeBg?.imageUrl
                                const bgName = perImageBg?.name || savedParams?.background || activeBg?.name
                                if (!bgUrl) return null
                                return (
                                  <div className="flex flex-col items-center">
                              <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group" onClick={() => setFullscreenImage(bgUrl)}>
                                <Image src={bgUrl} alt="Background" width={56} height={56} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                              <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{bgName || t.common.background}</p>
                                  </div>
                                )
                              })()}
                            </div>
                            
                            {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) && (
                              <div className="mt-3 mb-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                  (generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'pro' 
                              ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                            Model: Gemini {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'pro' ? '3.0 Pro' : '2.5 Flash'}
                                </span>
                              </div>
                            )}
                            
                      {((savedParams?.modelStyle || selectedModelStyle) && (savedParams?.modelStyle || selectedModelStyle) !== 'auto') && (
                              <div className="flex gap-2 flex-wrap">
                                  <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                    {t.common.style}: {(savedParams?.modelStyle || selectedModelStyle) === 'korean' ? t.common.korean : 
                                           (savedParams?.modelStyle || selectedModelStyle) === 'western' ? t.common.western : 
                                           (savedParams?.modelStyle || selectedModelStyle)}
                                  </span>
                                {(savedParams?.modelGender || selectedModelGender) && (
                                  <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                    {t.common.gender}: {MODEL_GENDERS.find(g => g.id === (savedParams?.modelGender || selectedModelGender))?.label}
                                  </span>
                                )}
                              </div>
                      )}
                          </div>
                        </div>
                        )
                      })()}
            </PhotoDetailDialog>
          </ResultsView>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer - Using shared component */}
      <FullscreenImageViewer
        open={!!fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        imageUrl={fullscreenImage || ''}
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
        themeColor="blue"
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
        themeColor="blue"
        allowUpload={false}
      />
      
    </div>
  )
}

// Default export with Suspense wrapper for useSearchParams
export default function CameraPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <CameraPageContent />
    </Suspense>
  )
}
