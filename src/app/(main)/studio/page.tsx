"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { 
  ArrowLeft, Upload, Loader2, Download, Heart, 
  Sun, Sparkles, Lightbulb, Zap, Home, FolderHeart, X, Camera, ZoomIn, Wand2
} from "lucide-react"
import { useRouter } from "next/navigation"
import Webcam from "react-webcam"
import { fileToBase64, compressBase64Image, generateId, ensureBase64 } from "@/lib/utils"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { PRESET_PRODUCTS } from "@/data/presets"
import Image from "next/image"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || '资源紧张，请稍后重试'
  }
  return error
}

// Light types - IDs only, labels come from translations
const LIGHT_TYPE_IDS = ['Softbox', 'Sunlight', 'Dramatic', 'Neon'] as const
const LIGHT_TYPE_ICONS = { Softbox: Lightbulb, Sunlight: Sun, Dramatic: Sparkles, Neon: Zap }

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

export default function StudioPage() {
  const router = useRouter()
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
  
  const [mode, setMode] = useState<StudioMode>('main')
  const modeRef = useRef(mode) // Ref to track latest mode for async callbacks
  useEffect(() => { modeRef.current = mode }, [mode])
  
  const [productImage, setProductImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)
  
  // Camera state
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Settings
  const [lightType, setLightType] = useState('Softbox')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [lightDirection, setLightDirection] = useState('front')
  const [bgColor, setBgColor] = useState('#FFFFFF')
  
  // Color picker state (HSV)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [brightness, setBrightness] = useState(1)
  
  const { addGeneration, addFavorite, removeFavorite, isFavorited, favorites, userProducts, generations } = useAssetStore()
  const { addTask, updateTaskStatus } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  
  // Quota management
  const { quota, checkQuota, refreshQuota, showExceededModal, requiredCount, closeExceededModal } = useQuota()
  
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
      setMode('main')
    }
  }, [])
  
  const handleSelectFromAsset = useCallback(async (imageUrl: string) => {
    setIsLoadingAsset(true)
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setProductImage(base64)
        setShowProductPanel(false)
        setMode('main')
      }
    } catch (e) {
      console.error('Failed to load asset:', e)
    } finally {
      setIsLoadingAsset(false)
    }
  }, [])
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setProductImage(imageSrc)
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
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleGenerate = async () => {
    if (!productImage) return
    
    // Check quota before starting generation (2 images for studio)
    const hasQuota = await checkQuota(2)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Capture current settings before async operations
    const currentLightType = lightType
    const currentLightDirection = lightDirection
    const currentBgColor = bgColor
    const currentAspectRatio = aspectRatio
    const currentProductImage = productImage
    
    // Create task and switch to processing mode (studio generates 2 images)
    const params = { lightType: currentLightType, lightDirection: currentLightDirection, lightColor: currentBgColor, aspectRatio: currentAspectRatio }
    const taskId = addTask('studio', currentProductImage, params, 2)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    
    setMode('processing')
    setGeneratedImages([])
    setGeneratedModelTypes([])
    
    // IMMEDIATELY reserve quota - deduct before generation starts
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: 2,
          taskType: 'product_studio',
        }),
      })
      console.log('[Quota] Reserved 2 images for task', taskId)
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve quota:', e)
    }
    
    // Run generation in background
    runBackgroundGeneration(taskId, currentProductImage, currentLightType, currentLightDirection, currentBgColor, currentAspectRatio)
  }
  
  // Background generation function (runs async, doesn't block UI)
  const runBackgroundGeneration = async (
    taskId: string,
    inputImage: string,
    lightTypeVal: string,
    lightDirectionVal: string,
    bgColorVal: string,
    aspectRatioVal: string
  ) => {
    try {
      const compressedProduct = await compressBase64Image(inputImage, 1024)
      
      const basePayload = {
        productImage: compressedProduct,
        lightType: lightTypeVal,
        lightDirection: lightDirectionVal,
        lightColor: bgColorVal,
        aspectRatio: aspectRatioVal,
        taskId, // 传递 taskId，让后端直接写入数据库
        inputParams: {
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
              console.log(`Studio ${result.index + 1}: ✓ (${result.modelType}, ${result.duration}ms, savedToDb: ${result.savedToDb})`)
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
      
      // Refund failed images
      if (failedCount > 0) {
        console.log('[Quota] Refunding', failedCount, 'failed studio images')
        try {
          await fetch('/api/quota/reserve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              actualImageCount: finalImages.length,
              refundCount: failedCount,
            }),
          })
        } catch (e) {
          console.warn('[Quota] Failed to refund:', e)
        }
      }
      
      if (finalImages.length > 0) {
        // Update task with results
        updateTaskStatus(taskId, 'completed', finalImages)
        
        const id = taskId
        setCurrentGenerationId(id)
        
        await addGeneration({
          id,
          type: "studio",
          inputImageUrl: inputImage,
          outputImageUrls: finalImages,
          prompt: usedPrompt || undefined,
          createdAt: new Date().toISOString(),
          params: { lightType: lightTypeVal, lightDirection: lightDirectionVal, lightColor: bgColorVal, aspectRatio: aspectRatioVal },
        }, allSavedToDb) // 后端已写入数据库时，跳过前端的云端同步
        
        // Refresh quota after successful generation
        await refreshQuota()
        
        // Only update UI if still on processing mode
        if (modeRef.current === 'processing') {
          setGeneratedImages(finalImages)
          setGeneratedModelTypes(finalModelTypes)
          setMode('results')
        }
      } else {
        // All failed - full refund
        console.log('[Quota] All studio tasks failed, refunding all')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
          await refreshQuota()
        } catch (e) {
          console.warn('[Quota] Failed to refund on total failure:', e)
        }
        
        updateTaskStatus(taskId, 'failed', undefined, t.studio.generationFailed)
        if (modeRef.current === 'processing') {
          alert(t.studio.generationFailed)
          setMode('main')
        }
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || t.studio.generationFailed)
      
      // Refund quota on error
      console.log('[Quota] Error occurred, refunding reserved quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        await refreshQuota()
      } catch (e) {
        console.warn('[Quota] Failed to refund on error:', e)
      }
      
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
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode('main')
  }
  
  const handleReturnHomeDuringProcessing = () => {
    router.push('/')
  }
  
  const handleDownload = async (url: string, generationId?: string, imageIndex?: number) => {
    // Track download event (don't await, fire and forget)
    fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        generationId,
        imageIndex,
        source: 'studio',
      }),
    }).catch(() => {}) // Silently ignore tracking errors
    
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `studio-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }
  
  const handleFavorite = async (imageIndex: number) => {
    if (!currentGenerationId) return
    
    const currentlyFavorited = isFavorited(currentGenerationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === currentGenerationId && f.imageIndex === imageIndex
      )
      if (fav) await removeFavorite(fav.id)
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
  
  const handleReset = () => {
    setProductImage(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode('main')
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="h-14 flex items-center px-4 bg-white border-b shrink-0">
        <button 
          onClick={() => router.push('/')}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
        >
          <Home className="w-5 h-5" />
        </button>
        <span className="font-semibold ml-2">{t.studio.title}</span>
      </div>
      
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
            className="flex-1 overflow-y-auto pb-24"
          >
            {/* Image Upload Area */}
            <div className="bg-zinc-100 min-h-[200px] flex items-center justify-center relative p-4">
              {!productImage ? (
                <div className="w-full max-w-sm space-y-2">
                  {/* Camera */}
                  <button
                    onClick={() => setMode('camera')}
                    className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-amber-200"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">{t.studio.shootProduct}</span>
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* Album */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700">{t.camera.album}</span>
                    </button>
                    
                    {/* Gallery */}
                    <button
                      onClick={() => setShowGalleryPanel(true)}
                      className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Home className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700">{t.studio.fromGallery}</span>
                    </button>
                    
                    {/* Asset library */}
                    <button
                      onClick={() => setShowProductPanel(true)}
                      className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-amber-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderHeart className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700">{t.camera.assetLibrary}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full max-w-xs">
                  <Image 
                    src={productImage} 
                    alt="Product"
                    width={300}
                    height={300}
                    className="w-full rounded-xl shadow-lg object-contain bg-white"
                  />
                  <button
                    onClick={() => setProductImage(null)}
                    className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
                  >
                    {t.edit.editNew}
                  </button>
                </div>
              )}
            </div>
            
            {/* Settings Panel */}
            <div className="p-4 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10 space-y-5">
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
                    <button
                      onClick={() => setBgColor('#FFFFFF')}
                      className={`w-6 h-6 rounded-full border-2 overflow-hidden transition-all ${
                        bgColor === '#FFFFFF' ? 'border-amber-500 scale-110' : 'border-zinc-200 shadow-sm'
                      }`}
                      style={{ background: '#FFFFFF' }}
                      title="白色"
                    />
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
              
              {/* Generate Button */}
              <div className="pt-4 pb-20">
                <button
                  onClick={handleGenerate}
                  disabled={!productImage}
                  className={`w-full h-14 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                    !productImage
                      ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{t.camera.startShoot}</span>
                </button>
              </div>
            </div>
          </motion.div>
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
            {/* Back button */}
            <button
              onClick={() => setMode('main')}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Camera view */}
            <div className="flex-1 relative">
              {hasCamera ? (
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
              
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
              
              {/* Focus frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400" />
                </div>
              </div>
              
              <div className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
                {t.camera.shootYourProduct}
              </div>
            </div>
            
            {/* Capture button */}
            <div className="bg-black py-8 flex justify-center">
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
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-amber-500 animate-spin relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800 mb-2">{t.studio.generating}</h3>
            <p className="text-zinc-500 text-sm mb-8">{t.studio.generatingDesc}</p>
            
            {/* Navigation buttons during processing */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-400 text-xs text-center mb-4">{t.studio.continueInBackground}</p>
              <button
                onClick={handleNewProductDuringProcessing}
                className="w-full h-12 rounded-full bg-amber-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t.studio.shootNew}
              </button>
              <button
                onClick={handleReturnHomeDuringProcessing}
                className="w-full h-12 rounded-full bg-zinc-100 text-zinc-700 font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Home className="w-5 h-5" />
                {t.studio.returnHome}
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Results Mode */}
        {mode === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto"
          >
            <div className="p-4 pb-32">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.results}</h3>
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((url, i) => (
                  <div 
                    key={i}
                    className="relative aspect-square bg-zinc-100 rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedResultIndex(i)}
                  >
                    <Image src={url} alt={`Result ${i + 1}`} fill className="object-cover" />
                    
                    {/* Model type badge */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500 text-white">
                        影棚
                      </span>
                      {generatedModelTypes[i] === 'flash' && (
                        <span className="px-1.5 py-1 rounded text-[9px] font-medium bg-amber-600 text-white">
                          2.5
                        </span>
                      )}
                    </div>
                    
                    {/* Favorite button - always visible */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFavorite(i)
                      }}
                      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                        currentGenerationId && isFavorited(currentGenerationId, i)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, i) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-3">
              <button
                onClick={() => setMode('main')}
                className="flex-1 h-12 border border-zinc-200 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
                >
                  {t.studio.adjustParams}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 h-12 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
                >
                  {t.studio.shootNew}
                </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && generatedImages[selectedResultIndex] && (
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
                    <div 
                      className="relative aspect-square bg-zinc-900 cursor-pointer group"
                      onClick={() => setFullscreenImage(generatedImages[selectedResultIndex])}
                    >
                      <Image 
                        src={generatedImages[selectedResultIndex]} 
                        alt="Detail" 
                        fill 
                        className="object-contain" 
                      />
                      {/* Zoom hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <ZoomIn className="w-6 h-6 text-zinc-700" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              {t.gallery.productStudio}
                            </span>
                            {generatedModelTypes[selectedResultIndex] === 'flash' && (
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
                            onClick={() => handleFavorite(selectedResultIndex)}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                              currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex)
                                ? "bg-red-50 border-red-200 text-red-500"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex) ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleDownload(generatedImages[selectedResultIndex], currentGenerationId || undefined, selectedResultIndex)}
                            className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Generation Parameters - Only show in debug mode */}
                      {debugMode && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">{t.studio.debugParams}</h3>
                        
                        {/* Reference images */}
                        <div className="space-y-3">
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {/* Input Product Image */}
                            {productImage && (
                              <div className="flex flex-col items-center shrink-0">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                                  <img 
                                    src={productImage} 
                                    alt={t.studio.productOriginal}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{t.studio.productOriginal}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Settings params */}
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
                      </div>
                      )}

                      <button 
                        onClick={() => {
                          setSelectedResultIndex(null)
                          handleGoToEdit(generatedImages[selectedResultIndex])
                        }}
                        className="w-full h-12 mt-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        {t.gallery.goEdit}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Fullscreen Image Viewer */}
            {fullscreenImage && (
              <div 
                className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
                onClick={() => setFullscreenImage(null)}
              >
                <button
                  onClick={() => setFullscreenImage(null)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={4}
                  centerOnInit
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <img
                      src={fullscreenImage}
                      alt="Fullscreen"
                      className="max-w-full max-h-full object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Product Selection Panel */}
      <AnimatePresence>
        {showProductPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowProductPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.studio.selectProduct}</span>
                <button
                  onClick={() => setShowProductPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Source Tabs */}
              <div className="px-4 py-2 border-b bg-white">
                <div className="flex bg-zinc-100 rounded-lg p-1">
                  <button
                    onClick={() => setProductSourceTab("preset")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "preset"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.studio.officialExamples} ({PRESET_PRODUCTS.length})
                  </button>
                  <button
                    onClick={() => setProductSourceTab("user")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "user"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.studio.myProducts} ({userProducts.length})
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {/* Loading overlay */}
                {isLoadingAsset && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  </div>
                )}
                {productSourceTab === 'preset' ? (
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                          {t.common.official}
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {userProducts.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.studio.noMyProducts}</p>
                    <p className="text-xs mt-1">{t.studio.uploadInAssets}</p>
                    <button
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600"
                    >
                      {t.studio.goUpload}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Gallery Selection Panel */}
      <AnimatePresence>
        {showGalleryPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowGalleryPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.edit.selectFromGallery}</span>
                <button
                  onClick={() => setShowGalleryPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {/* Loading overlay */}
                {isLoadingAsset && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  </div>
                )}
                {generations.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {generations.flatMap(gen => 
                      (gen.outputImageUrls || []).map((url, idx) => (
                        <button
                          key={`${gen.id}-${idx}`}
                          disabled={isLoadingAsset}
                          onClick={async () => {
                            setIsLoadingAsset(true)
                            try {
                              const base64 = await ensureBase64(url)
                              setProductImage(base64)
                              setShowGalleryPanel(false)
                            } catch (error) {
                              console.error('Failed to load image:', error)
                            } finally {
                              setIsLoadingAsset(false)
                            }
                          }}
                          className="aspect-[4/5] rounded-lg overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all bg-white disabled:opacity-50"
                        >
                          <Image src={url} alt={`Gallery ${idx + 1}`} fill className="object-cover" />
                        </button>
                      ))
                    ).slice(0, 30)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <Home className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.studio.noGalleryImages}</p>
                    <p className="text-xs mt-1">{t.studio.goShootToGenerate}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        usedCount={quota?.usedCount}
        totalQuota={quota?.totalQuota}
        requiredCount={requiredCount}
        userEmail={user?.email || ''}
      />
    </div>
  )
}

