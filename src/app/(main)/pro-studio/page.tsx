"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, FolderHeart, Check, ZoomIn, Plus, Grid3X3
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, ensureBase64 } from "@/lib/utils"
import { Asset } from "@/types"
import Image from "next/image"
import { PRESET_PRODUCTS } from "@/data/presets"
import { usePresetStore } from "@/stores/presetStore"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { useSettingsStore } from "@/stores/settingsStore"

type PageMode = "camera" | "review" | "processing" | "results"

// 专业棚拍生成6张图
const PRO_STUDIO_NUM_IMAGES = 6

// Asset Grid Component with Upload Button
function AssetGrid({ 
  items, 
  selectedId, 
  onSelect,
  onUpload,
  onZoom,
  emptyText = "暂无资源",
  uploadLabel = "Upload"
}: { 
  items: Asset[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  emptyText?: string
  uploadLabel?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Upload Button as first cell */}
      {onUpload && (
        <button
          onClick={onUpload}
          className="aspect-[3/4] rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50"
        >
          <Plus className="w-10 h-10 text-zinc-400" />
          <span className="text-sm text-zinc-500 mt-2">{uploadLabel || 'Upload'}</span>
        </button>
      )}
      {items.map(item => (
        <div
          key={item.id}
          className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
            selectedId === item.id 
              ? "border-blue-500 ring-2 ring-blue-500/30" 
              : "border-transparent hover:border-blue-300"
          }`}
        >
          <button
            onClick={() => onSelect(item.id)}
            className="absolute inset-0"
          >
            <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
          </button>
          {selectedId === item.id && (
            <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          {/* Zoom button */}
          {onZoom && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onZoom(item.imageUrl)
              }}
              className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-white" />
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
            <p className="text-xs text-white truncate text-center">{item.name}</p>
          </div>
        </div>
      ))}
      {items.length === 0 && !onUpload && (
        <div className="col-span-2 flex flex-col items-center justify-center py-12 text-zinc-400">
          <p className="text-sm">{emptyText}</p>
        </div>
      )}
    </div>
  )
}

// Background Grid with categories and Upload Button
function BackgroundGrid({
  selectedId,
  onSelect,
  onUpload,
  onZoom,
  uploadLabel = "Upload",
  labels,
  // 动态传入背景数据
  bgLight = [],
  bgSolid = [],
  bgPattern = [],
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  uploadLabel?: string
  labels?: { all: string; light: string; solid: string; pattern: string }
  bgLight?: Asset[]
  bgSolid?: Asset[]
  bgPattern?: Asset[]
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'light' | 'solid' | 'pattern'>('all')
  
  const allBgs = [...bgLight, ...bgSolid, ...bgPattern]
  
  const bgMap = {
    all: allBgs,
    light: bgLight,
    solid: bgSolid,
    pattern: bgPattern,
  }
  
  const tabs = [
    { id: 'all', label: labels?.all || 'All', count: allBgs.length },
    { id: 'light', label: labels?.light || 'Light', count: bgLight.length },
    { id: 'solid', label: labels?.solid || 'Solid', count: bgSolid.length },
    { id: 'pattern', label: labels?.pattern || 'Pattern', count: bgPattern.length },
  ]
  
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 border border-zinc-200"
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {/* Upload Button as first cell */}
        {onUpload && (
          <button
            onClick={onUpload}
            className="aspect-square rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50"
          >
            <Plus className="w-8 h-8 text-zinc-400" />
            <span className="text-xs text-zinc-500 mt-1">{uploadLabel || 'Upload'}</span>
          </button>
        )}
        {bgMap[activeTab].map(item => (
          <div
            key={item.id}
            className={`aspect-square rounded-xl overflow-hidden relative border-2 transition-all ${
              selectedId === item.id 
                ? "border-blue-500 ring-2 ring-blue-500/30" 
                : "border-transparent hover:border-blue-300"
            }`}
          >
            <button
              onClick={() => onSelect(item.id)}
              className="absolute inset-0"
            >
              <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
            </button>
            {selectedId === item.id && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            {/* Zoom button */}
            {onZoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onZoom(item.imageUrl)
                }}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProStudioPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, userModels, userBackgrounds } = useAssetStore()
  const { debugMode } = useSettingsStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  
  // Selection state
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  
  // Custom uploaded assets (临时存储在本地)
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customBgs, setCustomBgs] = useState<Asset[]>([])
  
  // Panel state
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'bg'>('model')
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModes, setGeneratedModes] = useState<string[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Preset Store - 动态从云端加载
  const { 
    studioModels, 
    studioBackgroundsLight,
    studioBackgroundsSolid,
    studioBackgroundsPattern,
    isLoaded: presetsLoaded,
    isLoading: presetsLoading,
    loadPresets,
    getRandomStudioModel,
  } = usePresetStore()
  
  // 组件加载时获取预设
  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Combine preset + user + custom assets for selection
  const allStudioBackgrounds = [...studioBackgroundsLight, ...studioBackgroundsSolid, ...studioBackgroundsPattern]
  const allModels = [...customModels, ...userModels, ...studioModels]
  const allBgs = [...customBgs, ...userBackgrounds, ...allStudioBackgrounds]
  
  // Get selected assets from combined list
  const selectedModel = selectedModelId ? allModels.find(m => m.id === selectedModelId) : null
  const selectedBg = selectedBgId ? allBgs.find(b => b.id === selectedBgId) : null
  
  // Handle model upload
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-model-${Date.now()}`,
        type: 'model',
        name: `自定义模特`,
        imageUrl: base64,
      }
      setCustomModels(prev => [newModel, ...prev])
      setSelectedModelId(newModel.id)
    }
    e.target.value = ''
  }
  
  // Handle background upload
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newBg: Asset = {
        id: `custom-bg-${Date.now()}`,
        type: 'background',
        name: `自定义背景`,
        imageUrl: base64,
      }
      setCustomBgs(prev => [newBg, ...prev])
      setSelectedBgId(newBg.id)
    }
    e.target.value = ''
  }

  // Camera permission check
  useEffect(() => {
    const checkCameraPermission = async () => {
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
          }
        }
      } catch (e) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(track => track.stop())
          setCameraReady(true)
          localStorage.setItem('cameraPermissionGranted', 'true')
        } catch {
          setHasCamera(false)
        }
      }
      setPermissionChecked(true)
    }
    checkCameraPermission()
  }, [])

  // 拍照
  const handleCapture = () => {
    if (webcamRef.current) {
      // 获取视频的实际分辨率，保持正确的宽高比
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setMode("review")
      }
    }
  }

  // 上传图片
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setMode("review")
    }
  }

  // 重拍
  const handleRetake = () => {
    setCapturedImage(null)
    setSelectedModelId(null)
    setSelectedBgId(null)
    setGeneratedImages([])
    setGeneratedModes([])
    setSelectedResultIndex(null)
    setMode("camera")
  }

  // 开始生成
  const handleShootIt = async () => {
    if (!capturedImage) return

    const hasQuota = await checkQuota(PRO_STUDIO_NUM_IMAGES)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('pro_studio', capturedImage, {}, PRO_STUDIO_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, PRO_STUDIO_NUM_IMAGES)

    // 压缩商品图
    const compressedProduct = await compressBase64Image(capturedImage, 1024)

    // ========== 预先确定每个模式使用的模特和背景 ==========
    // 如果用户选择了，使用用户选择的；否则随机选择一个，同模式的2张图共用
    
    // 用户选择的模特（如果有）
    const userSelectedModelBase64 = selectedModel 
      ? await ensureBase64(selectedModel.imageUrl) 
      : null
    
    // 用户选择的背景（如果有）
    const userSelectedBgBase64 = selectedBg 
      ? await ensureBase64(selectedBg.imageUrl) 
      : null

    // 辅助函数：带重试的随机模特加载（每次重试换一个不同的模特）
    const loadRandomModelWithRetry = async (maxRetries = 3): Promise<string | null> => {
      for (let i = 0; i < maxRetries; i++) {
        const randomModel = getRandomStudioModel()
        if (!randomModel) {
          console.error(`[ProStudio] No studio models available`)
          return null
        }
        console.log(`[ProStudio] Trying random model ${i + 1}/${maxRetries}:`, randomModel.imageUrl)
        const base64 = await ensureBase64(randomModel.imageUrl)
        if (base64) {
          console.log(`[ProStudio] Successfully loaded random model on attempt ${i + 1}`)
          return base64
        }
        console.warn(`[ProStudio] Failed to load random model on attempt ${i + 1}, trying another...`)
      }
      console.error(`[ProStudio] All ${maxRetries} attempts to load random model failed`)
      return null
    }

    // 简单模式：随机选择一个模特（3张图共用）
    const simpleModelBase64 = userSelectedModelBase64 || (!selectedModel ? await loadRandomModelWithRetry() : null)

    // 扩展模式：随机选择一个模特（3张图共用）
    const extendedModelBase64 = userSelectedModelBase64 || (!selectedModel ? await loadRandomModelWithRetry() : null)

    // 是否用户选择的标志
    const modelIsRandom = !selectedModel
    const bgIsRandom = !selectedBg
    
    // 辅助函数：检查 URL 是否是官方预设
    const isPresetUrl = (url?: string) => url?.includes('/presets/') || url?.includes('presets%2F')
    
    // 模特/背景名称和URL（用于保存到数据库）
    const modelName = selectedModel?.name || '专业模特 (随机)'
    const modelUrl = selectedModel?.imageUrl
    const modelIsPreset = isPresetUrl(modelUrl)
    
    const bgName = selectedBg?.name || '影棚背景'
    const bgUrl = selectedBg?.imageUrl
    const bgIsPreset = isPresetUrl(bgUrl)

    // 生成任务配置：简单模式3张 + 扩展模式3张
    // 背景：如果用户选择了就用，没选择就不传（AI生成背景）
    const taskConfigs = [
      { mode: 'simple', index: 0, model: simpleModelBase64, bg: userSelectedBgBase64 },
      { mode: 'simple', index: 1, model: simpleModelBase64, bg: userSelectedBgBase64 },
      { mode: 'simple', index: 2, model: simpleModelBase64, bg: userSelectedBgBase64 },
      { mode: 'extended', index: 3, model: extendedModelBase64, bg: userSelectedBgBase64 },
      { mode: 'extended', index: 4, model: extendedModelBase64, bg: userSelectedBgBase64 },
      { mode: 'extended', index: 5, model: extendedModelBase64, bg: userSelectedBgBase64 },
    ]

    const results: string[] = []
    const modes: string[] = []
    let firstCompleted = false

    // 并行生成所有图片
    const promises = taskConfigs.map(async (task) => {
      updateImageSlot(taskId, task.index, { status: 'generating' })

      try {
        const response = await fetch('/api/generate-pro-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: compressedProduct,
            modelImage: task.model,
            backgroundImage: task.bg,
            mode: task.mode,
            index: task.index,
            taskId,
            // 传递模特/背景信息用于数据库保存
            modelIsRandom,
            bgIsRandom,
            modelName,
            bgName,
            modelUrl,
            bgUrl,
            modelIsPreset,
            bgIsPreset,
          }),
        })

        const data = await response.json()

        if (data.success && data.image) {
          updateImageSlot(taskId, task.index, {
            status: 'completed',
            imageUrl: data.image,
            modelType: data.modelType,
            genMode: data.genMode,
          })

          results[task.index] = data.image
          modes[task.index] = task.mode

          // 第一张完成后切换到结果页面
          if (!firstCompleted) {
            firstCompleted = true
            setGeneratedImages([...results])
            setGeneratedModes([...modes])
            setMode("results")
          } else {
            setGeneratedImages([...results])
            setGeneratedModes([...modes])
          }
        } else {
          updateImageSlot(taskId, task.index, {
            status: 'failed',
            error: data.error || t.camera.generationFailed || '生成失败',
          })
        }
      } catch (error: any) {
        updateImageSlot(taskId, task.index, {
          status: 'failed',
          error: error.message || '网络错误',
        })
      }
    })

    await Promise.allSettled(promises)
    updateTaskStatus(taskId, 'completed')
  }

  // 获取模式标签
  const getModeLabel = (index: number) => {
    if (index < 3) return t.proStudio?.simpleMode || '简单'
    return t.proStudio?.extendedMode || '扩展'
  }

  const getModeColor = (index: number) => {
    if (index < 3) return 'bg-blue-500'
    return 'bg-purple-500'
  }

  // Download handler with iOS share support
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      
      // Check if iOS and navigator.share is available
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS && navigator.share && navigator.canShare) {
        const file = new File([blob], `pro-studio-${Date.now()}.jpg`, { type: 'image/jpeg' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] })
          return
        }
      }
      
      // Fallback to download link
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `pro-studio-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  return (
    <div className="h-full relative flex flex-col bg-black">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
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
        {/* Camera / Review Mode */}
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
                onClick={mode === "review" ? handleRetake : () => router.push("/")}
                className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className="flex-1 relative">
              {mode === "camera" && hasCamera && permissionChecked ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={{ facingMode: "environment" }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : mode === "camera" && !permissionChecked ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                    <p className="text-sm">正在初始化相机...</p>
                  </div>
                </div>
              ) : mode === "camera" && !hasCamera ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">{t.proStudio?.cameraUnavailable || '相机不可用'}</p>
                    <p className="text-xs mt-1">{t.proStudio?.pleaseUploadProduct || '请上传商品图片'}</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <img 
                    src={capturedImage || ""} 
                    alt="商品" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Selection Badges */}
              {mode === "review" && (
                <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                  {selectedModel && (
                    <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                      模特: {selectedModel.name}
                    </span>
                  )}
                  {selectedBg && (
                    <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                      背景: {selectedBg.name}
                    </span>
                  )}
                </div>
              )}

              {/* Camera Overlays */}
              {mode === "camera" && (
                <>
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                    </div>
                  </div>
                  <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                    {t.proStudio?.shootProduct || '拍摄商品进行专业棚拍'}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="bg-black flex flex-col justify-end pb-safe pt-6 px-6 relative z-20 shrink-0 min-h-[9rem]">
              {mode === "review" ? (
                <div className="space-y-4 pb-4">
                  {/* Custom button */}
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setShowCustomPanel(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.proStudio?.customizeModelBg || '自定义模特/背景'}</span>
                    </button>
                  </div>
                  
                  {/* Shoot It button */}
                  <div className="w-full flex justify-center">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => {
                        triggerFlyToGallery(e)
                        handleShootIt()
                      }}
                      className="w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-8 pb-4">
                  {/* Album */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">{t.proStudio?.album || '相册'}</span>
                  </button>

                  {/* Shutter */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
                  </button>

                  {/* Asset Library */}
                  <button 
                    onClick={() => setShowProductPanel(true)}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <FolderHeart className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">{t.proStudio?.assetLibrary || '资源库'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom Panel */}
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
                    className="absolute bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold text-lg">{t.proStudio?.customConfig || '自定义配置'}</span>
                      <button 
                        onClick={() => setShowCustomPanel(false)} 
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                      >
                        {t.proStudio?.nextStep || '下一步'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                      {[
                        { id: "model", label: t.proStudio?.proModel || "专业模特" },
                        { id: "bg", label: t.proStudio?.studioBg || "棚拍背景" }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setActiveCustomTab(tab.id as any)}
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
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-600">{t.proStudio?.selectModel || '选择模特（不选则随机）'}</span>
                            {selectedModelId && (
                              <button 
                                onClick={() => setSelectedModelId(null)}
                                className="text-xs text-blue-600"
                              >
                                {t.proStudio?.clearSelection || '清除选择'}
                              </button>
                            )}
                          </div>
                          <AssetGrid 
                            items={[...customModels, ...userModels, ...studioModels]} 
                            selectedId={selectedModelId} 
                            onSelect={(id) => setSelectedModelId(selectedModelId === id ? null : id)}
                            onUpload={() => modelUploadRef.current?.click()}
                            onZoom={(url) => setFullscreenImage(url)}
                            uploadLabel={t.common.upload}
                          />
                        </div>
                      )}
                      {activeCustomTab === "bg" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-600">{t.proStudio?.selectBg || '选择背景（不选则随机）'}</span>
                            {selectedBgId && (
                              <button 
                                onClick={() => setSelectedBgId(null)}
                                className="text-xs text-blue-600"
                              >
                                {t.proStudio?.clearSelection || '清除选择'}
                              </button>
                            )}
                          </div>
                          <BackgroundGrid 
                            selectedId={selectedBgId} 
                            onSelect={(id) => setSelectedBgId(selectedBgId === id ? null : id)}
                            onUpload={() => bgUploadRef.current?.click()}
                            onZoom={(url) => setFullscreenImage(url)}
                            uploadLabel={t.common.upload}
                            labels={{ 
                              all: t.common.all, 
                              light: t.proStudio?.bgLight || 'Light', 
                              solid: t.proStudio?.bgSolid || 'Solid', 
                              pattern: t.proStudio?.bgPattern || 'Pattern' 
                            }}
                            bgLight={studioBackgroundsLight}
                            bgSolid={studioBackgroundsSolid}
                            bgPattern={studioBackgroundsPattern}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Product Panel */}
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
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">选择商品</span>
                      <button 
                        onClick={() => setShowProductPanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="px-4 py-2 border-b bg-white dark:bg-zinc-900">
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                          onClick={() => setProductSourceTab("preset")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "preset"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          官方示例
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
                          我的商品
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
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
                            <button
                              key={product.id}
                              disabled={isLoadingAssets}
                              onClick={async () => {
                                setIsLoadingAssets(true)
                                try {
                                  const base64 = await ensureBase64(product.imageUrl)
                                  if (base64) {
                                    setCapturedImage(base64)
                                    setMode("review")
                                    setShowProductPanel(false)
                                  }
                                } catch (e) {
                                  console.error("Failed to load preset product:", e)
                                } finally {
                                  setIsLoadingAssets(false)
                                }
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                官方
                              </span>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : userProducts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 pb-20">
                          {userProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                setCapturedImage(product.imageUrl)
                                setMode("review")
                                setShowProductPanel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                          <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                          <p className="text-sm">{t.proStudio?.noMyProducts || '暂无我的商品'}</p>
                          <p className="text-xs mt-1">{t.proStudio?.uploadInAssets || '请先在资源库上传商品'}</p>
                          <button 
                            onClick={() => {
                              setShowProductPanel(false)
                              router.push("/brand-assets")
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            {t.proStudio?.goUpload || '去上传'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Processing Mode */}
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
            
            <h3 className="text-white text-2xl font-bold mb-2">{t.proStudio?.creating || 'AI 正在创作...'}</h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              <p>{t.proStudio?.analyzeProduct || '分析商品特征'}</p>
              {selectedModel && <p>{t.proStudio?.matchingModel || '匹配模特'} {selectedModel.name} ...</p>}
              {selectedBg && <p>{t.proStudio?.renderingBg || '渲染棚拍背景...'}</p>}
              <p>{t.proStudio?.generatingProPhoto || '生成专业棚拍图...'}</p>
            </div>
            
            {/* Action buttons */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-500 text-xs mb-4">{t.camera.continueInBackground}</p>
              <button
                onClick={handleRetake}
                className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t.camera.shootNew}
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                {t.camera.returnHome}
              </button>
            </div>
            
            <BottomNav forceShow />
          </motion.div>
        )}

        {/* Results Mode */}
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
              <span className="font-semibold ml-2">{t.camera.results}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-8">
              {/* 简单模式 - indices 0, 1, 2 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-500 rounded-full" />
                    {t.proStudio?.simpleMode || '简单模式'}
                  </h3>
                  <span className="text-[10px] text-zinc-400">{t.proStudio?.simpleDesc || '直接生成棚拍图'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => {
                    const currentTask = tasks.find(t => t.id === currentTaskId)
                    const slot = currentTask?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'failed')
                    const modelType = slot?.modelType
                    
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                          <span className="text-[10px] text-zinc-400">{t.gallery.generating}</span>
                        </div>
                      )
                    }
                    
                    if (status === 'failed' || !url) {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                          {slot?.error || t.camera.generationFailed}
                        </div>
                      )
                    }
                    
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(i)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm">
                          <Heart className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500 text-white">
                            {t.proStudio?.simpleMode || '简单'}
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

              {/* 扩展模式 - indices 3, 4, 5 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-purple-600 rounded-full" />
                    {t.proStudio?.extendedMode || '扩展模式'}
                  </h3>
                  <span className="text-[10px] text-zinc-400">{t.proStudio?.aiDesignScene || 'AI设计场景'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 4, 5].map((i) => {
                    const currentTask = tasks.find(t => t.id === currentTaskId)
                    const slot = currentTask?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'failed')
                    const modelType = slot?.modelType
                    
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                          <span className="text-[10px] text-zinc-400">{t.gallery.generating}</span>
                        </div>
                      )
                    }
                    
                    if (status === 'failed' || !url) {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                          {slot?.error || t.camera.generationFailed}
                        </div>
                      )
                    }
                    
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(i)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm">
                          <Heart className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500 text-white">
                            {t.proStudio?.extendedMode || '扩展'}
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
                {t.proStudio?.shootNextSet || t.camera.shootNextSet}
              </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && (() => {
              const currentTask = tasks.find(t => t.id === currentTaskId)
              const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
              const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
              const selectedModelType = selectedSlot?.modelType
              
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
                      <span className="font-semibold text-zinc-900">详情</span>
                      <div className="w-10" />
                    </div>

                    <div className="flex-1 overflow-y-auto bg-zinc-100 pb-24">
                      <div className="bg-zinc-900">
                        <div 
                          className="relative aspect-square max-h-[50vh] mx-auto cursor-pointer group"
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
                        <p className="text-center text-zinc-500 text-xs py-2">长按图片保存</p>
                      </div>
                      
                      <div className="p-4 pb-8 bg-white">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getModeColor(selectedResultIndex)} text-white`}>
                              {getModeLabel(selectedResultIndex)}
                            </span>
                            {selectedModelType === 'flash' && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                Gemini 2.5
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors">
                              <Heart className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => selectedImageUrl && handleDownload(selectedImageUrl)}
                              className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Action buttons - 去修图 & 拍组图 */}
                        <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => {
                              if (selectedImageUrl) {
                                sessionStorage.setItem('editImage', selectedImageUrl)
                                setSelectedResultIndex(null)
                                router.push("/edit/general")
                              }
                            }}
                            className="flex-1 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                          >
                            <Wand2 className="w-4 h-4" />
                            去修图
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              if (selectedImageUrl) {
                                sessionStorage.setItem('groupShootImage', selectedImageUrl)
                                setSelectedResultIndex(null)
                                router.push("/camera/group")
                              }
                            }}
                            className="flex-1 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                          >
                            <Grid3X3 className="w-4 h-4" />
                            拍组图
                          </button>
                        </div>
                        
                        {/* Debug Parameters - 只在调试模式显示 */}
                        {debugMode && (
                          <div className="mt-4 pt-4 border-t border-zinc-100">
                            <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                            <div className="grid grid-cols-3 gap-2">
                              {/* 商品图 */}
                              {capturedImage && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(capturedImage)}
                                  >
                                    <img 
                                      src={capturedImage} 
                                      alt="商品" 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">商品</p>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                    输入图
                                  </span>
                                </div>
                              )}
                              
                              {/* 模特图 */}
                              {selectedModel && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(selectedModel.imageUrl)}
                                  >
                                    <img 
                                      src={selectedModel.imageUrl} 
                                      alt="模特" 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedModel.name}</p>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-blue-100 text-blue-600">
                                    用户选择
                                  </span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-purple-100 text-purple-600 mt-0.5">
                                    {(selectedModel as any).category === 'studio' ? '高级模特' : '普通模特'}
                                  </span>
                                </div>
                              )}
                              {!selectedModel && (
                                <div className="flex flex-col items-center">
                                  <div className="w-14 h-14 rounded-lg bg-zinc-100 flex items-center justify-center">
                                    <span className="text-xs text-zinc-400">随机</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">模特</p>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-600">
                                    随机
                                  </span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-purple-100 text-purple-600 mt-0.5">
                                    高级模特
                                  </span>
                                </div>
                              )}
                              
                              {/* 背景图 */}
                              {selectedBg && (
                                <div className="flex flex-col items-center">
                                  <div 
                                    className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                                    onClick={() => setFullscreenImage(selectedBg.imageUrl)}
                                  >
                                    <img 
                                      src={selectedBg.imageUrl} 
                                      alt="背景" 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedBg.name}</p>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-blue-100 text-blue-600">
                                    用户选择
                                  </span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-green-100 text-green-600 mt-0.5">
                                    {(selectedBg as any).category === 'studio-light' ? '打光背景' : 
                                     (selectedBg as any).category === 'studio-solid' ? '纯色背景' : 
                                     (selectedBg as any).category === 'studio-pattern' ? '花色背景' : '影棚背景'}
                                  </span>
                                </div>
                              )}
                              {!selectedBg && (
                                <div className="flex flex-col items-center">
                                  <div className="w-14 h-14 rounded-lg bg-zinc-100 flex items-center justify-center">
                                    <span className="text-xs text-zinc-400">随机</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1">背景</p>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-600">
                                    随机
                                  </span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-green-100 text-green-600 mt-0.5">
                                    影棚背景
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* 生成模式信息 */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="text-[10px] px-2 py-1 rounded bg-zinc-100 text-zinc-600">
                                模式: 专业棚拍
                              </span>
                              <span className="text-[10px] px-2 py-1 rounded bg-zinc-100 text-zinc-600">
                                生成: 6张 (背景库2 + AI背景2 + 扩展2)
                              </span>
                            </div>
                          </div>
                        )}
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

      {/* Fullscreen Image */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
        usedCount={quota?.usedCount || 0}
        totalQuota={quota?.totalQuota || 0}
      />
    </div>
  )
}
