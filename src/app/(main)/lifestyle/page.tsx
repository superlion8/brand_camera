"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Loader2, Image as ImageIcon, 
  X, Wand2, Camera, Home,
  Heart, Download, ZoomIn, Plus, Sparkles,
  FolderHeart, SlidersHorizontal, Check
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, saveProductToAssets, compressBase64Image } from "@/lib/utils"
import Image from "next/image"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { ModelPickerPanel } from "@/components/shared/ModelPickerPanel"
import { ScenePickerPanel } from "@/components/shared/ScenePickerPanel"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { AssetGrid } from "@/components/shared/AssetGrid"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { ResultsView } from "@/components/shared/ResultsView"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { useFavorite } from "@/hooks/useFavorite"
import { navigateToEdit } from "@/lib/navigation"
import { useImageDownload } from "@/hooks/useImageDownload"
import { Asset } from "@/types"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { usePresetStore } from "@/stores/presetStore"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { ReviewModeLayout } from "@/components/shared/ReviewModeLayout"
import { MobilePageHeader } from "@/components/shared/MobilePageHeader"
import { CameraBottomBar } from "@/components/shared/CameraBottomBar"
import { CameraOverlay } from "@/components/shared/CameraOverlay"
import { ProductPreviewArea } from "@/components/shared/ProductPreviewArea"

type PageMode = "camera" | "review" | "processing" | "results"

const LIFESTYLE_NUM_IMAGES = 4

function LifestylePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, quota } = useQuota()
  const { reserveQuota, confirmQuota } = useQuotaReservation()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, addUserAsset, addGeneration } = useAssetStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const sceneUploadRef = useRef<HTMLInputElement>(null)
  
  // Preset Store
  const { 
    lifestyleModels, 
    lifestyleScenes,
    loadPresets,
  } = usePresetStore()
  
  useEffect(() => {
    loadPresets()
  }, [loadPresets])
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [additionalImages, setAdditionalImages] = useState<string[]>([])
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [additionalFromPhone, setAdditionalFromPhone] = useState<boolean[]>([])
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [lifestyleStatus, setLifestyleStatus] = useState<string>('')
  
  // Custom model/scene selection
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customScenes, setCustomScenes] = useState<Asset[]>([])
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showScenePicker, setShowScenePicker] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'scene'>('model')
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<string[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<('simple' | 'extended')[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Favorite hook
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  
  // Combined assets
  const allModels = [...customModels, ...lifestyleModels]
  const allScenes = [...customScenes, ...lifestyleScenes]
  const selectedModel = selectedModelId ? allModels.find(m => m.id === selectedModelId) : null
  const selectedScene = selectedSceneId ? allScenes.find(s => s.id === selectedSceneId) : null

  // 从 URL 参数恢复模式和 taskId（刷新后恢复）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as PageMode)
      const savedTaskId = sessionStorage.getItem('lifestyleTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[Lifestyle] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                const modelTypes = gen.output_model_types || []
                const genModes = gen.output_gen_modes || []
                if (images.length > 0) {
                  console.log('[Lifestyle] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                  setGeneratedModelTypes(modelTypes)
                  setGeneratedGenModes(genModes)
                  setCurrentGenerationId(gen.id)
                } else {
                  console.log('[Lifestyle] No images found in database, returning to camera')
                  setMode('camera')
                  sessionStorage.removeItem('lifestyleTaskId')
                }
              } else {
                console.log('[Lifestyle] Task not found in database, returning to camera')
                setMode('camera')
                sessionStorage.removeItem('lifestyleTaskId')
              }
            })
            .catch(err => {
              console.error('[Lifestyle] Failed to recover images:', err)
              setMode('camera')
              sessionStorage.removeItem('lifestyleTaskId')
            })
        }
      }
    }
  }, [searchParams, tasks.length])

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

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

  const handleCapture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setProductFromPhone(true)
        setMode("review")
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setProductFromPhone(true)
      setMode("review")
    }
  }

  const handleFileUpload2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && additionalImages.length < 3) {
      const base64 = await fileToBase64(file)
      setAdditionalImages(prev => [...prev, base64])
      setAdditionalFromPhone(prev => [...prev, true])
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setAdditionalImages([])
    setProductFromPhone(false)
    setAdditionalFromPhone([])
    setSelectedModelId(null)
    setSelectedSceneId(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setSelectedResultIndex(null)
    setMode("camera")
  }
  
  // Handle model upload
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-lifestyle-model-${Date.now()}`,
        type: 'model',
        name: t.lifestyle?.streetModel || '街拍模特',
        imageUrl: base64,
      }
      setCustomModels(prev => [newModel, ...prev])
      setSelectedModelId(newModel.id)
    }
    e.target.value = ''
  }
  
  // Handle scene upload
  const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newScene: Asset = {
        id: `custom-lifestyle-scene-${Date.now()}`,
        type: 'background',
        name: t.lifestyle?.streetScene || '街拍场景',
        imageUrl: base64,
      }
      setCustomScenes(prev => [newScene, ...prev])
      setSelectedSceneId(newScene.id)
    }
    e.target.value = ''
  }

  const handleLifestyleGenerate = async () => {
    if (!capturedImage) return

    // Clear previous results first (for Regenerate to show skeleton)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    
    const hasQuota = await checkQuota(LIFESTYLE_NUM_IMAGES)
    if (!hasQuota) return
    
    if (productFromPhone && capturedImage) {
      saveProductToAssets(capturedImage, addUserAsset, t.common.product)
    }
    
    // Get user selected model/scene URLs
    const userModelUrl = selectedModel?.imageUrl || null
    const userSceneUrl = selectedScene?.imageUrl || null
    
    const params = {
      type: 'lifestyle',
      modelId: selectedModelId,
      sceneId: selectedSceneId,
    }
    
    const taskId = addTask('lifestyle', capturedImage, params, LIFESTYLE_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, LIFESTYLE_NUM_IMAGES)
    
    // 保存 taskId 到 sessionStorage（刷新后可恢复）
    sessionStorage.setItem('lifestyleTaskId', taskId)
    router.replace('/lifestyle?mode=processing')
    
    triggerFlyToGallery()
    setMode("processing")
    
    // 预扣配额（使用统一 hook）
    await reserveQuota({ taskId, imageCount: LIFESTYLE_NUM_IMAGES, taskType: 'lifestyle' })
    
    // 压缩图片以减少请求体大小
    console.log("[Lifestyle] Compressing product image...")
    const compressedImage = await compressBase64Image(capturedImage, 1280)
    console.log(`[Lifestyle] Compressed: ${(capturedImage.length / 1024).toFixed(0)}KB -> ${(compressedImage.length / 1024).toFixed(0)}KB`)
    
    await runLifestyleGeneration(taskId, compressedImage, userModelUrl, userSceneUrl)
  }

  const runLifestyleGeneration = async (
    taskId: string, 
    productImage: string,
    userModelUrl?: string | null,
    userSceneUrl?: string | null
  ) => {
    let firstDbId: string | null = null
    let firstImageReceived = false
    
    try {
      setLifestyleStatus(t.common?.loading || '正在连接服务器...')
      
      // Build product images array if there are additional products
      const productImagesArray = additionalImages.length > 0
        ? [productImage, ...additionalImages]
        : undefined
      
      const response = await fetch('/api/generate-lifestyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
          productImages: productImagesArray,  // Pass array if multiple products
          taskId,
          modelImage: userModelUrl || 'auto',
          sceneImage: userSceneUrl || 'auto',
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          
          try {
            const event = JSON.parse(jsonStr)
            
            switch (event.type) {
              case 'status':
                setLifestyleStatus(event.message)
                break
              case 'analysis_complete':
                setLifestyleStatus(t.lifestyle?.matchingModel || '分析完成，正在匹配...')
                break
              case 'materials_ready':
                setLifestyleStatus(t.lifestyle?.generatingPhoto || '素材准备完成，开始生成...')
                break
              case 'progress':
                setLifestyleStatus(`${t.common?.generating || '正在生成'} ${event.index + 1}/${LIFESTYLE_NUM_IMAGES}...`)
                break
              case 'image':
                updateImageSlot(taskId, event.index, {
                  imageUrl: event.image,
                  status: 'completed',
                  modelType: event.modelType,
                  genMode: 'simple',
                  dbId: event.dbId,
                })
                
                if (event.dbId && !firstDbId) {
                  firstDbId = event.dbId
                  setCurrentGenerationId(event.dbId)
                }
                
                setGeneratedImages(prev => {
                  const newImages = [...prev]
                  newImages[event.index] = event.image
                  return newImages
                })
                setGeneratedModelTypes(prev => {
                  const newTypes = [...prev]
                  newTypes[event.index] = event.modelType
                  return newTypes
                })
                setGeneratedGenModes(prev => {
                  const newModes = [...prev]
                  newModes[event.index] = 'simple'
                  return newModes
                })
                
                // Switch to results mode on first image (like buyer-show)
                if (!firstImageReceived && mode === 'processing') {
                  firstImageReceived = true
                  console.log('[Lifestyle] First image ready, switching to results mode')
                  setMode('results')
                  router.replace('/lifestyle?mode=results')
                }
                break
              case 'image_error':
                updateImageSlot(taskId, event.index, {
                  status: 'failed',
                  error: event.error,
                })
                break
              case 'error':
                setLifestyleStatus(`错误: ${event.error}`)
                updateTaskStatus(taskId, 'failed')
                break
              case 'complete':
                setLifestyleStatus('')
                updateTaskStatus(taskId, 'completed')
                if (!firstDbId) setCurrentGenerationId(taskId)
                
                // Ensure we're in results mode (in case first image didn't trigger it)
                if (mode === 'processing') {
                setMode('results')
                router.replace('/lifestyle?mode=results')
                }
                
                const completedTask = tasks.find(t => t.id === taskId)
                if (completedTask?.imageSlots) {
                  // Filter to only include completed images
                  const completedSlots = completedTask.imageSlots.filter(s => s.status === 'completed' && s.imageUrl)
                  const outputUrls = completedSlots.map(s => s.imageUrl!)
                  
                  if (outputUrls.length > 0) {
                    addGeneration({
                      id: firstDbId || taskId,
                      type: 'lifestyle',
                      inputImageUrl: productImage,
                      outputImageUrls: outputUrls,
                      outputModelTypes: completedSlots.map(s => s.modelType || 'pro'),
                      outputGenModes: completedSlots.map(s => s.genMode || 'simple'),
                      createdAt: new Date().toISOString(),
                      params: { type: 'lifestyle' },
                    })
                  }
                }
                confirmQuota()
                break
            }
          } catch (e) {
            console.warn('[Lifestyle] Failed to parse event:', jsonStr)
          }
        }
      }
    } catch (error: any) {
      setLifestyleStatus(`生成失败: ${error.message}`)
      updateTaskStatus(taskId, 'failed')
    }
  }

  const { downloadImage } = useImageDownload({ filenamePrefix: 'lifestyle' })
  const handleDownload = (url: string) => downloadImage(url)

  if (authLoading || !user) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className={`${isDesktop ? 'h-full relative' : 'fixed inset-0 z-30'} flex flex-col overflow-hidden ${isDesktop ? 'bg-zinc-50' : 'bg-black'}`}>
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
        ref={sceneUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleSceneUpload}
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
            {/* Header - Mobile only */}
            <MobilePageHeader
              show={!isDesktop}
              backAction={mode === "review" ? "close" : "home"}
              onBack={mode === "review" ? handleRetake : undefined}
              title={t.lifestyle?.title || 'LifeStyle 街拍'}
              titleIcon={<Sparkles className="w-4 h-4" />}
              titleIconColor="text-purple-400"
            />
            
            {/* Selection Badges */}
            {mode === "review" && (selectedModel || selectedScene) && (
              <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {selectedModel && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.lifestyle?.streetModel || '模特'}: {selectedModel.name}
                  </span>
                )}
                {selectedScene && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    {t.lifestyle?.streetScene || '场景'}: {selectedScene.name}
                  </span>
                )}
              </div>
            )}

            {/* Viewfinder */}
            <div className={`flex-1 relative ${isDesktop ? 'bg-zinc-50' : 'bg-zinc-900'}`}>
              {mode === "camera" && isDesktop ? (
                /* PC Desktop: Show upload interface with wider layout */
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
                        <h1 className="text-lg font-semibold text-zinc-900">{t.lifestyle?.title || 'LifeStyle 街拍'}</h1>
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
                              src="https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage/features/lifestyle.jpg" 
                              alt="LifeStyle Mode" 
                              fill 
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-lg font-bold text-white">{t.lifestyle?.lifestyleMode || 'LifeStyle Street Mode'}</h3>
                              <p className="text-sm text-white/80 mt-1">{t.home?.lifestyleModeSubtitle || 'AI 智能匹配模特与街景'}</p>
                            </div>
                          </div>
                          
                          {/* Feature Tags */}
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.lifestyle?.smartSceneMatch || 'Smart Scene Matching'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.lifestyle?.fashionModelStyle || 'Fashion Model Style'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                <Check className="w-3 h-3" />
                                {t.lifestyle?.multiStyleOptions || 'Multiple Style Options'}
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
                            className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border-2 border-dashed border-zinc-300 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center justify-center gap-3 transition-all"
                          >
                            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-zinc-700">{t.lifestyle?.uploadProduct || '上传商品图片'}</p>
                              <p className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || '点击上传或拖拽图片'}</p>
                            </div>
                            </button>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              ) : mode === "review" && isDesktop ? (
                /* Desktop Review Mode - Using shared ReviewModeLayout */
                <ReviewModeLayout
                  title={t.lifestyle?.title || 'LifeStyle Mode'}
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
                  backgrounds={allScenes}
                  selectedBgId={selectedSceneId}
                  onSelectBg={setSelectedSceneId}
                  onBgUpload={() => sceneUploadRef.current?.click()}
                  onBgZoom={(url) => setFullscreenImage(url)}
                  onViewMoreBgs={() => setShowScenePicker(true)}
                  onBgDrop={(base64) => {
                    const newScene: Asset = {
                      id: `custom-scene-${Date.now()}`,
                      type: 'background',
                      name: '自定义场景',
                      imageUrl: base64,
                    }
                    setCustomScenes(prev => [newScene, ...prev])
                    setSelectedSceneId(newScene.id)
                  }}
                  creditCost={4}
                  onGenerate={handleLifestyleGenerate}
                  t={t}
                />
              ) : mode === "camera" && !isDesktop ? (
                hasCamera && permissionChecked ? (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="absolute inset-0 w-full h-full object-cover"
                    videoConstraints={{ facingMode: "environment" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <div className="text-center text-zinc-500">
                      <Camera className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">{t.lifestyle?.cameraNotReady || '相机未准备好，请从相册上传商品图'}</p>
                    </div>
                  </div>
                )
              ) : mode === "camera" && isDesktop ? (
                /* PC Desktop shows upload interface - handled above in isDesktop check */
                null
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
                  addLabel={t.proStudio?.add || '添加'}
                  badges={mode === "review" ? [
                    ...(selectedModel?.name ? [{ label: t.lifestyle?.streetModel || '模特', value: selectedModel.name }] : []),
                    ...(selectedScene?.name ? [{ label: t.lifestyle?.streetScene || '场景', value: selectedScene.name }] : []),
                  ] : []}
                />
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
                  {/* Custom model/scene button */}
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
                      <span className="text-sm font-medium">{t.lifestyle?.customizeModelScene || '自定义模特/场景'}</span>
                    </button>
                  </div>
                  
                  {/* Shoot It button */}
                  <div className="w-full flex justify-center lg:w-auto lg:order-2">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => {
                        triggerFlyToGallery(e)
                        handleLifestyleGenerate()
                      }}
                      className={`w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 flex items-center justify-center transition-colors ${
                        isDesktop
                          ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg'
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
                  albumLabel={t.lifestyle?.album || '相册'}
                  assetLabel={t.lifestyle?.assetLibrary || '资源库'}
                />
              )}
            </div>
            )}
          </motion.div>
        )}

        {mode === "processing" && (
          <ProcessingView
            numImages={LIFESTYLE_NUM_IMAGES}
            generatedImages={generatedImages}
            imageSlots={tasks.find(t => t.id === currentTaskId)?.imageSlots?.map(slot => ({
              url: slot.imageUrl,
              status: slot.status as 'generating' | 'completed' | 'failed'
            }))}
            themeColor="purple"
            title={t.lifestyle?.creating || 'Creating street style photos'}
            mobileStatusLines={[lifestyleStatus]}
            onShootMore={handleRetake}
            onReturnHome={() => router.push("/")}
            onDownload={(url) => handleDownload(url)}
            shootMoreText={t.lifestyle?.shootMore || 'Shoot More'}
            returnHomeText={t.lifestyle?.returnHome || 'Return Home'}
          />
        )}

        {mode === "results" && (
          <ResultsView
            title={t.lifestyle?.results || 'LifeStyle Results'}
            onBack={handleRetake}
            images={Array.from({ length: LIFESTYLE_NUM_IMAGES }).map((_, i) => {
                  const url = generatedImages[i]
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const slot = currentTask?.imageSlots?.[i]
                  const status = slot?.status || (url ? 'completed' : 'generating')
              return {
                url,
                status: status as 'completed' | 'pending' | 'generating' | 'failed',
                error: slot?.error,
              }
            })}
            getBadge={() => ({
              text: t.lifestyle?.badge || 'Lifestyle',
              className: 'bg-purple-500',
            })}
            themeColor="purple"
            onFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onDownload={(url) => handleDownload(url)}
            onShootNext={handleRetake}
            onGoEdit={(url) => navigateToEdit(router, url)}
            onRegenerate={handleLifestyleGenerate}
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
              badges={[{ text: t.lifestyle?.badge || 'Lifestyle', className: 'bg-purple-500 text-white' }]}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={() => {
                if (selectedResultIndex === null) return
                const currentTask = tasks.find(t => t.id === currentTaskId)
                const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                if (imageUrl) handleDownload(imageUrl)
              }}
              onFullscreen={() => {
                if (selectedResultIndex === null) return
                const currentTask = tasks.find(t => t.id === currentTaskId)
                const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                if (imageUrl) setFullscreenImage(imageUrl)
              }}
              quickActions={selectedResultIndex !== null ? [
                createQuickActions.tryOn(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (imageUrl) {
                    sessionStorage.setItem('tryOnImage', imageUrl)
                    router.push('/try-on')
                  }
                }),
                createQuickActions.edit(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  setSelectedResultIndex(null)
                  if (imageUrl) navigateToEdit(router, imageUrl)
                }),
                createQuickActions.groupShoot(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (imageUrl) {
                    sessionStorage.setItem('groupShootImage', imageUrl)
                    router.push('/group-shot')
                  }
                }),
                createQuickActions.material(() => {
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const selectedSlot = currentTask?.imageSlots?.[selectedResultIndex]
                  const imageUrl = selectedSlot?.imageUrl || generatedImages[selectedResultIndex]
                  if (imageUrl) {
                    sessionStorage.setItem('modifyMaterial_outputImage', imageUrl)
                    sessionStorage.setItem('modifyMaterial_inputImages', JSON.stringify([capturedImage].filter(Boolean)))
                    router.push('/gallery/modify-material')
                  }
                }),
              ] : []}
              inputImages={capturedImage ? [{ url: capturedImage, label: t.common?.product || 'Product' }] : []}
              onInputImageClick={(url) => setFullscreenImage(url)}
            />
          </ResultsView>
        )}
      </AnimatePresence>

      {/* Custom Panel - Mobile only */}
      <AnimatePresence>
        {showCustomPanel && !isDesktop && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowCustomPanel(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold text-lg">{t.proStudio?.customConfig || '自定义配置'}</span>
                <button 
                  onClick={() => setShowCustomPanel(false)} 
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors"
                >
                  {t.proStudio?.nextStep || '下一步'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                {[
                  { id: "model", label: t.lifestyle?.streetModel || "模特" },
                  { id: "scene", label: t.lifestyle?.streetScene || "场景" }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveCustomTab(tab.id as 'model' | 'scene')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeCustomTab === tab.id 
                        ? "bg-purple-600 text-white" 
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
                          className="text-xs text-purple-600"
                        >
                          {t.proStudio?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={allModels} 
                      selectedId={selectedModelId} 
                      onSelect={(id) => setSelectedModelId(selectedModelId === id ? null : id)}
                      onUpload={() => modelUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadIcon="plus"
                      uploadLabel={t.common.upload}
                    />
                  </div>
                )}
                {activeCustomTab === "scene" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">{t.proStudio?.selectBg || '选择场景（不选则随机）'}</span>
                      {selectedSceneId && (
                        <button 
                          onClick={() => setSelectedSceneId(null)}
                          className="text-xs text-purple-600"
                        >
                          {t.proStudio?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={allScenes} 
                      selectedId={selectedSceneId} 
                      onSelect={(id) => setSelectedSceneId(selectedSceneId === id ? null : id)}
                      onUpload={() => sceneUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadIcon="plus"
                      uploadLabel={t.common.upload}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fullscreen Image - Using shared component */}
      <FullscreenImageViewer
        open={!!fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        imageUrl={fullscreenImage || ''}
      />

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
        themeColor="purple"
        title={t.lifestyle?.selectProduct || '选择商品'}
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
        themeColor="purple"
        allowUpload
      />
      
      {/* Scene Picker */}
      <ScenePickerPanel
        open={showScenePicker}
        onClose={() => setShowScenePicker(false)}
        selectedId={selectedSceneId}
        customScenes={allScenes}
        onSelect={(scene) => setSelectedSceneId(scene.id)}
        sceneType="lifestyle"
        themeColor="purple"
        allowUpload={false}
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
        themeColor="purple"
        title={t.proStudio?.add || '添加商品'}
      />
    </div>
  )
}

export default function LifestylePage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <LifestylePageContent />
    </Suspense>
  )
}

