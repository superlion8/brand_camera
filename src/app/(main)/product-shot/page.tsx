"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Upload, Loader2, Download, Heart, 
  Sun, Sparkles, Lightbulb, Zap, Home, FolderHeart, X, Camera, ZoomIn, Wand2,
  Image as ImageIcon, Images
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Webcam from "react-webcam"
import { fileToBase64, compressBase64Image, generateId, ensureBase64, saveProductToAssets } from "@/lib/utils"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { useImageDownload } from "@/hooks/useImageDownload"
import { useFavorite } from "@/hooks/useFavorite"
import { navigateToEdit } from "@/lib/navigation"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { ResultsView } from "@/components/shared/ResultsView"
import { GalleryPickerPanel } from "@/components/shared/GalleryPickerPanel"
import Image from "next/image"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { TASK_CREDIT_COSTS, TaskTypes } from "@/lib/taskTypes"

const CREDIT_COST = TASK_CREDIT_COSTS[TaskTypes.PRODUCT_SHOT]

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || 'Resource busy, please try again later'
  }
  return error
}

// Light types - IDs only, labels come from translations
const LIGHT_TYPE_IDS = ['Softbox', 'Sunlight', 'Dramatic', 'Neon'] as const
const LIGHT_TYPE_ICONS = { Softbox: Lightbulb, Sunlight: Sun, Dramatic: Sparkles, Neon: Zap }

// Photo types
const PHOTO_TYPE_IDS = ['flatlay', 'hanging'] as const

// Aspect ratios
const ASPECT_RATIO_IDS = ['original', '1:1', '3:4', '4:3', '16:9', '9:16'] as const

// Light direction positions (relative to center)
const LIGHT_DIRECTIONS = [
  { id: 'top-left', x: 0, y: 0 },
  { id: 'top', x: 1, y: 0 },
  { id: 'top-right', x: 2, y: 0 },
  { id: 'left', x: 0, y: 1 },
  { id: 'front', x: 1, y: 1 },
  { id: 'right', x: 2, y: 1 },
  { id: 'bottom-left', x: 0, y: 2 },
  { id: 'bottom', x: 1, y: 2 },
  { id: 'bottom-right', x: 2, y: 2 },
]

// Preset background colors - pairs for gradients (labels from translations)
const PRESET_BG_COLOR_IDS = [
  { id: 'warm', colors: ['#FFE4B5', '#DEB887'] },
  { id: 'cool', colors: ['#87CEEB', '#B0E0E6'] },
  { id: 'neutral', colors: ['#D3D3D3', '#A9A9A9'] },
  { id: 'rose', colors: ['#DDA0DD', '#DA70D6'] },
]

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

// Hex to HSV
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, v]
}

type StudioMode = 'main' | 'camera' | 'processing' | 'results'

function StudioPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  
  // Build light types with translations
  const LIGHT_TYPES = LIGHT_TYPE_IDS.map(id => ({
    id,
    label: t.studio[id.toLowerCase() as keyof typeof t.studio] || id,
    icon: LIGHT_TYPE_ICONS[id],
  }))
  
  // Build aspect ratios with translations  
  const ASPECT_RATIOS = ASPECT_RATIO_IDS.map(id => ({
    id,
    label: id === 'original' ? t.studio.original : id,
  }))
  
  // Build preset colors with translations
  const bgColorLabels: Record<string, string> = { warm: t.studio.warmGold, cool: t.studio.coolBlue, neutral: t.studio.neutral, rose: t.studio.rose }
  const PRESET_BG_COLORS = PRESET_BG_COLOR_IDS.map(c => ({ ...c, label: bgColorLabels[c.id] || c.id }))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const webcamRef = useRef<Webcam>(null)
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  const [mode, setMode] = useState<StudioMode>('main')
  const modeRef = useRef(mode) // Ref to track latest mode for async callbacks
  useEffect(() => { modeRef.current = mode }, [mode])
  
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productFromPhone, setProductFromPhone] = useState(false) // Track if product came from phone upload
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Camera state
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Settings
  const [photoType, setPhotoType] = useState<'flatlay' | 'hanging'>('flatlay')
  const [lightType, setLightType] = useState('Softbox')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [lightDirection, setLightDirection] = useState('front')
  const [bgColor, setBgColor] = useState('#FFFFFF')
  
  // Color picker state (HSV)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [brightness, setBrightness] = useState(1)
  
  const { addGeneration, userProducts, generations, addUserAsset } = useAssetStore()
  const { addTask, updateTaskStatus, tasks } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  
  // Quota management
  const { quota, checkQuota } = useQuota()
  const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
  
  // 从 URL 参数恢复模式和 taskId（刷新后恢复）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as StudioMode)
      const savedTaskId = sessionStorage.getItem('productShotTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[Studio] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modelTypes = gen.output_model_types || []
                if (images.length > 0) {
                  console.log('[Studio] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                  setGeneratedModelTypes(modelTypes)
                  setCurrentGenerationId(gen.id)
                } else {
                  console.log('[Studio] No images found in database, returning to main')
                  setMode('main')
                  sessionStorage.removeItem('productShotTaskId')
                }
              } else {
                console.log('[Studio] Task not found in database, returning to main')
                setMode('main')
                sessionStorage.removeItem('productShotTaskId')
              }
            })
            .catch(err => {
              console.error('[Studio] Failed to recover images:', err)
              setMode('main')
              sessionStorage.removeItem('productShotTaskId')
            })
        }
      }
    }
  }, [searchParams, tasks.length])
  
  // Update bgColor when HSV changes
  const updateColorFromHSV = useCallback((h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v)
    setBgColor(rgbToHex(r, g, b))
  }, [])
  
  // Handle saturation/brightness picker
  const handleSBPick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = colorPickerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    
    setSaturation(x)
    setBrightness(1 - y)
    updateColorFromHSV(hue, x, 1 - y)
  }, [hue, updateColorFromHSV])
  
  // Handle hue slider
  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseFloat(e.target.value)
    setHue(h)
    updateColorFromHSV(h, saturation, brightness)
  }, [saturation, brightness, updateColorFromHSV])
  
  // Set color from preset
  const setPresetColor = useCallback((hex: string) => {
    const [h, s, v] = hexToHsv(hex)
    setHue(h)
    setSaturation(s)
    setBrightness(v)
    setBgColor(hex)
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setProductImage(base64)
      setProductFromPhone(true) // Mark as uploaded from phone
      setMode('main')
    }
  }, [])
  
  const handleSelectFromAsset = useCallback(async (imageUrl: string) => {
    // 直接使用 URL，后端会转换为 base64
    setProductImage(imageUrl)
    setProductFromPhone(false) // From asset library, don't save again
    setShowProductPanel(false)
    setMode('main')
  }, [])
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      // 获取视频的实际分辨率，保持正确的宽高比
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        setProductImage(imageSrc)
        setProductFromPhone(true) // Mark as captured from camera (phone)
        setMode('main')
      }
    }
  }, [])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
  }, [])
  
  const videoConstraints = {
    facingMode: "environment",
    width: { min: 1080, ideal: 1920 },
    height: { min: 1080, ideal: 1920 },
  }
  
  const handleGenerate = async () => {
    if (!productImage) return
    
    // Check quota before starting generation
    const hasQuota = await checkQuota(CREDIT_COST)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Save phone-uploaded product image to asset library BEFORE generation
    // This ensures product is saved even if generation fails
    if (productFromPhone && productImage) {
      saveProductToAssets(productImage, addUserAsset, t.common?.product || '商品')
    }
    
    // Capture current settings before async operations
    const currentPhotoType = photoType
    const currentLightType = lightType
    const currentLightDirection = lightDirection
    const currentBgColor = bgColor
    const currentAspectRatio = aspectRatio
    const currentProductImage = productImage
    
    // Create task and switch to processing mode (studio generates 2 images)
    const params = { photoType: currentPhotoType, lightType: currentLightType, lightDirection: currentLightDirection, lightColor: currentBgColor, aspectRatio: currentAspectRatio }
    const taskId = addTask('studio', currentProductImage, params, 2)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    
    // 保存 taskId 到 sessionStorage（刷新后可恢复）
    sessionStorage.setItem('productShotTaskId', taskId)
    router.replace('/product-shot?mode=processing')
    
    setMode('processing')
    setGeneratedImages([])
    setGeneratedModelTypes([])
    
    // 预扣配额（使用统一 hook）
    await reserveQuota({ taskId, imageCount: 2, taskType: 'product_studio' })
    
    // Run generation in background
    runBackgroundGeneration(taskId, currentProductImage, currentPhotoType, currentLightType, currentLightDirection, currentBgColor, currentAspectRatio)
  }
  
  // Background generation function (runs async, doesn't block UI)
  const runBackgroundGeneration = async (
    taskId: string,
    inputImage: string,
    photoTypeVal: 'flatlay' | 'hanging',
    lightTypeVal: string,
    lightDirectionVal: string,
    bgColorVal: string,
    aspectRatioVal: string
  ) => {
    try {
      // 不压缩，直接使用原图
      const compressedProduct = inputImage
      
      const basePayload = {
        productImage: compressedProduct,
        photoType: photoTypeVal,
        lightType: lightTypeVal,
        lightDirection: lightDirectionVal,
        lightColor: bgColorVal,
        aspectRatio: aspectRatioVal,
        taskId, // 传递 taskId，让后端直接写入数据库
        inputParams: {
          photoType: photoTypeVal,
          lightType: lightTypeVal,
          lightDirection: lightDirectionVal,
          lightColor: bgColorVal,
          aspectRatio: aspectRatioVal,
        },
      }
      
      // Stagger 2 requests
      const staggerDelay = 1000
      
      const createDelayedRequest = (index: number, delayMs: number) => {
        return new Promise<Response>((resolve, reject) => {
          setTimeout(() => {
            console.log(`Starting Studio ${index + 1}...`)
            fetch("/api/generate-studio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include', // Ensure cookies are sent
              body: JSON.stringify({ ...basePayload, index }),
            }).then(resolve).catch(reject)
          }, delayMs)
        })
      }
      
      const requests = [
        createDelayedRequest(0, 0),
        createDelayedRequest(1, staggerDelay),
      ]
      
      const responses = await Promise.allSettled(requests)
      
      const images: (string | null)[] = [null, null]
      const modelTypes: (('pro' | 'flash') | null)[] = [null, null]
      let usedPrompt: string = ''
      let allSavedToDb = true // 检查是否所有成功的图片都已被后端保存
      let firstDbId: string | null = null // 第一个成功的数据库 UUID
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]
        if (response.status === 'fulfilled') {
          const httpResponse = response.value
          try {
            // Check HTTP status first
            if (!httpResponse.ok) {
              const errorData = await httpResponse.json().catch(() => ({ error: `HTTP ${httpResponse.status}` }))
              const errorMsg = getErrorMessage(errorData.error || 'Unknown error', t)
              console.log(`Studio ${i + 1}: ✗ HTTP ${httpResponse.status} (${errorMsg})`)
              continue
            }
            
            const result = await httpResponse.json()
            if (result.success && result.image) {
              images[result.index] = result.image
              modelTypes[result.index] = result.modelType
              if (result.prompt && !usedPrompt) {
                usedPrompt = result.prompt
              }
              if (!result.savedToDb) {
                allSavedToDb = false
              }
              // 第一张成功的图片，设置 currentGenerationId 为数据库 UUID
              if (result.dbId && !firstDbId) {
                firstDbId = result.dbId
              }
              console.log(`Studio ${result.index + 1}: ✓ (${result.modelType}, ${result.duration}ms, savedToDb: ${result.savedToDb}, dbId: ${result.dbId})`)
            } else {
              console.log(`Studio ${i + 1}: ✗ (${result.error || 'No image'})`)
            }
          } catch (e: any) {
            console.log(`Studio ${i + 1}: ✗ (parse error: ${e.message})`)
          }
        } else {
          console.log(`Studio ${i + 1}: ✗ (promise rejected: ${response.reason})`)
        }
      }
      
      const finalImages = images.filter((img): img is string => img !== null)
      const finalModelTypes = modelTypes.filter((t): t is 'pro' | 'flash' => t !== null)
      const expectedCount = 2
      const failedCount = expectedCount - finalImages.length
      
      // 部分退款（使用统一 hook）
      if (finalImages.length > 0 && failedCount > 0) {
        await partialRefund(taskId, finalImages.length)
      }
      
      if (finalImages.length > 0) {
        // Update task with results
        updateTaskStatus(taskId, 'completed', finalImages)
        
        // 使用数据库 UUID 作为 currentGenerationId（用于收藏功能）
        // 如果没有 dbId（后端保存失败），则使用临时 taskId
        const generationId = firstDbId || taskId
        setCurrentGenerationId(generationId)
        console.log(`[Studio] Set currentGenerationId to: ${generationId} (dbId: ${firstDbId})`)
        
        await addGeneration({
          id: taskId,
          type: "studio",
          inputImageUrl: inputImage,
          outputImageUrls: finalImages,
          prompt: usedPrompt || undefined,
          createdAt: new Date().toISOString(),
          params: { photoType: photoTypeVal, lightType: lightTypeVal, lightDirection: lightDirectionVal, lightColor: bgColorVal, aspectRatio: aspectRatioVal },
        }, allSavedToDb) // 后端已写入数据库时，跳过前端的云端同步
        
        // 刷新配额显示（使用统一 hook）
        await confirmQuota()
        
        // Only update UI if still on processing mode
        if (modeRef.current === 'processing') {
          setGeneratedImages(finalImages)
          setGeneratedModelTypes(finalModelTypes)
          setMode('results')
          router.replace('/product-shot?mode=results')
        }
      } else {
        // 全部失败，全额退款（使用统一 hook）
        await refundQuota(taskId)
        
        updateTaskStatus(taskId, 'failed', undefined, t.studio.generationFailed)
        if (modeRef.current === 'processing') {
          alert(t.studio.generationFailed)
          setMode('main')
        }
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.studio.generationFailed)
      
      // 异常退款（使用统一 hook）
      await refundQuota(taskId)
      
      if (modeRef.current === 'processing') {
        const errorMsg = getErrorMessage(error.message, t) || t.studio.generationFailed
        alert(errorMsg)
        setMode('main')
      }
    }
  }
  
  // Navigation handlers during processing
  const handleNewProductDuringProcessing = () => {
    setProductImage(null)
    setProductFromPhone(false)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode('main')
  }
  
  const handleReturnHomeDuringProcessing = () => {
    router.push('/')
  }
  
  // Handle download - using shared hook with tracking
  const { downloadImage } = useImageDownload({ 
    trackingSource: 'studio', 
    filenamePrefix: 'studio' 
  })
  const handleDownload = (url: string, generationId?: string, imageIndex?: number) =>
    downloadImage(url, { generationId, imageIndex })
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => navigateToEdit(router, imageUrl)
  
  const handleReset = () => {
    setProductImage(null)
    setProductFromPhone(false)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode('main')
  }
  
  // Render upload area (shared between mobile and PC)
  const renderUploadArea = () => (
    <div className={`${isDesktop ? 'bg-white rounded-2xl p-6 shadow-sm border border-zinc-100' : 'bg-zinc-100 min-h-[200px] p-4'} flex items-center justify-center`}>
      {!productImage ? (
        <div className={`w-full ${isDesktop ? '' : 'max-w-sm'} space-y-3`}>
          {/* Camera - hidden on desktop */}
          {!isDesktop && (
            <button
              onClick={() => setMode('camera')}
              className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-amber-200"
            >
              <Camera className="w-5 h-5" />
              <span className="font-medium">{t.studio.shootProduct}</span>
            </button>
          )}
          
          {/* PC: Larger upload area with drag & drop support */}
          {isDesktop ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                onDrop={async (e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                  const file = e.dataTransfer.files?.[0]
                  if (file && file.type.startsWith('image/')) {
                    const base64 = await fileToBase64(file)
                    setProductImage(base64)
                    setProductFromPhone(true)
                    setMode('main')
                  }
                }}
                className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-amber-400 hover:bg-amber-50/50 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                  <Upload className="w-8 h-8 text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-700">{t.studio.shootProduct}</p>
                  <p className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || 'Click to upload or drag image'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowGalleryPanel(true)}
                  className="h-12 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-center gap-2 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-600">{t.studio.fromGallery}</span>
                </button>
                <button
                  onClick={() => setShowProductPanel(true)}
                  className="h-12 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-center gap-2 transition-colors"
                >
                  <FolderHeart className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-600">{t.camera.assetLibrary}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-700">{t.camera.album}</span>
              </button>
              <button
                onClick={() => setShowGalleryPanel(true)}
                className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
              >
                <Home className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-700">{t.studio.fromGallery}</span>
              </button>
              <button
                onClick={() => setShowProductPanel(true)}
                className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
              >
                <FolderHeart className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-700">{t.camera.assetLibrary}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative w-full ${isDesktop ? 'max-w-full' : 'max-w-xs'}`}>
          <Image 
            src={productImage} 
            alt="Product"
            width={400}
            height={400}
            className={`w-full rounded-xl shadow-lg object-contain bg-white ${isDesktop ? 'max-h-[400px]' : ''}`}
          />
          <button
            onClick={() => {
              setProductImage(null)
              setProductFromPhone(false)
            }}
            className="absolute bottom-3 right-3 px-4 py-2 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
          >
            {t.edit.editNew}
          </button>
        </div>
      )}
    </div>
  )
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className={`h-full flex flex-col ${isDesktop ? 'bg-zinc-50' : 'bg-zinc-50'}`}>
      {/* Header - simplified for PC since TopNav exists */}
      {!isDesktop && (
      <div className="h-14 flex items-center px-4 bg-white border-b shrink-0">
        <button 
          onClick={() => router.push('/')}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
        >
          <Home className="w-5 h-5" />
        </button>
        <span className="font-semibold ml-2">{t.studio.title}</span>
      </div>
      )}
      
      {/* PC Header */}
      {isDesktop && (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-5xl mx-auto px-8 py-5">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push('/')}
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <Home className="w-5 h-5 text-zinc-600" />
              </button>
              <h1 className="text-lg font-semibold text-zinc-900">{t.studio.title}</h1>
            </div>
          </div>
        </div>
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload}
      />
      
      <AnimatePresence mode="wait">
        {/* Main Mode - Combined Upload + Settings */}
        {mode === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'pb-40'}`}
          >
            {/* PC: Two-column layout */}
            {isDesktop ? (
              <div className="max-w-5xl mx-auto px-8">
                <div className="flex gap-8">
                  {/* Left: Image Upload + Photo Type */}
                  <div className="w-[380px] shrink-0 space-y-4">
                    {renderUploadArea()}
                    
                    {/* Photo Type - under upload */}
                    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
                      <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.photoType}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setPhotoType('flatlay')}
                          className={`py-3 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                            photoType === 'flatlay'
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-zinc-200 bg-white hover:border-zinc-300'
                          }`}
                        >
                          <span className="text-xl">🎯</span>
                          <span className={`text-xs font-medium ${photoType === 'flatlay' ? 'text-amber-700' : 'text-zinc-600'}`}>
                            {t.studio.flatLay}
                          </span>
                        </button>
                        <button
                          onClick={() => setPhotoType('hanging')}
                          className={`py-3 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                            photoType === 'hanging'
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-zinc-200 bg-white hover:border-zinc-300'
                          }`}
                        >
                          <span className="text-xl">👕</span>
                          <span className={`text-xs font-medium ${photoType === 'hanging' ? 'text-amber-700' : 'text-zinc-600'}`}>
                            {t.studio.hangingShot}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Generate Button - PC left column */}
                    <button
                      onClick={(e) => {
                        triggerFlyToGallery(e)
                        handleGenerate()
                      }}
                      disabled={!productImage}
                      className={`w-full h-12 rounded-xl text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                        !productImage
                          ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                          : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200/50"
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>{t.camera.startShoot}</span>
                      <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
                    </button>
                  </div>
                  
                  {/* Right: Settings */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6">
                      {/* Light Type */}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.lightType}</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {LIGHT_TYPES.map(type => {
                            const Icon = type.icon
                            return (
                    <button
                                key={type.id}
                                onClick={() => setLightType(type.id)}
                                className={`py-3 px-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                                  lightType === type.id
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                                }`}
                    >
                                <Icon className={`w-5 h-5 ${lightType === type.id ? 'text-amber-600' : 'text-zinc-400'}`} />
                                <span className={`text-xs font-medium ${lightType === type.id ? 'text-amber-700' : 'text-zinc-600'}`}>
                                  {type.label}
                                </span>
                    </button>
                            )
                          })}
                        </div>
                      </div>
                    
                      {/* Aspect Ratio */}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.aspectRatio}</h3>
                        <div className="flex flex-wrap gap-2">
                          {ASPECT_RATIOS.map(ratio => (
                    <button
                              key={ratio.id}
                              onClick={() => setAspectRatio(ratio.id)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                aspectRatio === ratio.id
                                  ? 'bg-zinc-900 text-white'
                                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                              }`}
                            >
                              {ratio.label}
                    </button>
                          ))}
                        </div>
                      </div>
                    
                      {/* Light Direction */}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.lightDirection}</h3>
                        <div className="grid grid-cols-3 gap-2 max-w-[200px]">
                          {[
                            ['top-left', '↘'], ['top', '↓'], ['top-right', '↙'],
                            ['left', '→'], ['front', '●'], ['right', '←'],
                            ['bottom-left', '↗'], ['bottom', '↑'], ['bottom-right', '↖'],
                          ].map(([dir, icon]) => (
                    <button
                              key={dir}
                              onClick={() => setLightDirection(dir)}
                              className={`aspect-square rounded-xl border-2 flex items-center justify-center text-lg transition-all ${
                                dir === 'front'
                                  ? 'bg-zinc-800 text-white border-zinc-800'
                                  : lightDirection === dir
                                    ? 'border-amber-500 bg-amber-500 text-white'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-400'
                              }`}
                            >
                              {dir === 'front' ? '📦' : icon}
                    </button>
                          ))}
                  </div>
                </div>
                      
                      {/* Background Color */}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.bgColor}</h3>
                        <div className="flex gap-2 mb-3">
                          {/* White - default */}
                          <button
                            onClick={() => {
                              setBgColor('#FFFFFF')
                              setHue(0)
                              setSaturation(0)
                              setBrightness(1)
                            }}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${
                              bgColor === '#FFFFFF' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-zinc-300 hover:border-zinc-400'
                            }`}
                            style={{ background: '#FFFFFF' }}
                            title={t.common?.white || 'White'}
                          />
                          {PRESET_BG_COLORS.map(color => (
                  <button
                              key={color.id}
                    onClick={() => {
                                setBgColor(color.colors[0])
                                const [h, s, v] = hexToHsv(color.colors[0])
                                setHue(h)
                                setSaturation(s)
                                setBrightness(v)
                    }}
                              className={`w-10 h-10 rounded-full border-2 transition-all ${
                                bgColor === color.colors[0] ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-zinc-200 hover:border-zinc-400'
                              }`}
                              style={{ background: `linear-gradient(135deg, ${color.colors[0]}, ${color.colors[1]})` }}
                              title={color.label}
                            />
                          ))}
                          {/* Custom color from picker */}
                          {(() => {
                            const isPreset = bgColor === '#FFFFFF' || PRESET_BG_COLORS.some(c => c.colors[0] === bgColor)
                            return (
                              <div
                                className={`w-10 h-10 rounded-full border-2 transition-all ${
                                  !isPreset 
                                    ? 'border-amber-500 ring-2 ring-amber-500/20' 
                                    : 'border-dashed border-zinc-300'
                                }`}
                                style={{ 
                                  background: !isPreset ? bgColor : 'linear-gradient(135deg, #f5f5f5 25%, #e5e5e5 25%, #e5e5e5 50%, #f5f5f5 50%, #f5f5f5 75%, #e5e5e5 75%)',
                                  backgroundSize: '8px 8px'
                                }}
                                title={t.studio?.customColor || 'Custom'}
                              />
                            )
                          })()}
                        </div>
                        {/* Color Picker */}
                        <div className="bg-zinc-100 rounded-xl p-3 space-y-3">
                          <div
                            ref={colorPickerRef}
                            onClick={handleSBPick}
                            onMouseMove={(e) => e.buttons === 1 && handleSBPick(e)}
                            onTouchMove={handleSBPick}
                            className="relative h-24 rounded-lg cursor-crosshair overflow-hidden"
                            style={{
                              background: `
                                linear-gradient(to bottom, transparent, black),
                                linear-gradient(to right, white, hsl(${hue * 360}, 100%, 50%))
                              `
                            }}
                          >
                            <div
                              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                              style={{
                                left: `calc(${saturation * 100}% - 8px)`,
                                top: `calc(${(1 - brightness) * 100}% - 8px)`,
                                backgroundColor: bgColor,
                              }}
                            />
                          </div>
                          
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={hue}
                            onChange={handleHueChange}
                            className="w-full h-3 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            }}
                          />
                        </div>
                      </div>
                      
            </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Mobile Layout */
              <>
                {/* Image Upload Area */}
                {renderUploadArea()}
            
            {/* Settings Panel */}
            <div className="p-4 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10 space-y-5">
              {/* Photo Type */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.studio.photoType}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPhotoType('flatlay')}
                    className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                      photoType === 'flatlay'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-xl">🎯</span>
                    <span className={`text-xs font-medium ${photoType === 'flatlay' ? 'text-amber-700' : 'text-zinc-600'}`}>
                      {t.studio.flatLay}
                    </span>
                    <span className="text-[10px] text-zinc-400">{t.studio.flatLayDesc}</span>
                  </button>
                  <button
                    onClick={() => setPhotoType('hanging')}
                    className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                      photoType === 'hanging'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-xl">👕</span>
                    <span className={`text-xs font-medium ${photoType === 'hanging' ? 'text-amber-700' : 'text-zinc-600'}`}>
                      {t.studio.hangingShot}
                    </span>
                    <span className="text-[10px] text-zinc-400">{t.studio.hangingShotDesc}</span>
                  </button>
                </div>
              </div>
              
              {/* Light Type */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.studio.lightType}</h3>
                <div className="flex gap-2">
                  {LIGHT_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setLightType(type.id)}
                        className={`flex-1 py-2.5 px-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          lightType === type.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${lightType === type.id ? 'text-amber-600' : 'text-zinc-400'}`} />
                        <span className={`text-xs font-medium ${lightType === type.id ? 'text-amber-700' : 'text-zinc-600'}`}>
                          {type.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Aspect Ratio */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.studio.aspectRatio}</h3>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        aspectRatio === ratio.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Light Direction */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.studio.lightDirection}</h3>
                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                  <div className="grid grid-cols-3 gap-1.5 max-w-[140px] mx-auto">
                    {LIGHT_DIRECTIONS.map(dir => (
                      <button
                        key={dir.id}
                        onClick={() => setLightDirection(dir.id)}
                        className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                          dir.id === 'front'
                            ? 'bg-zinc-800 text-white'
                            : lightDirection === dir.id
                              ? 'bg-yellow-400 shadow-md'
                              : 'bg-zinc-200 hover:bg-zinc-300'
                        }`}
                      >
                        {dir.id === 'front' ? (
                          <span className="text-sm">📦</span>
                        ) : lightDirection === dir.id ? (
                          <Sun className="w-4 h-4 text-yellow-800" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Background Color - Simplified */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-700">{t.studio.backgroundColor}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setBgColor('#FFFFFF')}
                      className={`w-6 h-6 rounded-full border-2 overflow-hidden transition-all ${
                        bgColor === '#FFFFFF' ? 'border-amber-500 scale-110' : 'border-zinc-200 shadow-sm'
                      }`}
                      style={{ background: '#FFFFFF' }}
                      title={t.common?.white || "White"}
                    />
                    {PRESET_BG_COLORS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setPresetColor(preset.colors[0])}
                        className={`w-6 h-6 rounded-full border-2 overflow-hidden transition-all ${
                          bgColor === preset.colors[0] ? 'border-amber-500 scale-110' : 'border-white shadow-sm'
                        }`}
                        style={{ 
                          background: `linear-gradient(135deg, ${preset.colors[0]} 50%, ${preset.colors[1]} 50%)`
                        }}
                        title={preset.label}
                      />
                    ))}
                    {/* Custom color indicator */}
                    {(() => {
                      const isPreset = bgColor === '#FFFFFF' || PRESET_BG_COLORS.some(c => c.colors[0] === bgColor)
                      return (
                        <div
                          className={`w-6 h-6 rounded-full border-2 overflow-hidden transition-all ${
                            !isPreset ? 'border-amber-500 scale-110' : 'border-dashed border-zinc-300'
                          }`}
                          style={{ 
                            background: !isPreset ? bgColor : 'linear-gradient(135deg, #f5f5f5 25%, #e5e5e5 25%, #e5e5e5 50%, #f5f5f5 50%, #f5f5f5 75%, #e5e5e5 75%)',
                            backgroundSize: '6px 6px'
                          }}
                          title={t.studio?.customColor || 'Custom'}
                        />
                      )
                    })()}
                  </div>
                </div>
                
                {/* Color Picker */}
                <div className="bg-zinc-900 rounded-xl p-3 space-y-3">
                  <div
                    ref={colorPickerRef}
                    onClick={handleSBPick}
                    onMouseMove={(e) => e.buttons === 1 && handleSBPick(e)}
                    onTouchMove={handleSBPick}
                    className="relative h-24 rounded-lg cursor-crosshair overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${hue * 360}, 100%, 50%))
                      `
                    }}
                  >
                    <div
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        left: `calc(${saturation * 100}% - 8px)`,
                        top: `calc(${(1 - brightness) * 100}% - 8px)`,
                        backgroundColor: bgColor,
                      }}
                    />
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={hue}
                    onChange={handleHueChange}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                  />
                </div>
              </div>
              
            </div>
              </>
            )}
          </motion.div>
        )}
        
        {/* Fixed Generate Button for main mode - Mobile only */}
        {mode === 'main' && !isDesktop && (
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto z-40">
            <button
              onClick={(e) => {
                triggerFlyToGallery(e)
                handleGenerate()
              }}
              disabled={!productImage}
              className={`w-full h-14 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                !productImage
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>{t.camera.startShoot}</span>
              <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
            </button>
          </div>
        )}
        
        {/* Camera Mode */}
        {mode === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-black relative"
          >
            {/* Back button - hidden on desktop */}
            {!isDesktop && (
            <button
              onClick={() => setMode('main')}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            )}
            
            {/* Camera view / Upload interface */}
            <div className={`flex-1 relative ${isDesktop ? 'bg-zinc-50' : ''}`}>
              {isDesktop ? (
                /* PC Desktop: Show upload interface */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                      <Camera className="w-12 h-12 text-zinc-400" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 mb-2">{t.studio?.uploadProduct || '上传商品图片'}</h2>
                    <p className="text-zinc-500 mb-6">{t.studio?.uploadProductDesc || '选择商品图片开始棚拍'}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-5 h-5" />
                        {t.studio?.fromAlbum || '从相册选择'}
                      </button>
                      <button
                        onClick={() => setShowProductPanel(true)}
                        className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-xl font-medium hover:bg-zinc-300 transition-colors flex items-center gap-2"
                      >
                        <FolderHeart className="w-5 h-5" />
                        {t.studio?.assetLibrary || '素材库'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : hasCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">{t.errors.uploadFailed}</p>
                    <button
                      onClick={() => {
                        setMode('main')
                        setTimeout(() => fileInputRef.current?.click(), 100)
                      }}
                      className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm"
                    >
                      {t.studio.fromAlbum}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Grid overlay - hidden on desktop */}
              {!isDesktop && (
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
              )}
              
              {/* Focus frame - hidden on desktop */}
              {!isDesktop && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400" />
                </div>
              </div>
              )}
              
              {!isDesktop && (
              <div className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
                {t.camera.shootYourProduct}
              </div>
              )}
            </div>
            
            {/* Capture button - positioned above BottomNav, hidden on desktop in camera mode */}
            <div className={`py-8 pb-24 flex justify-center ${isDesktop ? 'bg-white border-t border-zinc-200' : 'bg-black'}`}>
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full border-4 border-amber-400/50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-16 h-16 bg-amber-400 rounded-full" />
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Processing Mode */}
        {mode === 'processing' && (
          <ProcessingView
            numImages={4}
            generatedImages={generatedImages}
            themeColor="amber"
            title={t.studio?.generating || 'Creating product photos'}
            mobileStatusLines={[t.studio?.generatingDesc || 'Please wait...']}
            aspectRatio="1/1"
            onShootMore={handleNewProductDuringProcessing}
            onReturnHome={handleReturnHomeDuringProcessing}
            onDownload={(url, i) => handleDownload(url, currentGenerationId || undefined, i)}
            shootMoreText={t.studio?.shootNew || 'Shoot More'}
            returnHomeText={t.studio?.returnHome || 'Return Home'}
          />
        )}
        
        {/* Results Mode */}
        {mode === 'results' && (
          <ResultsView
            title={t.studio.results}
            onBack={handleReset}
            images={generatedImages.map((url, i) => ({
              url,
              status: 'completed' as const,
            }))}
            getBadge={(i) => ({
              text: generatedModelTypes[i] === 'flash' ? `${t.studio?.badge || 'Studio'} 2.5` : (t.studio?.badge || 'Studio'),
              className: 'bg-amber-500',
            })}
            themeColor="amber"
            aspectRatio="1/1"
            onFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onDownload={(url, i) => handleDownload(url, currentGenerationId || undefined, i)}
            onShootNext={handleReset}
            onGoEdit={handleGoToEdit}
            onRegenerate={handleGenerate}
            onImageClick={(i) => setSelectedResultIndex(i)}
          >
            {/* Photo Detail Dialog */}
            <PhotoDetailDialog
              open={selectedResultIndex !== null && !!generatedImages[selectedResultIndex!]}
              onClose={() => setSelectedResultIndex(null)}
              imageUrl={selectedResultIndex !== null ? generatedImages[selectedResultIndex] || '' : ''}
              badges={selectedResultIndex !== null ? [
                { text: t.gallery.productStudio, className: 'bg-amber-500 text-white' },
              ] : []}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={() => {
                if (selectedResultIndex === null) return
                handleDownload(generatedImages[selectedResultIndex], currentGenerationId || undefined, selectedResultIndex)
              }}
              onFullscreen={() => {
                if (selectedResultIndex === null) return
                setFullscreenImage(generatedImages[selectedResultIndex])
              }}
              quickActions={selectedResultIndex !== null ? [
                createQuickActions.edit(() => {
                  const imageUrl = generatedImages[selectedResultIndex]
                  setSelectedResultIndex(null)
                  if (imageUrl) handleGoToEdit(imageUrl)
                }),
                createQuickActions.groupShoot(() => {
                  const imageUrl = generatedImages[selectedResultIndex]
                  if (imageUrl) {
                    sessionStorage.setItem('groupShootImage', imageUrl)
                    router.push('/group-shot')
                  }
                }),
              ] : []}
              inputImages={productImage ? [{ url: productImage, label: t.common?.product || 'Product' }] : []}
              onInputImageClick={(url) => setFullscreenImage(url)}
            >
              {/* Debug content */}
              {debugMode && selectedResultIndex !== null && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.debugParams}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                      {t.studio.lightSource}: {LIGHT_TYPES.find(lt => lt.id === lightType)?.label || lightType}
                    </span>
                    <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                      {t.studio.aspectRatio}: {aspectRatio}
                    </span>
                    <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600 flex items-center gap-1">
                      {t.studio.bgColor}: <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: bgColor }} />
                    </span>
                  </div>
                </div>
              )}
            </PhotoDetailDialog>
            
            {/* Fullscreen Image Viewer */}
            <FullscreenImageViewer
              open={!!fullscreenImage}
              onClose={() => setFullscreenImage(null)}
              imageUrl={fullscreenImage || ''}
            />
          </ResultsView>
        )}
      </AnimatePresence>
      
      {/* Product Selection Panel */}
      <AssetPickerPanel
        open={showProductPanel}
        onClose={() => setShowProductPanel(false)}
        onSelect={handleSelectFromAsset}
        onUploadClick={() => fileInputRef.current?.click()}
        themeColor="amber"
      />
      
      {/* Gallery Selection Panel */}
      <GalleryPickerPanel
        open={showGalleryPanel}
        onClose={() => setShowGalleryPanel(false)}
        onSelect={(url) => {
          setProductImage(url)
          setProductFromPhone(false)
        }}
        themeColor="amber"
      />
      
    </div>
  )
}

// Default export with Suspense wrapper for useSearchParams
export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    }>
      <StudioPageContent />
    </Suspense>
  )
}
