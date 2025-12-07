"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, FolderHeart, Check, ZoomIn, Plus, Grid3X3
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, ensureBase64 } from "@/lib/utils"
import { ensureImageUrl } from "@/lib/supabase/storage"
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

function ProStudioPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, userModels, userBackgrounds } = useAssetStore()
  const { debugMode } = useSettingsStore()
  
  // 未登录时重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])
  
  // 从 URL 参数读取 mode（从 outfit 页面跳转过来时）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as PageMode)
      // 从 sessionStorage 恢复 taskId
      const savedTaskId = sessionStorage.getItem('proStudioTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
      }
    }
  }, [searchParams])
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null) // 第二张商品图片上传
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedImage2, setCapturedImage2] = useState<string | null>(null) // 第二张商品图片
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
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("all")
  const [zoomProductImage, setZoomProductImage] = useState<string | null>(null)
  const [showProduct2Panel, setShowProduct2Panel] = useState(false) // 第二件商品选择面板
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'bg'>('model')
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  const [product2SourceTab, setProduct2SourceTab] = useState<'album' | 'asset'>('album') // 第二件商品来源
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false) // 分析商品类型中
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModes, setGeneratedModes] = useState<string[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [isAnalyzingProducts, setIsAnalyzingProducts] = useState(false) // 分析商品中
  
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
  
  // 监听任务完成，自动切换到 results 模式（从 outfit 页面跳转过来时）
  useEffect(() => {
    if (mode !== 'processing' || !currentTaskId) return
    
    const currentTask = tasks.find(t => t.id === currentTaskId)
    if (!currentTask?.imageSlots) return
    
    // 检查是否有任何一张图片完成
    const hasAnyCompleted = currentTask.imageSlots.some(s => s.status === 'completed')
    
    if (hasAnyCompleted) {
      console.log('[ProStudio] Task has completed images, switching to results mode')
      // 更新 generatedImages 从 imageSlots
      const images = currentTask.imageSlots.map(s => s.imageUrl || '')
      const modes = currentTask.imageSlots.map((s, i) => s.genMode || (i < 3 ? 'simple' : 'extended'))
      setGeneratedImages(images)
      setGeneratedModes(modes as ('simple' | 'extended')[])
      setMode('results')
    }
  }, [mode, currentTaskId, tasks])

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
      if (!capturedImage) {
        setCapturedImage(base64)
        setMode("review")
      } else {
        // 第二张商品图片
        setCapturedImage2(base64)
        // 不立即分析，等用户点击"下一步"时再分析
      }
    }
  }
  
  // 上传第二张商品图片
  const handleFileUpload2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage2(base64)
      // 不立即分析，等用户点击"下一步"时再分析
    }
  }
  
  // 分析商品类型（用于搭配页面）
  const analyzeProductForOutfit = async (imageBase64: string): Promise<{ type: string } | null> => {
    try {
      const response = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })
      const result = await response.json()
      if (result.success) {
        return { type: result.data.type }
      }
      return null
    } catch (error) {
      console.error('Failed to analyze product:', error)
      return null
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

    // 如果有第二张商品，跳转到搭配页面
    if (capturedImage2) {
      // 上传图片到 Storage，避免 sessionStorage 存大量 base64
      if (user?.id) {
        const [url1, url2] = await Promise.all([
          ensureImageUrl(capturedImage, user.id, 'product'),
          ensureImageUrl(capturedImage2, user.id, 'product')
        ])
        sessionStorage.setItem('product1Image', url1)
        sessionStorage.setItem('product2Image', url2)
      } else {
        sessionStorage.setItem('product1Image', capturedImage)
        sessionStorage.setItem('product2Image', capturedImage2)
      }
      router.push('/pro-studio/outfit')
      return
    }

    const hasQuota = await checkQuota(PRO_STUDIO_NUM_IMAGES)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('pro_studio', capturedImage, {}, PRO_STUDIO_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, PRO_STUDIO_NUM_IMAGES)

    // 不压缩，直接使用原图
    const compressedProduct = capturedImage

    // ========== 预先确定每个模式使用的模特和背景 ==========
    // 直接使用 URL，后端会转换为 base64（减少前端请求体大小）
    
    // 用户选择的模特 URL（如果有）
    const userSelectedModelUrl = selectedModel?.imageUrl || null
    
    // 用户选择的背景 URL（如果有）
    const userSelectedBgUrl = selectedBg?.imageUrl || null

    // 获取随机模特 URL
    const getRandomModelUrl = (): string | null => {
      const randomModel = getRandomStudioModel()
      if (!randomModel) {
        console.error(`[ProStudio] No studio models available`)
        return null
      }
      console.log(`[ProStudio] Random model:`, randomModel.name)
      return randomModel.imageUrl
    }

    // 简单模式：随机选择一个模特 URL（3张图共用）
    const simpleModelUrl = userSelectedModelUrl || (!selectedModel ? getRandomModelUrl() : null)

    // 扩展模式：随机选择一个模特 URL（3张图共用）
    const extendedModelUrl = userSelectedModelUrl || (!selectedModel ? getRandomModelUrl() : null)

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
    // 直接使用 URL，后端会转换为 base64
    const taskConfigs = [
      { mode: 'simple', index: 0, model: simpleModelUrl, bg: userSelectedBgUrl },
      { mode: 'simple', index: 1, model: simpleModelUrl, bg: userSelectedBgUrl },
      { mode: 'simple', index: 2, model: simpleModelUrl, bg: userSelectedBgUrl },
      { mode: 'extended', index: 3, model: extendedModelUrl, bg: userSelectedBgUrl },
      { mode: 'extended', index: 4, model: extendedModelUrl, bg: userSelectedBgUrl },
      { mode: 'extended', index: 5, model: extendedModelUrl, bg: userSelectedBgUrl },
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
        ref={fileInputRef2} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload2}
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
                  videoConstraints={{
                    facingMode: "environment",
                    width: { min: 1080, ideal: 1920 },
                    height: { min: 1080, ideal: 1920 }
                  }}
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
                  {/* 第一张商品图片 - 全屏显示 */}
                  <img 
                    src={capturedImage || ""} 
                    alt="商品" 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* 如果有第二张商品，右下角显示缩略图 */}
                  {capturedImage2 && (
                    <div className="absolute bottom-4 right-4 w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-lg">
                      <img 
                        src={capturedImage2} 
                        alt="商品2" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <span className="text-white text-xs font-medium">+1</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 右下角搭配商品按钮 - 只在review模式且没有第二张商品时显示 */}
                  {mode === "review" && !capturedImage2 && (
                    <button
                      disabled={isAnalyzingProduct}
                      onClick={async () => {
                        if (!capturedImage) return
                        
                        setIsAnalyzingProduct(true)
                        
                        try {
                          // 并行执行：分析商品 + 上传图片到 Storage
                          const [analysisResult, uploadedUrl] = await Promise.all([
                            // 分析商品类型
                            fetch('/api/analyze-product', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ image: capturedImage })
                            }).then(res => res.json()).catch(() => ({ success: false })),
                            // 上传图片到 Storage（避免 sessionStorage 存大量 base64）
                            user?.id 
                              ? ensureImageUrl(capturedImage, user.id, 'product')
                              : Promise.resolve(capturedImage) // 未登录则保留 base64
                          ])
                          
                          // 保存图片 URL 到 sessionStorage
                          sessionStorage.setItem('product1Image', uploadedUrl)
                          sessionStorage.removeItem('product2Image')
                          sessionStorage.removeItem('product2Type')
                          
                          if (analysisResult.success && analysisResult.data?.type) {
                            sessionStorage.setItem('product1Type', analysisResult.data.type)
                            console.log('[ProStudio] Product analyzed:', analysisResult.data.type)
                          } else {
                            sessionStorage.removeItem('product1Type')
                            console.warn('[ProStudio] Product analysis failed, proceeding without type')
                          }
                        } catch (error) {
                          console.error('[ProStudio] Failed to analyze/upload product:', error)
                          // 出错也跳转，使用原图
                          sessionStorage.setItem('product1Image', capturedImage)
                          sessionStorage.removeItem('product1Type')
                        }
                        
                        // 分析完成后立即跳转，不更新状态（页面已离开，更新状态无意义且会延迟跳转）
                        router.push('/pro-studio/outfit')
                      }}
                      className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/70 transition-colors border border-white/20 disabled:opacity-50"
                    >
                      {isAnalyzingProduct ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">{t.outfit?.analyzing || '分析中...'}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">{t.proStudio?.styleOutfit || '搭配商品'}</span>
                        </>
                      )}
                    </button>
                  )}
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
                      onClick={async (e) => {
                        if (capturedImage2) {
                          // 有第二张商品，上传图片到 Storage 后跳转
                          if (user?.id) {
                            const [url1, url2] = await Promise.all([
                              ensureImageUrl(capturedImage!, user.id, 'product'),
                              ensureImageUrl(capturedImage2, user.id, 'product')
                            ])
                            sessionStorage.setItem('product1Image', url1)
                            sessionStorage.setItem('product2Image', url2)
                          } else {
                            sessionStorage.setItem('product1Image', capturedImage!)
                            sessionStorage.setItem('product2Image', capturedImage2)
                          }
                          // 清除旧的分析结果
                          sessionStorage.removeItem('product1Analysis')
                          sessionStorage.removeItem('product2Analysis')
                          // 跳转到搭配页面
                          router.push('/pro-studio/outfit')
                        } else {
                          triggerFlyToGallery(e)
                          handleShootIt()
                        }
                      }}
                      className="w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      {capturedImage2 ? '去搭配' : 'Shoot It'}
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
                    className="absolute bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">{t.proStudio?.selectProduct || '选择商品'}</span>
                      <button 
                        onClick={() => setShowProductPanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
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
                          {t.proStudio?.officialExample || '官方示例'}
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
                          {t.proStudio?.myProducts || '我的商品'}
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
                            <div 
                              key={product.id} 
                              className={`relative group cursor-pointer ${isLoadingAssets ? 'opacity-50 pointer-events-none' : ''}`}
                              style={{ touchAction: 'manipulation' }}
                              onClick={() => {
                                // 直接使用 URL，后端会转换为 base64
                                setCapturedImage(product.imageUrl)
                                setMode("review")
                                setShowProductPanel(false)
                              }}
                            >
                              <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 active:border-blue-600 transition-all w-full">
                                <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                                <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium pointer-events-none">
                                  官方
                                </span>
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
            
            {/* 第二件商品选择面板 */}
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
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
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
                          从相册上传
                        </button>
                        <button
                          onClick={() => setProduct2SourceTab("asset")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            product2SourceTab === "asset"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          从资产库选择
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
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">点击上传</span>
                          </button>
                          <p className="text-xs text-zinc-500 mt-4">支持 JPG、PNG 格式</p>
                        </div>
                      ) : userProducts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 pb-20">
                          {/* 官方示例商品 */}
                          {PRESET_PRODUCTS.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                // 直接使用 URL，后端会转换为 base64
                                setCapturedImage2(product.imageUrl)
                                setShowProduct2Panel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                官方
                              </span>
                            </button>
                          ))}
                          {/* 用户商品 */}
                          {userProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                setCapturedImage2(product.imageUrl)
                                setShowProduct2Panel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 pb-20">
                          {/* 只显示官方示例商品 */}
                          {PRESET_PRODUCTS.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                // 直接使用 URL，后端会转换为 base64
                                setCapturedImage2(product.imageUrl)
                                setShowProduct2Panel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                官方
                              </span>
                            </button>
                          ))}
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

export default function ProStudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <ProStudioPageContent />
    </Suspense>
  )
}
