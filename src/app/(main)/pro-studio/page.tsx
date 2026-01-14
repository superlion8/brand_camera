"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, FolderHeart, Check, ZoomIn, Plus, Grid3X3,
  Images, Sparkles
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, ensureBase64, saveProductToAssets } from "@/lib/utils"
import { ensureImageUrl } from "@/lib/supabase/storage"
import { Asset } from "@/types"
import Image from "next/image"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { ModelPickerPanel } from "@/components/shared/ModelPickerPanel"
import { ScenePickerPanel } from "@/components/shared/ScenePickerPanel"
import { AssetGrid } from "@/components/shared/AssetGrid"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { useImageDownload } from "@/hooks/useImageDownload"
import { navigateToEdit } from "@/lib/navigation"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { ResultsView } from "@/components/shared/ResultsView"
import { useFavorite } from "@/hooks/useFavorite"
import { usePresetStore } from "@/stores/presetStore"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { ReviewModeLayout } from "@/components/shared/ReviewModeLayout"
import { MobilePageHeader } from "@/components/shared/MobilePageHeader"
import { CameraBottomBar } from "@/components/shared/CameraBottomBar"
import { CameraOverlay } from "@/components/shared/CameraOverlay"
import { ProductPreviewArea } from "@/components/shared/ProductPreviewArea"

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

// 专业棚拍生成4张图（4种机位）
const PRO_STUDIO_NUM_IMAGES = 4

// 4 张图片的标签配置
const IMAGE_LABELS: { zh: string; en: string; color: string }[] = [
  { zh: '图片 1', en: 'Image 1', color: 'bg-blue-500' },
  { zh: '图片 2', en: 'Image 2', color: 'bg-purple-500' },
  { zh: '图片 3', en: 'Image 3', color: 'bg-amber-500' },
  { zh: '图片 4', en: 'Image 4', color: 'bg-green-500' },
]

// Background Grid with categories and Upload Button
function BackgroundGrid({
  selectedId,
  onSelect,
  onUpload,
  onZoom,
  uploadLabel = "Upload",
  backgrounds = [],
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  uploadLabel?: string
  backgrounds?: Asset[]
}) {
  return (
    <div className="space-y-3">
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
        {backgrounds.map(item => (
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
              <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" unoptimized />
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
  const language = useLanguageStore(state => state.language)
  const { checkQuota, quota } = useQuota()
  const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, userModels, userBackgrounds, addUserAsset } = useAssetStore()
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
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[ProStudio] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modes = gen.output_gen_modes || []
                if (images.length > 0) {
                  console.log('[ProStudio] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                  setGeneratedModes(modes)
                  setCurrentGenerationId(gen.id)
                } else {
                  // 没有图片，可能任务失败了，返回相机模式
                  console.log('[ProStudio] No images found in database, returning to camera')
                  setMode('camera')
                  sessionStorage.removeItem('proStudioTaskId')
                }
              } else {
                // 任务不存在，返回相机模式
                console.log('[ProStudio] Task not found in database, returning to camera')
                setMode('camera')
                sessionStorage.removeItem('proStudioTaskId')
              }
            })
            .catch(err => {
              console.error('[ProStudio] Failed to recover images:', err)
              setMode('camera')
              sessionStorage.removeItem('proStudioTaskId')
            })
        }
      }
    }
  }, [searchParams, tasks.length])
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null) // 第二张商品图片上传
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [additionalImages, setAdditionalImages] = useState<string[]>([]) // 额外商品图片（最多3张）
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  
  // Track if product images came from phone upload (not asset library)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [additionalFromPhone, setAdditionalFromPhone] = useState<boolean[]>([]) // 额外商品来源追踪
  
  // Selection state
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  
  // Custom uploaded assets (临时存储在本地)
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customBgs, setCustomBgs] = useState<Asset[]>([])
  
  // Panel state
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showScenePicker, setShowScenePicker] = useState(false)
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
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null) // 数据库 UUID，用于收藏
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModes, setGeneratedModes] = useState<string[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Favorite hook
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  const [isAnalyzingProducts, setIsAnalyzingProducts] = useState(false) // 分析商品中
  
  // Preset Store - 动态从云端加载
  const { 
    studioModels, 
    studioBackgrounds,
    isLoaded: presetsLoaded,
    isLoading: presetsLoading,
    loadPresets,
  } = usePresetStore()
  
  // 组件加载时获取预设
  useEffect(() => {
    loadPresets()
  }, [loadPresets])
  
  // 注意：不在组件卸载时中止 SSE 请求
  // 用户离开页面后，后端会继续生成并保存到数据库
  // 用户可以在历史记录中查看结果
  
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
      const modes = currentTask.imageSlots.map((s, i) => s.genMode || (i < 2 ? 'simple' : 'extended'))
      setGeneratedImages(images)
      setGeneratedModes(modes as ('simple' | 'extended')[])
      setMode('results')
    }
  }, [mode, currentTaskId, tasks])

  // Combine preset + user + custom assets for selection
  const allModels = [...customModels, ...userModels, ...studioModels]
  const allBgs = [...customBgs, ...userBackgrounds, ...studioBackgrounds]
  
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

  // Camera permission check - skip on PC Web
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
        setProductFromPhone(true) // Mark as captured from camera (phone)
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
        setProductFromPhone(true) // Mark as uploaded from phone
        setMode("review")
      } else if (additionalImages.length < 3) {
        // 额外商品图片
        setAdditionalImages(prev => [...prev, base64])
        setAdditionalFromPhone(prev => [...prev, true]) // Mark as uploaded from phone
      }
    }
  }
  
  // 上传额外商品图片
  const handleFileUpload2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && additionalImages.length < 3) {
      const base64 = await fileToBase64(file)
      setAdditionalImages(prev => [...prev, base64])
      setAdditionalFromPhone(prev => [...prev, true]) // Mark as uploaded from phone
      setShowProduct2Panel(false) // 关闭面板
    }
    e.target.value = '' // 重置 input 以便重复选择同一文件
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
    setAdditionalImages([])
    setProductFromPhone(false)
    setAdditionalFromPhone([])
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

    // Clear previous results first (for Regenerate to show skeleton)
    setGeneratedImages([])
    setGeneratedModes([])

    const hasQuota = await checkQuota(PRO_STUDIO_NUM_IMAGES)
    if (!hasQuota) return

    // Save phone-uploaded product images to asset library BEFORE generation
    // This ensures products are saved even if generation fails
    if (productFromPhone && capturedImage) {
      saveProductToAssets(capturedImage, addUserAsset, t.common?.product || '商品')
    }

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('pro_studio', capturedImage, {}, PRO_STUDIO_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, PRO_STUDIO_NUM_IMAGES)
    
    // 保存 taskId 到 sessionStorage（刷新后可恢复）
    sessionStorage.setItem('proStudioTaskId', taskId)
    router.replace('/pro-studio?mode=processing')
    
    // 初始化所有 slots 为 generating 状态
    for (let i = 0; i < PRO_STUDIO_NUM_IMAGES; i++) {
      updateImageSlot(taskId, i, { status: 'generating' })
    }

    // 预扣配额（使用统一 hook）
    const reserveResult = await reserveQuota({
          taskId,
          imageCount: PRO_STUDIO_NUM_IMAGES,
          taskType: 'pro_studio',
    })
    
    if (!reserveResult.success) {
      console.error('[ProStudio] Failed to reserve quota:', reserveResult.error)
      setMode('camera')
      router.replace('/pro-studio')
      return
    }

    // 用户选择的模特/背景 URL（如果有）
    const userSelectedModelUrl = selectedModel?.imageUrl || null
    const userSelectedBgUrl = selectedBg?.imageUrl || null

    try {
      // 压缩图片以减少请求体大小（Vercel 限制 4.5MB）
      console.log("[ProStudio] Compressing product images...")
      const compressedImage = await compressBase64Image(capturedImage, 1280)
      // Compress additional products if exist
      const compressedAdditional = await Promise.all(
        additionalImages.map(img => compressBase64Image(img, 1280))
      )
      console.log(`[ProStudio] Compressed main: ${(capturedImage.length / 1024).toFixed(0)}KB -> ${(compressedImage.length / 1024).toFixed(0)}KB`)
      if (compressedAdditional.length > 0) {
        console.log(`[ProStudio] Compressed ${compressedAdditional.length} additional products`)
      }

      // Build productImages array
      const productImages = [{ imageUrl: compressedImage }]
      compressedAdditional.forEach(img => {
        productImages.push({ imageUrl: img })
      })
      
      // 使用 SSE 调用新 API
      // 注意：不使用 AbortController，用户离开页面后后端继续生成
      const response = await fetch('/api/generate-pro-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: compressedImage,
          productImages: productImages.length > 1 ? productImages : undefined, // Only send if multiple products
          modelImage: userSelectedModelUrl || 'random',
          backgroundImage: userSelectedBgUrl || 'random',
          taskId,
        }),
      })

      if (!response.ok) {
        // 尝试解析错误响应，处理非 JSON 情况
        const text = await response.text()
        let errorMsg = '请求失败'
        try {
          const errorData = JSON.parse(text)
          errorMsg = errorData.error || errorMsg
        } catch {
          // 响应不是 JSON
          console.error('[ProStudio] Non-JSON error response:', text.substring(0, 100))
          if (response.status === 413) {
            errorMsg = '图片太大，请使用较小的图片'
          } else if (response.status >= 500) {
            errorMsg = '服务器繁忙，请稍后重试'
          }
        }
        throw new Error(errorMsg)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let firstImageReceived = false

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
              
              switch (data.type) {
                case 'progress':
                  console.log('[ProStudio] Progress:', data.message)
                  break
                  
                case 'analysis_complete':
                  console.log('[ProStudio] Analysis:', data.productStyle, data.modelId, data.sceneId)
                  break
                  
                case 'outfit_ready':
                  console.log('[ProStudio] Outfit ready:', data.outfit?.substring(0, 100))
                  break
                  
                case 'image':
                  // 图片生成完成
                  updateImageSlot(taskId, data.index, {
                    status: 'completed',
                    imageUrl: data.image,
                    modelType: 'pro',
                    genMode: 'simple',
                    dbId: data.dbId,  // 存储数据库 UUID
                  })
                  
                  // 更新 generatedImages 状态
                  // 创建固定长度数组，同时保留已有数据
                  setGeneratedImages(prev => {
                    // 创建完整长度数组，保留 prev 中已有的数据
                    const newImages = Array(PRO_STUDIO_NUM_IMAGES).fill('').map((_, i) => prev[i] || '')
                    newImages[data.index] = data.image
                    return newImages
                  })
                  setGeneratedModes(prev => {
                    // 创建完整长度数组，保留 prev 中已有的数据
                    const newModes = Array(PRO_STUDIO_NUM_IMAGES).fill('').map((_, i) => prev[i] || '')
                    newModes[data.index] = `image_${data.index + 1}`
                    return newModes
                  })
                  
                  // 第一张图片完成后切换到结果页面
                  if (!firstImageReceived) {
                    firstImageReceived = true
                    setMode("results")
                    // 设置 currentGenerationId 为数据库 UUID，用于收藏功能
                    // 如果没有 dbId（后端保存失败），使用 taskId 作为 fallback
                    const generationId = data.dbId || taskId
                    setCurrentGenerationId(generationId)
                    console.log(`[ProStudio] Set currentGenerationId to: ${generationId} (dbId: ${data.dbId})`)
                    // 检查是否仍在pro-studio页面，避免用户离开后强制跳转
                    if (window.location.pathname === '/pro-studio') {
                      router.replace('/pro-studio?mode=results')
                    }
                  }
                  break
                  
                case 'image_error':
                  updateImageSlot(taskId, data.index, {
                    status: 'failed',
                    error: data.error || '生成失败',
                  })
                  break
                  
                case 'error':
                  console.error('[ProStudio] Error:', data.error)
                  // 标记所有未完成的 slots 为失败
                  for (let i = 0; i < PRO_STUDIO_NUM_IMAGES; i++) {
                    const currentTask = tasks.find(t => t.id === taskId)
                    const slot = currentTask?.imageSlots?.[i]
                    if (slot?.status === 'generating' || slot?.status === 'pending') {
                      updateImageSlot(taskId, i, {
                        status: 'failed',
                        error: data.error || '生成失败',
                      })
                    }
                  }
                  break
                  
                case 'complete':
                  console.log('[ProStudio] Complete:', data.totalSuccess, 'images')
                  break
              }
            } catch (e) {
              console.warn('[ProStudio] Failed to parse SSE data:', line)
            }
          }
        }
      }

      // 统计成功数量并处理退款（使用统一 hook）
      const currentTask = tasks.find(t => t.id === taskId)
      const successCount = currentTask?.imageSlots?.filter(s => s.status === 'completed').length || 0

      if (successCount > 0 && successCount < PRO_STUDIO_NUM_IMAGES) {
        // 部分失败，退还差额
        await partialRefund(taskId, successCount)
      } else if (successCount === 0) {
        // 全部失败，全额退还
        await refundQuota(taskId)
      } else {
        // 全部成功，刷新配额显示
        await confirmQuota()
      }
      
      // 清理 sessionStorage
      sessionStorage.removeItem('proStudioTaskId')
    } catch (error: any) {
      console.error('[ProStudio] Error:', error)
      // 标记所有 slots 为失败
      for (let i = 0; i < PRO_STUDIO_NUM_IMAGES; i++) {
        updateImageSlot(taskId, i, {
          status: 'failed',
          error: error.message || '网络错误',
        })
      }

      // 异常情况，全额退还配额（使用统一 hook）
      await refundQuota(taskId)
      
      // 清理 sessionStorage
      sessionStorage.removeItem('proStudioTaskId')
    }

    updateTaskStatus(taskId, 'completed')
  }

  // 获取图片标签（根据当前语言）
  const getImageLabel = (index: number) => {
    const label = IMAGE_LABELS[index] || IMAGE_LABELS[0]
    return language === 'en' ? label.en : label.zh
  }

  const getImageColor = (index: number) => {
    const label = IMAGE_LABELS[index] || IMAGE_LABELS[0]
    return label.color
  }

  // Download handler with iOS share support
  const { downloadImage } = useImageDownload({ filenamePrefix: 'pro-studio' })
  const handleDownload = (url: string) => downloadImage(url)

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
        {/* Desktop Review Mode - Using shared ReviewModeLayout */}
        {mode === "review" && isDesktop && (
          <motion.div 
            key="desktop-review"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <ReviewModeLayout
              title={t.proStudio?.proStudioMode || 'Pro Studio Mode'}
              onBack={handleRetake}
              mainProductImage={capturedImage}
              onMainProductChange={handleRetake}
              onMainProductZoom={(url) => setFullscreenImage(url)}
              additionalProducts={additionalImages}
              maxAdditionalProducts={3}
              onAddProduct={() => setShowProduct2Panel(true)}
              onRemoveProduct={(index) => {
                setAdditionalImages(prev => prev.filter((_, i) => i !== index))
                setAdditionalFromPhone(prev => prev.filter((_, i) => i !== index))
              }}
              onDropProduct={(base64) => {
                if (additionalImages.length < 3) {
                  setAdditionalImages(prev => [...prev, base64])
                  setAdditionalFromPhone(prev => [...prev, false])
                }
              }}
              models={allModels}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              onModelUpload={() => modelUploadRef.current?.click()}
              onModelZoom={(url) => setFullscreenImage(url)}
              onViewMoreModels={() => setShowModelPicker(true)}
              onModelDrop={(base64) => {
                const newModel: Asset = {
                  id: `custom-model-${Date.now()}`,
                  type: 'model',
                  name: '自定义模特',
                  imageUrl: base64,
                }
                setCustomModels(prev => [newModel, ...prev])
                setSelectedModelId(newModel.id)
              }}
              backgrounds={allBgs}
              selectedBgId={selectedBgId}
              onSelectBg={setSelectedBgId}
              onBgUpload={() => bgUploadRef.current?.click()}
              onBgZoom={(url) => setFullscreenImage(url)}
              onViewMoreBgs={() => setShowScenePicker(true)}
              onBgDrop={(base64) => {
                const newBg: Asset = {
                  id: `custom-bg-${Date.now()}`,
                  type: 'background',
                  name: '自定义背景',
                  imageUrl: base64,
                }
                setCustomBgs(prev => [newBg, ...prev])
                setSelectedBgId(newBg.id)
              }}
              creditCost={4}
              onGenerate={() => {
                handleShootIt()
              }}
              t={t}
            />
          </motion.div>
        )}

        {/* Camera Mode (Desktop) / Camera & Review Mode (Mobile) */}
        {((mode === "camera" && isDesktop) || ((mode === "camera" || mode === "review") && !isDesktop)) && (
          <motion.div 
            key="camera-view"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 relative overflow-hidden flex flex-col"
          >
            {/* Top Return Button - Hide on desktop camera mode */}
            <MobilePageHeader
              show={!(mode === "camera" && isDesktop)}
              backAction={mode === "review" ? "close" : "home"}
              onBack={mode === "review" ? handleRetake : undefined}
              variant={isDesktop ? "light" : "dark"}
            />

            {/* Viewfinder / Captured Image */}
            <div className="flex-1 relative">
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
                        <h1 className="text-lg font-semibold text-zinc-900">{t.proStudio?.proStudioMode || '专业棚拍'}</h1>
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
                              src="https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage/features/pro-studio.jpg" 
                              alt="Pro Studio Mode" 
                              fill 
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-lg font-bold text-white">{t.proStudio?.proStudioMode || 'Pro Studio Mode'}</h3>
                              <p className="text-sm text-white/80 mt-1">{t.home?.proStudioSubtitle || '纯色背景质感'}</p>
                            </div>
                          </div>
                          
                          {/* Feature Tags */}
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.proStudio?.smartModelMatch || 'Smart Model Matching'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.proStudio?.proBgScene || 'Professional Background'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.proStudio?.highQualityOutput || 'High Quality Output'}
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
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                              const file = e.dataTransfer.files?.[0]
                              if (file && file.type.startsWith('image/')) {
                                const base64 = await fileToBase64(file)
                                setCapturedImage(base64)
                                setProductFromPhone(true)
                                setMode("review")
                              }
                            }}
                            className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-amber-400 hover:bg-amber-50/50 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer"
                          >
                            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-zinc-700">{t.proStudio?.uploadProduct || '上传商品图片'}</p>
                              <p className="text-xs text-zinc-400 mt-1">{t.proStudio?.clickToUploadOrDrag || 'Click to upload or drag & drop'}</p>
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
                  className="absolute inset-0 w-full h-full object-cover"
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
                    <p className="text-sm">{t.proStudio?.cameraUnavailable || '相机不可用'}</p>
                    <p className="text-xs mt-1">{t.proStudio?.pleaseUploadProduct || '请上传商品图片'}</p>
                  </div>
                </div>
              ) : (
                <ProductPreviewArea
                  mainImage={capturedImage}
                  additionalImages={mode === "review" ? additionalImages : []}
                  maxAdditionalImages={3}
                  onAddProduct={mode === "review" ? () => setShowProduct2Panel(true) : undefined}
                  onRemoveProduct={mode === "review" ? (index) => {
                    setAdditionalImages(prev => prev.filter((_, i) => i !== index))
                    setAdditionalFromPhone(prev => prev.filter((_, i) => i !== index))
                  } : undefined}
                  addLabel={t.proStudio?.add || 'Add'}
                  badges={mode === "review" ? [
                    ...(selectedModel?.name ? [{ label: '模特', value: selectedModel.name }] : []),
                    ...(selectedBg?.name ? [{ label: '背景', value: selectedBg.name }] : []),
                  ] : []}
                />
              )}

              {/* Camera Overlays - Mobile only */}
              <CameraOverlay
                show={mode === "camera" && !isDesktop}
                hint={t.proStudio?.shootProduct || '拍摄商品进行专业棚拍'}
              />
            </div>

            {/* Bottom Controls */}
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
                      <span className="text-sm font-medium">{t.proStudio?.customizeModelBg || '自定义模特/背景'}</span>
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
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                          : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                      }`}
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
                    </motion.button>
                  </div>
                </div>
              ) : isDesktop ? (
                /* Desktop: Hide bottom controls in camera mode - buttons are in the upload area */
                <div className="hidden" />
              ) : (
                <CameraBottomBar
                  onAlbumClick={() => fileInputRef.current?.click()}
                  onShutterClick={handleCapture}
                  onAssetClick={() => setShowProductPanel(true)}
                  shutterDisabled={!hasCamera}
                  albumLabel={t.proStudio?.album || '相册'}
                  assetLabel={t.proStudio?.assetLibrary || '资源库'}
                />
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
                            uploadIcon="plus"
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
                            backgrounds={studioBackgrounds}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* 商品选择面板 */}
            <AssetPickerPanel
              open={showProductPanel}
              onClose={() => setShowProductPanel(false)}
              onSelect={(imageUrl) => {
                setCapturedImage(imageUrl)
                                  setProductFromPhone(false)
                                  setMode("review")
              }}
              onUploadClick={() => fileInputRef.current?.click()}
              themeColor="amber"
              title={t.proStudio?.selectProduct || '选择商品'}
            />
          </motion.div>
        )}

        {/* Processing Mode */}
        {mode === "processing" && (
          <ProcessingView
            numImages={PRO_STUDIO_NUM_IMAGES}
            generatedImages={generatedImages}
            imageSlots={tasks.find(t => t.id === currentTaskId)?.imageSlots?.map(slot => ({
              url: slot.imageUrl,
              status: slot.status as 'generating' | 'completed' | 'failed'
            }))}
            themeColor="amber"
            title={t.proStudio?.creating || 'Creating studio photos'}
            mobileTitle={t.proStudio?.creating || 'Creating studio photos'}
            mobileStatusLines={[
              t.proStudio?.analyzeProduct || 'Analyzing product',
              ...(selectedModel ? [`${t.proStudio?.matchingModel || 'Matching model'} ${selectedModel.name} ...`] : []),
              ...(selectedBg ? [t.proStudio?.renderingBg || 'Rendering background...'] : []),
            ]}
            onShootMore={handleRetake}
            onReturnHome={() => router.push("/")}
            onDownload={(url) => handleDownload(url)}
          />
        )}

        {/* Results Mode */}
        {mode === "results" && (
          <ResultsView
            title={t.camera.results}
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
              text: getImageLabel(i),
              className: getImageColor(i),
            })}
            themeColor="amber"
            onFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onDownload={(url) => handleDownload(url)}
            onShootNext={handleRetake}
            onGoEdit={(url) => navigateToEdit(router, url)}
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
              badges={selectedResultIndex !== null ? [{
                text: getImageLabel(selectedResultIndex),
                className: `${getImageColor(selectedResultIndex)} text-white`
              }] : []}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={() => {
                if (selectedResultIndex === null) return
              const currentTask = tasks.find(t => t.id === currentTaskId)
              const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
              const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                if (selectedImageUrl) handleDownload(selectedImageUrl)
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
                  if (selectedImageUrl) {
                                setSelectedResultIndex(null)
                    navigateToEdit(router, selectedImageUrl)
                  }
                }),
                createQuickActions.groupShoot(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const selectedImageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                              if (selectedImageUrl) {
                                sessionStorage.setItem('groupShootImage', selectedImageUrl)
                                setSelectedResultIndex(null)
                                router.push("/group-shot")
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
              inputImages={capturedImage ? [{ url: capturedImage, label: t.common?.product || 'Product' }] : []}
              onInputImageClick={(url) => setFullscreenImage(url)}
            >
              {/* Debug content */}
              {debugMode && selectedResultIndex !== null && (
                          <div className="mt-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Debug Parameters</h3>
                            <div className="grid grid-cols-3 gap-2">
                    {selectedModel ? (
                                <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group" onClick={() => setFullscreenImage(selectedModel.imageUrl)}>
                          <img src={selectedModel.imageUrl} alt="Model" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedModel.name}</p>
                                </div>
                    ) : (
                                <div className="flex flex-col items-center">
                                  <div className="w-14 h-14 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs text-zinc-400">Random</span>
                                  </div>
                        <p className="text-[10px] text-zinc-500 mt-1">Model</p>
                                </div>
                              )}
                    {selectedBg ? (
                                <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group" onClick={() => setFullscreenImage(selectedBg.imageUrl)}>
                          <img src={selectedBg.imageUrl} alt="Background" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedBg.name}</p>
                                </div>
                    ) : (
                                <div className="flex flex-col items-center">
                                  <div className="w-14 h-14 rounded-lg bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs text-zinc-400">Random</span>
                                  </div>
                        <p className="text-[10px] text-zinc-500 mt-1">Background</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
            </PhotoDetailDialog>
          </ResultsView>
        )}
      </AnimatePresence>

      {/* Fullscreen Image - Using shared component */}
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
          if (additionalImages.length < 3) {
            setAdditionalImages(prev => [...prev, imageUrl])
            setAdditionalFromPhone(prev => [...prev, false])
          }
          setShowProduct2Panel(false)
        }}
        onUploadClick={() => fileInputRef2.current?.click()}
        themeColor="amber"
        title={t.proStudio?.styleOutfit || '添加商品'}
      />
      
      {/* Model Picker */}
      <ModelPickerPanel
        open={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        selectedId={selectedModelId}
        customModels={allModels}
        onSelect={(model) => setSelectedModelId(model.id)}
        onCustomUpload={(model) => {
          setCustomModels(prev => [model, ...prev])
        }}
        themeColor="amber"
        allowUpload
      />
      
      {/* Scene Picker */}
      <ScenePickerPanel
        open={showScenePicker}
        onClose={() => setShowScenePicker(false)}
        selectedId={selectedBgId}
        customScenes={allBgs}
        onSelect={(scene) => setSelectedBgId(scene.id)}
        sceneType="studio"
        themeColor="amber"
        allowUpload={false}
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
