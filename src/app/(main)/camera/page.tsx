"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
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
    return t.errors?.resourceBusy || '资源紧张，请稍后重试'
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
  useEffect(() => {
    const checkCameraPermission = async () => {
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
    
    checkCameraPermission()
  }, [])
  
  // Panel states
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("all")
  const [zoomProductImage, setZoomProductImage] = useState<string | null>(null)
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState("model")
  const [productSourceTab, setProductSourceTab] = useState<"user" | "preset">("preset")
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
  
  const { addGeneration, addUserAsset, userModels, userBackgrounds, userProducts, addFavorite, removeFavorite, isFavorited, favorites, generations } = useAssetStore()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  
  // 从 URL 参数读取 mode（从 outfit 页面跳转过来时）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as CameraMode)
      // 从 sessionStorage 恢复 taskId
      const savedTaskId = sessionStorage.getItem('cameraTaskId')
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
                  sessionStorage.removeItem('cameraTaskId')
                }
              } else {
                console.log('[Camera] Task not found in database, returning to camera')
                setMode('camera')
                sessionStorage.removeItem('cameraTaskId')
              }
            })
            .catch(err => {
              console.error('[Camera] Failed to recover images:', err)
              setMode('camera')
              sessionStorage.removeItem('cameraTaskId')
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
      // 检查是否仍在camera页面，避免用户离开后强制跳转
      if (window.location.pathname === '/camera') {
        router.replace('/camera?mode=results')
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
    sessionStorage.setItem('cameraTaskId', taskId)
    
    // 更新 URL（便于刷新后恢复状态）
    router.replace('/camera?mode=processing')
    
    // Reserve quota in background (don't block generation)
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: CAMERA_NUM_IMAGES,
        taskType: 'model_studio',
      }),
    }).then(() => {
      console.log('[Quota] Reserved', CAMERA_NUM_IMAGES, 'images for task', taskId)
      refreshQuota()
    }).catch(e => {
      console.warn('[Quota] Failed to reserve quota:', e)
    })
    
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
      
      // Calculate refund for failed images
      const failedCount = NUM_IMAGES - successCount
      if (failedCount > 0) {
        console.log(`[Quota] Refunding ${failedCount} failed images`)
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
          console.warn('[Quota] Failed to refund:', e)
        }
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
        
        // Refresh quota after successful generation
        await refreshQuota()
        
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
          // 更新 URL 为 results 模式（检查是否仍在camera页面）
          if (window.location.pathname === '/camera') {
            router.replace('/camera?mode=results')
          }
        }
        
        // 清理 sessionStorage（任务完成）
        sessionStorage.removeItem('cameraTaskId')
      } else {
        // All tasks failed - refund all reserved quota
        console.log('[Quota] All tasks failed, refunding all', NUM_IMAGES, 'images')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        } catch (e) {
          console.warn('[Quota] Failed to refund on total failure:', e)
        }
        
        // Log more details
        const failedCount = results.filter(r => !r.success).length
        console.error(`All tasks failed. Failed: ${failedCount}/${results.length}`)
        throw new Error(t.camera.generationFailed)
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.camera.generationFailed)
      
      // Refund quota on error
      console.log('[Quota] Error occurred, refunding reserved quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        await refreshQuota()
      } catch (e) {
        console.warn('[Quota] Failed to refund on error:', e)
      }
      
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
      sessionStorage.removeItem('cameraTaskId')
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
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => {
    sessionStorage.setItem('editImage', imageUrl)
    router.push("/edit/general")
  }
  
  // Handle download
  const handleDownload = async (url: string, generationId?: string, imageIndex?: number) => {
    // Track download event (don't await, fire and forget)
    fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        generationId,
        imageIndex,
        source: 'camera',
      }),
    }).catch(() => {}) // Silently ignore tracking errors
    
    try {
      let blob: Blob
      
      if (url.startsWith('data:')) {
        // Handle base64 data URL
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        // Handle regular URL
        const response = await fetch(url)
        blob = await response.blob()
      }
      
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `brand-camera-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      // Fallback to direct link
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.jpg`
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
    uploadLabel = t.common.upload
  }: { 
    items: Asset[]
    selectedId: string | null
    onSelect: (id: string) => void
    onUpload?: () => void
    uploadLabel?: string
  }) => (
    <div className="grid grid-cols-3 gap-3 p-1 pb-20">
      {/* Upload card as first item */}
      {onUpload && (
        <button
          onClick={onUpload}
          className="aspect-square rounded-lg overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-500 transition-all flex flex-col items-center justify-center bg-zinc-100 hover:bg-zinc-50"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5 text-blue-600" />
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
              ? "border-blue-600 ring-2 ring-blue-200" 
              : "border-transparent hover:border-zinc-200"
          }`}
        >
          <Image src={asset.imageUrl} alt={asset.name || ""} fill className="object-cover" />
          {selectedId === asset.id && (
            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
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
            {/* Top Return Button */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={mode === "review" ? handleRetake : handleReturn}
                className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className={`flex-1 relative ${isDesktop && mode === "camera" ? 'bg-zinc-50' : ''}`}>
              {/* PC Desktop: Show upload interface with two-column layout */}
              {mode === "camera" && isDesktop ? (
                <div className="absolute inset-0 overflow-y-auto bg-zinc-50">
                  {/* PC Header */}
                  <div className="bg-white border-b border-zinc-200">
                    <div className="max-w-5xl mx-auto px-8 py-5">
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
                      {/* Left: Image Upload */}
                      <div className="w-[380px] shrink-0">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                          <button
                            onClick={() => fileInputRef.current?.click()}
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
                          <div className="mt-4">
                            <button
                              onClick={() => setShowProductPanel(true)}
                              className="w-full h-12 rounded-xl border border-zinc-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-colors"
                            >
                              <FolderHeart className="w-4 h-4 text-zinc-500" />
                              <span className="text-sm text-zinc-600">{t.camera?.assetLibrary || '素材库'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Options */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6">
                          <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                              <Wand2 className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 mb-2">买家秀模式</h3>
                            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                              {t.common?.uploadProductDesc || '上传商品图片后，AI 将为你生成专业展示图'}
                            </p>
                          </div>
                          
                          <div className="border-t border-zinc-100 pt-6 space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">真实场景</h4>
                                <p className="text-xs text-zinc-500">生活化场景，更有代入感</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">多样风格</h4>
                                <p className="text-xs text-zinc-500">支持自定义模特和背景</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">高质量输出</h4>
                                <p className="text-xs text-zinc-500">适合电商平台使用</p>
                              </div>
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
                    <p className="text-sm">正在初始化相机...</p>
                  </div>
                </div>
              ) : mode === "camera" && !hasCamera && !isDesktop ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">相机不可用</p>
                    <p className="text-xs mt-1">{t.camera.productPlaceholder}</p>
                  </div>
                </div>
              ) : mode === "review" && isDesktop ? (
                /* Desktop Review Mode - Two Column Layout */
                <div className="absolute inset-0 overflow-y-auto bg-zinc-50">
                  {/* PC Header */}
                  <div className="bg-white border-b border-zinc-200">
                    <div className="max-w-5xl mx-auto px-8 py-4">
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
                  
                  {/* Two-column content */}
                  <div className="max-w-5xl mx-auto px-8 py-6">
                    <div className="flex gap-8">
                      {/* Left: Product Image */}
                      <div className="w-[380px] shrink-0 space-y-4">
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
                        
                        {/* Add second product */}
                        {capturedImage2 ? (
                          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                            <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-900">{t.camera?.product2 || '商品2'}</span>
                              <button onClick={() => setCapturedImage2(null)} className="text-xs text-red-500 hover:text-red-600">
                                移除
                              </button>
                            </div>
                            <div className="aspect-square relative bg-zinc-50">
                              <img src={capturedImage2} alt="商品2" className="w-full h-full object-contain" />
                  </div>
                </div>
              ) : (
                          <button
                            onClick={async () => {
                              const imageUrl = user?.id 
                                ? await ensureImageUrl(capturedImage!, user.id, 'product')
                                : capturedImage!
                              sessionStorage.setItem('product1Image', imageUrl)
                              sessionStorage.removeItem('product2Image')
                              router.push('/pro-studio/outfit?mode=camera')
                            }}
                            className="w-full h-12 rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 flex items-center justify-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">{t.outfit?.title || '搭配商品'}</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Right: Settings */}
                      <div className="flex-1 min-w-0 space-y-6">
                        {/* Model Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">{t.camera?.selectModel || '选择模特'}</h3>
                            <div className="flex items-center gap-3">
                              {selectedModel && (
                                <button onClick={() => setSelectedModel(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除选择'}
                                </button>
                              )}
                              {allModels.length > 7 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("model")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  {t.common?.viewMore || '查看更多'} ({allModels.length})
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-zinc-500 mb-4">{t.common?.randomMatchHint || '不选则随机匹配'}</p>
                          <div className="grid grid-cols-4 gap-3">
                            <button
                              onClick={() => modelUploadRef.current?.click()}
                              className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-5 h-5 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">上传</span>
                            </button>
                            {allModels.slice(0, 7).map(model => (
                              <button
                                key={model.id}
                                onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                                className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                  selectedModel === model.id 
                                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                    : 'border-transparent hover:border-blue-300'
                                }`}
                              >
                                <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                {selectedModel === model.id && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Background Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">{t.camera?.selectBg || '选择背景'}</h3>
                            <div className="flex items-center gap-3">
                              {selectedBg && (
                                <button onClick={() => setSelectedBg(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除选择'}
                                </button>
                              )}
                              {allBackgrounds.length > 7 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("bg")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  {t.common?.viewMore || '查看更多'} ({allBackgrounds.length})
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-zinc-500 mb-4">{t.common?.randomMatchHint || '不选则随机匹配'}</p>
                          <div className="grid grid-cols-4 gap-3">
                            <button
                              onClick={() => bgUploadRef.current?.click()}
                              className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-5 h-5 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">上传</span>
                            </button>
                            {allBackgrounds.slice(0, 7).map(bg => (
                              <button
                                key={bg.id}
                                onClick={() => setSelectedBg(selectedBg === bg.id ? null : bg.id)}
                                className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                  selectedBg === bg.id 
                                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                    : 'border-transparent hover:border-blue-300'
                                }`}
                              >
                                <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                                {selectedBg === bg.id && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Generate Button */}
                        <button
                          onClick={async (e) => {
                            if (capturedImage2) {
                              const [url1, url2] = await Promise.all([
                                ensureImageUrl(capturedImage!, user?.id || '', 'product'),
                                ensureImageUrl(capturedImage2, user?.id || '', 'product')
                              ])
                              sessionStorage.setItem('product1Image', url1)
                              sessionStorage.setItem('product2Image', url2)
                              router.push('/pro-studio/outfit?mode=camera')
                            } else {
                              triggerFlyToGallery(e)
                              handleShootIt()
                            }
                          }}
                          className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-200/50"
                        >
                          <Wand2 className="w-5 h-5" />
                          {capturedImage2 ? '去搭配' : '开始生成'}
                          {!capturedImage2 && <CreditCostBadge cost={4} className="ml-2" />}
                        </button>
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
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="fixed inset-x-8 top-1/2 -translate-y-1/2 max-w-3xl mx-auto bg-white rounded-2xl z-50 max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
                        >
                          <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                            <div className="flex gap-4">
                              <button 
                                onClick={() => setActiveCustomTab("model")}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                  activeCustomTab === "model" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.common?.model || '模特'}
                              </button>
                              <button 
                                onClick={() => setActiveCustomTab("bg")}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                  activeCustomTab === "bg" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"
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
                                  <span className="text-sm text-zinc-600">{t.camera?.selectModel || '选择模特（不选则随机）'}</span>
                                  {selectedModel && (
                                    <button onClick={() => setSelectedModel(null)} className="text-xs text-blue-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => modelUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">上传</span>
                                  </button>
                                  {allModels.map(model => (
                                    <button
                                      key={model.id}
                                      onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedModel === model.id 
                                          ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                          : 'border-transparent hover:border-blue-300'
                                      }`}
                                    >
                                      <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                      {selectedModel === model.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
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
                                  <span className="text-sm text-zinc-600">{t.camera?.selectBg || '选择背景（不选则随机）'}</span>
                                  {selectedBg && (
                                    <button onClick={() => setSelectedBg(null)} className="text-xs text-blue-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => bgUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">上传</span>
                                  </button>
                                  {allBackgrounds.map(bg => (
                                    <button
                                      key={bg.id}
                                      onClick={() => setSelectedBg(selectedBg === bg.id ? null : bg.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedBg === bg.id 
                                          ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                          : 'border-transparent hover:border-blue-300'
                                      }`}
                                    >
                                      <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                                      {selectedBg === bg.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
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
                              className="px-8 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                            >
                              确定
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
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

            {/* Bottom Controls Area */}
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
            
            {/* Slide-up Panel: Custom */}
            <AnimatePresence>
              {showCustomPanel && (
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
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                      >
                        {t.camera?.nextStep || '下一步'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                      {[
                        { id: "model", label: t.common.model },
                        { id: "bg", label: t.common.background }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setActiveCustomTab(tab.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                            activeCustomTab === tab.id 
                              ? "bg-black text-white" 
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
                            uploadLabel={t.camera.uploadModel}
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
                            uploadLabel={t.camera.uploadBackground}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            
            {/* Slide-up Panel: Product Assets */}
            <AnimatePresence>
              {showProductPanel && (
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
                      <span className="font-semibold">{t.camera.selectProduct}</span>
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
                          {t.camera.officialExamples}
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
                          {t.camera.myProducts}
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
                      
                      {/* 二级分类（仅我的商品） */}
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
                                    ? "bg-blue-600 text-white"
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
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                          )}
                          {PRESET_PRODUCTS.map(product => (
                            <div key={product.id} className="relative group">
                              <button
                                disabled={isLoadingAssets}
                                onClick={() => {
                                  // 直接使用 URL，后端会转换为 base64
                                  setCapturedImage(product.imageUrl)
                                  setProductFromPhone(false)
                                  setMode("review")
                                  setShowProductPanel(false)
                                }}
                                className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50 w-full"
                              >
                                <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                  {t.common.official}
                                </span>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                  <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                </div>
                              </button>
                              {/* 放大按钮 */}
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
                        // 筛选用户商品
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
                                  setProductFromPhone(false)
                                  setMode("review")
                                  setShowProductPanel(false)
                                }}
                              >
                                <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 active:border-blue-600 transition-all w-full">
                                  <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 pointer-events-none">
                                    <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                  </div>
                                </div>
                                {/* 放大按钮 */}
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
                            <p className="text-sm">{t.camera.noMyProducts}</p>
                            <p className="text-xs mt-1">{t.camera.uploadInAssets}</p>
                            <button 
                              onClick={() => {
                                setShowProductPanel(false)
                                router.push("/brand-assets")
                              }}
                              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {t.camera.goUpload}
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
            
            {/* Slide-up Panel: Product 2 Assets */}
            <AnimatePresence>
              {showProduct2Panel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowProduct2Panel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">{t.camera.addProduct2}</span>
                      <button 
                        onClick={() => setShowProduct2Panel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Upload from album option */}
                    <div className="px-4 py-3 border-b">
                      <button
                        onClick={() => {
                          setShowProduct2Panel(false)
                          fileInputRef2.current?.click()
                        }}
                        className="w-full h-12 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        <ImageIcon className="w-5 h-5" />
                        {t.camera.fromAlbum}
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
                          {t.camera.officialExamples}
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
                          {t.camera.myProducts}
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
                      
                      {/* 二级分类（仅我的商品） */}
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
                                    ? "bg-blue-600 text-white"
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
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                          )}
                          {PRESET_PRODUCTS.map(product => (
                            <div key={product.id} className="relative group">
                              <button
                                disabled={isLoadingAssets}
                                onClick={() => {
                                  // 直接使用 URL，后端会转换为 base64
                                  setCapturedImage2(product.imageUrl)
                                  setProduct2FromPhone(false)
                                  setShowProduct2Panel(false)
                                }}
                                className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50 w-full"
                              >
                                <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                  {t.common.official}
                                </span>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                  <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                </div>
                              </button>
                              {/* 放大按钮 */}
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
                        // 筛选用户商品
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
                                  setCapturedImage2(product.imageUrl)
                                  setProduct2FromPhone(false)
                                  setShowProduct2Panel(false)
                                }}
                              >
                                <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 active:border-blue-600 transition-all w-full">
                                  <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 pointer-events-none">
                                    <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                                  </div>
                                </div>
                                {/* 放大按钮 */}
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
                            <p className="text-sm">{t.camera.noMyProducts}</p>
                            <p className="text-xs mt-1">{t.camera.uploadInAssets}</p>
                            <button 
                              onClick={() => {
                                setShowProduct2Panel(false)
                                router.push("/brand-assets")
                              }}
                              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {t.camera.goUpload}
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
            className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            
            <h3 className="text-white text-2xl font-bold mb-2">{t.camera.generating}</h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              <p>{t.camera.analyzeProduct}</p>
              {activeModel && <p>{t.camera.generateModel} {activeModel.name} ...</p>}
              {selectedModelStyle && selectedModelStyle !== 'auto' && !activeModel && (
                <p>匹配{selectedModelStyle === 'korean' ? '韩系' : selectedModelStyle === 'western' ? '欧美' : selectedModelStyle}风格...</p>
              )}
              {activeBg && <p>{t.camera.renderScene}</p>}
            </div>
            
            {/* Action buttons during processing */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-500 text-xs mb-4">{t.camera.continueInBackground}</p>
              <button
                onClick={handleNewPhotoDuringProcessing}
                className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t.camera.shootNew}
              </button>
              <button
                onClick={handleReturnDuringProcessing}
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                {t.camera.returnHome}
              </button>
            </div>
            
            {/* Bottom Navigation */}
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
              <span className="font-semibold ml-2">本次成片</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-8">
              {/* Simple Mode Images (极简模式) - indices 0, 1, 2 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-green-500 rounded-full" />
                    极简模式
                  </h3>
                  <span className="text-[10px] text-zinc-400">{t.camera.simpleModeDesc}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((i) => {
                    // 优先使用实时 imageSlots，回退到 generatedImages
                    const currentTask = tasks.find(t => t.id === currentTaskId)
                    const slot = currentTask?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'failed')
                    const modelType = slot?.modelType || generatedModelTypes[i]
                    
                    // Loading 状态
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                          <span className="text-[10px] text-zinc-400">生成中...</span>
                        </div>
                      )
                    }
                    
                    // 失败状态
                    if (status === 'failed' || !url) {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                          {slot?.error || t.camera.generationFailed}
                        </div>
                      )
                    }
                    
                    // 成功状态
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(i)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        {/* Favorite button */}
                        <button 
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                            currentGenerationId && isFavorited(currentGenerationId, i) 
                              ? "bg-red-500 text-white" 
                              : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResultFavorite(i)
                          }}
                        >
                          <Heart className={`w-3.5 h-3.5 ${currentGenerationId && isFavorited(currentGenerationId, i) ? "fill-current" : ""}`} />
                        </button>
                        {/* Type badge */}
                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500 text-white">
                            极简
                          </span>
                          {modelType === 'flash' && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-amber-500 text-white">
                              2.5
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Extended Mode Images (扩展模式) - indices 3, 4, 5 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-600 rounded-full" />
                    扩展模式
                  </h3>
                  <span className="text-[10px] text-zinc-400">{t.camera.extendedModeDesc}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[2, 3].map((actualIndex) => {
                    // 优先使用实时 imageSlots，回退到 generatedImages
                    const currentTask = tasks.find(t => t.id === currentTaskId)
                    const slot = currentTask?.imageSlots?.[actualIndex]
                    const url = slot?.imageUrl || generatedImages[actualIndex]
                    const status = slot?.status || (url ? 'completed' : 'failed')
                    const modelType = slot?.modelType || generatedModelTypes[actualIndex]
                    
                    // Loading 状态
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={actualIndex} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                          <span className="text-[10px] text-zinc-400">生成中...</span>
                        </div>
                      )
                    }
                    
                    // 失败状态
                    if (status === 'failed' || !url) {
                      return (
                        <div key={actualIndex} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                          {slot?.error || t.camera.generationFailed}
                        </div>
                      )
                    }
                    
                    // 成功状态
                    return (
                      <div 
                        key={actualIndex} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(actualIndex)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        {/* Favorite button */}
                        <button 
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                            currentGenerationId && isFavorited(currentGenerationId, actualIndex) 
                              ? "bg-red-500 text-white" 
                              : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResultFavorite(actualIndex)
                          }}
                        >
                          <Heart className={`w-3.5 h-3.5 ${currentGenerationId && isFavorited(currentGenerationId, actualIndex) ? "fill-current" : ""}`} />
                        </button>
                        {/* Type badge */}
                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500 text-white">
                            扩展
                          </span>
                          {modelType === 'flash' && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-amber-500 text-white">
                              2.5
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 pb-20 bg-white border-t shadow-up">
              <button 
                onClick={handleRetake}
                className="w-full h-12 text-lg rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                {t.camera.shootNextSet}
              </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && (() => {
              // 获取当前选中图片的 URL（优先 imageSlots，回退 generatedImages）
              const currentTask = tasks.find(t => t.id === currentTaskId)
              const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
              const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
              const selectedModelType = selectedSlot?.modelType || generatedModelTypes[selectedResultIndex]
              
              if (!selectedImageUrl) return null
              
              return (
              <div className="fixed inset-0 z-50 bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                    <button
                      onClick={() => setSelectedResultIndex(null)}
                      className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-700" />
                    </button>
                    <span className="font-semibold text-zinc-900">{t.common.detail}</span>
                    <div className="w-10" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-zinc-100 pb-24">
                    <div className="bg-zinc-900">
                      <div 
                        className="relative aspect-[4/5] cursor-pointer group"
                        onClick={() => setFullscreenImage(selectedImageUrl)}
                      >
                        {/* Use img tag for native long-press save support */}
                        <img 
                          src={selectedImageUrl} 
                          alt="Detail" 
                          className="w-full h-full object-contain" 
                        />
                        {/* Zoom hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <ZoomIn className="w-6 h-6 text-zinc-700" />
                          </div>
                        </div>
                      </div>
                      <p className="text-center text-zinc-500 text-xs py-2">{t.imageActions.longPressSave}</p>
                    </div>
                    
                    <div className="p-4 pb-8 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {/* Generation mode badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              selectedResultIndex < 3 
                                ? "bg-green-100 text-green-700" 
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {selectedResultIndex < 2 ? (t.gallery?.simpleMode || "极简模式") : (t.gallery?.extendedMode || "扩展模式")}
                            </span>
                            {selectedModelType === 'flash' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                                Gemini 2.5
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            {t.common.justNow}
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

                      {/* Generation Parameters - Only show in debug mode */}
                      {debugMode && (() => {
                        // Get generation record from store to display saved params
                        const generation = currentGenerationId 
                          ? generations.find(g => g.id === currentGenerationId)
                          : null
                        const savedParams = generation?.params
                        
                        return (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.camera.debugParams}</h3>
                          
                          {/* This image's prompt */}
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
                          
                          {/* Reference images */}
                          <div className="space-y-3">
                            {/* Reference images grid */}
                            <div className="grid grid-cols-4 gap-2">
                              {/* Input Product Image - from captured or saved */}
                              {(capturedImage || generation?.inputImageUrl) && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(capturedImage || generation?.inputImageUrl || '')}
                                  >
                                    <img 
                                      src={capturedImage || generation?.inputImageUrl || ''} 
                                      alt={t.camera.productOriginal} 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">{t.camera.productOriginal}</p>
                                </div>
                              )}
                              
                              {/* Model Image - use per-image data if available */}
                              {(() => {
                                const perImageModel = savedParams?.perImageModels?.[selectedResultIndex]
                                const modelUrl = perImageModel?.imageUrl || savedParams?.modelImage || activeModel?.imageUrl
                                const modelName = perImageModel?.name || savedParams?.model || activeModel?.name
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
                                      {modelName || t.common.model}
                                    </p>
                                  </div>
                                )
                              })()}
                              
                              {/* Background Image - use per-image data if available */}
                              {(() => {
                                const perImageBg = savedParams?.perImageBackgrounds?.[selectedResultIndex]
                                const bgUrl = perImageBg?.imageUrl || savedParams?.backgroundImage || activeBg?.imageUrl
                                const bgName = perImageBg?.name || savedParams?.background || activeBg?.name
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
                                      {bgName || t.common.background}
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
                                  模型: Gemini {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'pro' ? '3.0 Pro' : '2.5 Flash'}
                                  {(generatedModelTypes[selectedResultIndex] || generation?.outputModelTypes?.[selectedResultIndex]) === 'flash' && ' (降级)'}
                                </span>
                                {(generatedGenModes[selectedResultIndex] || generation?.outputGenModes?.[selectedResultIndex]) && (
                                  <span className={`ml-2 px-2 py-1 rounded text-[10px] font-medium ${
                                    (generatedGenModes[selectedResultIndex] || generation?.outputGenModes?.[selectedResultIndex]) === 'simple'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {(generatedGenModes[selectedResultIndex] || generation?.outputGenModes?.[selectedResultIndex]) === 'simple' ? (t.gallery?.simpleMode || '极简模式') : (t.gallery?.extendedMode || '扩展模式')}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Style params - prefer saved, fallback to current selection */}
                            {((savedParams?.modelStyle || selectedModelStyle) && (savedParams?.modelStyle || selectedModelStyle) !== 'auto') || 
                             (savedParams?.modelGender || selectedModelGender) ? (
                              <div className="flex gap-2 flex-wrap">
                                {(savedParams?.modelStyle || selectedModelStyle) && (savedParams?.modelStyle || selectedModelStyle) !== 'auto' && (
                                  <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                    {t.common.style}: {(savedParams?.modelStyle || selectedModelStyle) === 'korean' ? t.common.korean : 
                                           (savedParams?.modelStyle || selectedModelStyle) === 'western' ? t.common.western : 
                                           (savedParams?.modelStyle || selectedModelStyle)}
                                  </span>
                                )}
                                {(savedParams?.modelGender || selectedModelGender) && (
                                  <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                    {t.common.gender}: {MODEL_GENDERS.find(g => g.id === (savedParams?.modelGender || selectedModelGender))?.label}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        )
                      })()}

                      <button 
                        onClick={() => {
                          setSelectedResultIndex(null)
                          handleGoToEdit(selectedImageUrl)
                        }}
                        className="w-full h-12 mt-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        去修图
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}
            
            {/* Bottom Navigation */}
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
            {/* Close button */}
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Image with zoom */}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
              onPinchingStop={(ref) => {
                // Reset to scale 1 if zoomed out too much
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
                    {/* Use img tag for native long-press save support */}
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
            
            {/* Tap to close hint */}
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">{t.imageActions.longPressSaveZoom}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
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
