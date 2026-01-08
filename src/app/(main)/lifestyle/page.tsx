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
import { PRESET_PRODUCTS } from "@/data/presets"
import { Asset } from "@/types"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { usePresetStore } from "@/stores/presetStore"
import { useIsMobile } from "@/hooks/useIsMobile"

type PageMode = "camera" | "review" | "processing" | "results"

const LIFESTYLE_NUM_IMAGES = 4

function LifestylePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, refreshQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, addUserAsset, addGeneration } = useAssetStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [lifestyleStatus, setLifestyleStatus] = useState<string>('')
  
  // Custom model/scene selection
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customScenes, setCustomScenes] = useState<Asset[]>([])
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'scene'>('model')
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<string[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<('simple' | 'extended')[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
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

  // Camera permission check
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(track => track.stop())
        setCameraReady(true)
      } catch {
        setHasCamera(false)
      }
      setPermissionChecked(true)
    }
    checkCameraPermission()
  }, [])

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

  const handleRetake = () => {
    setCapturedImage(null)
    setProductFromPhone(false)
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
    
    // Reserve quota
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: LIFESTYLE_NUM_IMAGES,
          taskType: 'lifestyle',
        }),
      })
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve:', e)
    }
    
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
    
    try {
      setLifestyleStatus(t.common?.loading || '正在连接服务器...')
      
      const response = await fetch('/api/generate-lifestyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
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
                
                // Switch to results mode when all images are done
                setMode('results')
                router.replace('/lifestyle?mode=results')
                
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
                refreshQuota()
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

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `lifestyle-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className={`h-full relative flex flex-col overflow-hidden ${isDesktop ? 'bg-zinc-50' : 'bg-black'}`}>
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
            {/* Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button
                onClick={mode === "review" ? handleRetake : () => router.push("/")}
                className="w-10 h-10 rounded-full bg-black/20 text-white backdrop-blur-md flex items-center justify-center"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
              <div className="px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-white text-xs font-medium">{t.lifestyle?.title || 'LifeStyle 街拍'}</span>
              </div>
              <div className="w-10" />
            </div>
            
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
                /* PC Desktop: Show upload interface with two-column layout */
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
                        <h1 className="text-lg font-semibold text-zinc-900">{t.lifestyle?.title || 'LifeStyle 街拍'}</h1>
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
                          <div className="mt-4">
                            <button
                              onClick={() => setShowProductPanel(true)}
                              className="w-full h-12 rounded-xl border border-zinc-200 bg-white hover:border-purple-400 hover:bg-purple-50/50 flex items-center justify-center gap-2 transition-colors"
                            >
                              <FolderHeart className="w-4 h-4 text-zinc-500" />
                              <span className="text-sm text-zinc-600">{t.lifestyle?.assetLibrary || '素材库'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Options */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6">
                          <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 bg-purple-50 rounded-2xl flex items-center justify-center">
                              <Sparkles className="w-8 h-8 text-purple-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 mb-2">LifeStyle 街拍模式</h3>
                            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                              {t.common?.uploadProductDesc || '上传商品图片后，AI 将为你生成专业展示图'}
                            </p>
                          </div>
                          
                          <div className="border-t border-zinc-100 pt-6 space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">智能场景匹配</h4>
                                <p className="text-xs text-zinc-500">根据商品自动匹配最合适的街景</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-pink-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">时尚模特风格</h4>
                                <p className="text-xs text-zinc-500">专业时尚模特展示效果</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-zinc-900">多种风格可选</h4>
                                <p className="text-xs text-zinc-500">支持自定义模特和场景</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : mode === "review" && isDesktop ? (
                /* Desktop Review Mode - Two Column Layout */
                <div className="absolute inset-0 overflow-y-auto bg-zinc-50">
                  {/* PC Header */}
                  <div className="bg-white border-b border-zinc-200">
                    <div className="max-w-5xl mx-auto px-8 py-5">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleRetake}
                          className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5 text-zinc-600" />
                        </button>
                        <h1 className="text-lg font-semibold text-zinc-900">{t.lifestyle?.title || 'LifeStyle 街拍'}</h1>
                      </div>
                    </div>
                  </div>
                  
                  {/* Two-column content */}
                  <div className="max-w-5xl mx-auto px-8 py-8">
                    <div className="flex gap-8">
                        {/* Left: Product Image */}
                      <div className="w-[380px] shrink-0 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                          <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-900">{t.lifestyle?.uploadProduct || '商品图'}</span>
                            <button onClick={handleRetake} className="text-xs text-zinc-500 hover:text-zinc-700">
                              {t.common?.change || '更换'}
                            </button>
                          </div>
                          <div className="aspect-square relative bg-zinc-50">
                            <img src={capturedImage || ""} alt="商品" className="w-full h-full object-contain" />
                          </div>
                        </div>
                        
                        {/* Outfit Button */}
                        <button
                          onClick={() => {
                            if (capturedImage) {
                              sessionStorage.setItem('lifestyleProduct1Image', capturedImage)
                              router.push('/lifestyle/outfit')
                            }
                          }}
                          className="w-full h-12 rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 flex items-center justify-center gap-2 text-zinc-500 hover:text-purple-600 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm">{t.lifestyle?.outfitMode || '搭配商品'}</span>
                        </button>
                      </div>
                      
                      {/* Right: Settings */}
                      <div className="flex-1 min-w-0 space-y-6">
                        {/* Model Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">{t.lifestyle?.selectModel || '选择模特'}</h3>
                            <div className="flex items-center gap-3">
                              {selectedModelId && (
                                <button onClick={() => setSelectedModelId(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除选择'}
                                </button>
                              )}
                              {allModels.length > 7 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("model")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
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
                              className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-5 h-5 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">上传</span>
                            </button>
                            {allModels.slice(0, 7).map(model => (
                              <button
                                key={model.id}
                                onClick={() => setSelectedModelId(selectedModelId === model.id ? null : model.id)}
                                className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                  selectedModelId === model.id 
                                    ? 'border-purple-500 ring-2 ring-purple-500/30' 
                                    : 'border-transparent hover:border-purple-300'
                                }`}
                              >
                                <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                {selectedModelId === model.id && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Scene Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-zinc-900">{t.lifestyle?.selectScene || '选择场景'}</h3>
                            <div className="flex items-center gap-3">
                              {selectedSceneId && (
                                <button onClick={() => setSelectedSceneId(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                                  {t.proStudio?.clearSelection || '清除选择'}
                                </button>
                              )}
                              {allScenes.length > 7 && (
                                <button 
                                  onClick={() => {
                                    setActiveCustomTab("scene")
                                    setShowCustomPanel(true)
                                  }}
                                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                >
                                  {t.common?.viewMore || '查看更多'} ({allScenes.length})
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-zinc-500 mb-4">{t.common?.randomMatchHint || '不选则随机匹配'}</p>
                          <div className="grid grid-cols-4 gap-3">
                            <button
                              onClick={() => sceneUploadRef.current?.click()}
                              className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-5 h-5 text-zinc-400" />
                              <span className="text-[10px] text-zinc-400">上传</span>
                            </button>
                            {allScenes.slice(0, 7).map(scene => (
                              <button
                                key={scene.id}
                                onClick={() => setSelectedSceneId(selectedSceneId === scene.id ? null : scene.id)}
                                className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                  selectedSceneId === scene.id 
                                    ? 'border-purple-500 ring-2 ring-purple-500/30' 
                                    : 'border-transparent hover:border-purple-300'
                                }`}
                              >
                                <Image src={scene.imageUrl} alt={scene.name || ''} fill className="object-cover" />
                                {selectedSceneId === scene.id && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Generate Button */}
                        <button
                          onClick={handleLifestyleGenerate}
                          className="w-full h-14 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-200/50"
                        >
                          <Wand2 className="w-5 h-5" />
                          {t.lifestyle?.startGenerate || '开始生成'}
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
                                  activeCustomTab === "model" ? "bg-purple-500 text-white" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.lifestyle?.streetModel || '模特'}
                              </button>
                              <button 
                                onClick={() => setActiveCustomTab("scene")}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                  activeCustomTab === "scene" ? "bg-purple-500 text-white" : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.lifestyle?.streetScene || '场景'}
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
                                  <span className="text-sm text-zinc-600">{t.lifestyle?.selectModel || '选择模特（不选则随机）'}</span>
                                  {selectedModelId && (
                                    <button onClick={() => setSelectedModelId(null)} className="text-xs text-purple-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => modelUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">上传</span>
                                  </button>
                                  {allModels.map(model => (
                                    <button
                                      key={model.id}
                                      onClick={() => setSelectedModelId(selectedModelId === model.id ? null : model.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedModelId === model.id 
                                          ? 'border-purple-500 ring-2 ring-purple-500/30' 
                                          : 'border-transparent hover:border-purple-300'
                                      }`}
                                    >
                                      <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                                      {selectedModelId === model.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                          <Check className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {activeCustomTab === "scene" && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-zinc-600">{t.lifestyle?.selectScene || '选择场景（不选则随机）'}</span>
                                  {selectedSceneId && (
                                    <button onClick={() => setSelectedSceneId(null)} className="text-xs text-purple-600">
                                      {t.proStudio?.clearSelection || '清除选择'}
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                  <button
                                    onClick={() => sceneUploadRef.current?.click()}
                                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 flex flex-col items-center justify-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                    <span className="text-[10px] text-zinc-400">上传</span>
                                  </button>
                                  {allScenes.map(scene => (
                                    <button
                                      key={scene.id}
                                      onClick={() => setSelectedSceneId(selectedSceneId === scene.id ? null : scene.id)}
                                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                                        selectedSceneId === scene.id 
                                          ? 'border-purple-500 ring-2 ring-purple-500/30' 
                                          : 'border-transparent hover:border-purple-300'
                                      }`}
                                    >
                                      <Image src={scene.imageUrl} alt={scene.name || ''} fill className="object-cover" />
                                      {selectedSceneId === scene.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
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
                              className="px-8 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-colors"
                            >
                              确定
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : mode === "camera" ? (
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
              ) : (
                <img src={capturedImage || ""} alt="Captured" className="w-full h-full object-cover" />
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
                  
                  {/* Generate and Outfit buttons */}
                  <div className="w-full flex gap-3 max-w-sm mx-auto lg:w-auto lg:order-2">
                    {/* Outfit Mode Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        // Save product image to sessionStorage and go to outfit page
                        if (capturedImage) {
                          sessionStorage.setItem('lifestyleProduct1Image', capturedImage)
                          router.push('/lifestyle/outfit')
                        }
                      }}
                      className={`h-14 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 border transition-colors ${
                        isDesktop
                          ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-300'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                      {t.lifestyle?.outfitMode || '搭配'}
                    </motion.button>
                    
                    {/* Generate button */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleLifestyleGenerate}
                      className="flex-1 lg:flex-none lg:px-8 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                    >
                      <Wand2 className="w-5 h-5" />
                      {t.lifestyle?.startGenerate || '开始生成'}
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
                    <span className="text-[10px]">{t.lifestyle?.album || '相册'}</span>
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
                    <span className="text-[10px]">{t.lifestyle?.assetLibrary || '资源库'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
              isDesktop ? 'bg-zinc-50' : 'bg-zinc-950'
            }`}
          >
            <div className="w-20 h-20 mb-8 relative">
              <div className={`absolute inset-0 blur-2xl rounded-full animate-pulse ${
                isDesktop ? 'bg-purple-500/30' : 'bg-purple-500/20'
              }`} />
              <Loader2 className={`w-full h-full animate-spin ${
                isDesktop ? 'text-purple-600' : 'text-purple-500'
              }`} />
            </div>
            <h3 className={`text-2xl font-bold mb-4 ${isDesktop ? 'text-zinc-900' : 'text-white'}`}>
              {t.lifestyle?.creating || '正在创作街拍大片'}
            </h3>
            <p className={`text-sm mb-8 ${isDesktop ? 'text-zinc-500' : 'text-zinc-400'}`}>{lifestyleStatus}</p>
            
            {/* Action buttons */}
            <div className="space-y-3 w-full max-w-xs">
              <p className={`text-xs mb-4 ${isDesktop ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {t.lifestyle?.continueInBackground || '生成将在后台继续，您可以：'}
              </p>
              <button
                onClick={handleRetake}
                className={`w-full h-12 rounded-full font-medium flex items-center justify-center gap-2 transition-colors ${
                  isDesktop 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                <Camera className="w-5 h-5" />
                {t.lifestyle?.shootMore || '拍摄新一组'}
              </button>
              <button
                onClick={() => router.push("/")}
                className={`w-full h-12 rounded-full font-medium flex items-center justify-center gap-2 transition-colors border ${
                  isDesktop 
                    ? 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200' 
                    : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                }`}
              >
                <Home className="w-5 h-5" />
                {t.lifestyle?.returnHome || '返回首页'}
              </button>
            </div>
            
            {!isDesktop && <BottomNav forceShow />}
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            {/* Header */}
            {isDesktop ? (
              <div className="bg-white border-b border-zinc-200">
                <div className="max-w-4xl mx-auto px-8 py-4">
                  <div className="flex items-center justify-between">
                    <button onClick={handleRetake} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium">
                      <ArrowLeft className="w-5 h-5" />
                      <span>{t.lifestyle?.retake || '重拍'}</span>
                    </button>
                    <span className="font-bold text-zinc-900">{t.lifestyle?.results || 'LifeStyle 成片'}</span>
                    <div className="w-20" />
                  </div>
                </div>
              </div>
            ) : (
            <div className="h-14 flex items-center justify-between px-4 border-b bg-white">
              <button onClick={handleRetake} className="flex items-center gap-2 font-medium">
                <ArrowLeft className="w-5 h-5" />
                <span>{t.lifestyle?.retake || '重拍'}</span>
              </button>
              <span className="font-bold">{t.lifestyle?.results || 'LifeStyle 成片'}</span>
              <div className="w-10" />
            </div>
            )}
            
            {/* Content */}
            <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-8'}`}>
              <div className={`${isDesktop ? 'max-w-4xl mx-auto px-8' : ''}`}>
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {Array.from({ length: LIFESTYLE_NUM_IMAGES }).map((_, i) => {
                  const url = generatedImages[i]
                  const currentTask = tasks.find(t => t.id === currentTaskId)
                  const slot = currentTask?.imageSlots?.[i]
                  const status = slot?.status || (url ? 'completed' : 'generating')
                  
                  return (
                    <div 
                      key={i} 
                        className="aspect-[3/4] rounded-xl bg-zinc-200 overflow-hidden relative cursor-pointer group" 
                      onClick={() => url && setSelectedResultIndex(i)}
                    >
                      {url ? (
                        <>
                          <Image src={url} alt="Result" fill className="object-cover" />
                            <button className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm ${
                              isDesktop ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''
                            }`}>
                            <Heart className="w-3.5 h-3.5 text-zinc-500" />
                          </button>
                        </>
                      ) : status === 'failed' ? (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                          <span className="text-xs">{t.camera?.generationFailed || '生成失败'}</span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
                
                {/* PC: Centered button */}
                {isDesktop && (
                  <div className="flex justify-center mt-8">
                    <button 
                      onClick={handleRetake} 
                      className="px-8 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-colors"
                    >
                      {t.lifestyle?.shootNextSet || '拍摄下一组'}
                    </button>
            </div>
                )}
              </div>
            </div>
            
            {/* Mobile: Bottom button */}
            {!isDesktop && (
            <div className="p-4 pb-20 bg-white border-t shadow-up">
              <button onClick={handleRetake} className="w-full h-12 rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors">
                {t.lifestyle?.shootNextSet || '拍摄下一组'}
              </button>
            </div>
            )}
            
            {!isDesktop && <BottomNav forceShow />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Detail */}
      <AnimatePresence>
        {selectedResultIndex !== null && generatedImages[selectedResultIndex] && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b">
              <button onClick={() => setSelectedResultIndex(null)} className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
              <span className="font-semibold">{t.lifestyle?.detail || '详情'}</span>
              <button 
                onClick={() => handleDownload(generatedImages[selectedResultIndex!])}
                className="w-10 h-10 -mr-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-zinc-900 flex items-center justify-center overflow-hidden">
              <img 
                src={generatedImages[selectedResultIndex!]} 
                alt="Detail" 
                className="max-w-full max-h-full object-contain"
                onClick={() => setFullscreenImage(generatedImages[selectedResultIndex!])} 
              />
            </div>
            <p className="text-center text-zinc-500 text-xs py-2 bg-zinc-900">{t.imageActions?.longPressSave || '长按图片保存'}</p>
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

      {/* Product Panel */}
      <AnimatePresence>
        {showProductPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setShowProductPanel(false)} />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.lifestyle?.selectProduct || '选择商品'}</span>
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
                    {t.lifestyle?.officialExample || '官方示例'}
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
                    {t.lifestyle?.myProducts || '我的商品'}
                    {userProducts.length > 0 && (
                      <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                {productSourceTab === "preset" ? (
                  <div className="grid grid-cols-3 gap-3 pb-20">
                    {PRESET_PRODUCTS.map(product => (
                      <div 
                        key={product.id} 
                        className="relative group cursor-pointer"
                        onClick={() => {
                          setCapturedImage(product.imageUrl)
                          setProductFromPhone(false)
                          setMode("review")
                          setShowProductPanel(false)
                        }}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-purple-500 active:border-purple-600 transition-all w-full">
                          <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                          <span className="absolute top-1 left-1 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded font-medium pointer-events-none">
                            {t.common?.official || '官方'}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 pointer-events-none">
                            <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 pb-20">
                    {userProducts.map(product => (
                      <div 
                        key={product.id} 
                        className="relative group cursor-pointer"
                        onClick={() => {
                          setCapturedImage(product.imageUrl)
                          setProductFromPhone(false)
                          setMode("review")
                          setShowProductPanel(false)
                        }}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-purple-500 active:border-purple-600 transition-all w-full">
                          <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 pointer-events-none">
                            <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.lifestyle?.noMyProducts || '暂无我的商品'}</p>
                    <p className="text-xs mt-1">{t.lifestyle?.uploadInAssets || '请先在资源库上传商品'}</p>
                    <button 
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {t.lifestyle?.goUpload || '去上传'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Panel - Model/Scene Selection */}
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
                <span className="font-semibold text-lg">{t.lifestyle?.customConfig || '自定义配置'}</span>
                <button 
                  onClick={() => setShowCustomPanel(false)} 
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors"
                >
                  {t.lifestyle?.nextStep || '下一步'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                {[
                  { id: "model", label: t.lifestyle?.streetModel || "街拍模特" },
                  { id: "scene", label: t.lifestyle?.streetScene || "街拍场景" }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveCustomTab(tab.id as 'model' | 'scene')}
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
                      <span className="text-sm text-zinc-600">{t.lifestyle?.selectModel || '选择模特（不选则AI匹配）'}</span>
                      {selectedModelId && (
                        <button 
                          onClick={() => setSelectedModelId(null)}
                          className="text-xs text-purple-600"
                        >
                          {t.lifestyle?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Upload Button */}
                      <button
                        onClick={() => modelUploadRef.current?.click()}
                        className="aspect-[3/4] rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-purple-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-purple-50"
                      >
                        <Plus className="w-10 h-10 text-zinc-400" />
                        <span className="text-sm text-zinc-500 mt-2">{t.common?.upload || '上传'}</span>
                      </button>
                      {allModels.map(item => (
                        <div
                          key={item.id}
                          className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all cursor-pointer ${
                            selectedModelId === item.id 
                              ? "border-purple-500 ring-2 ring-purple-500/30" 
                              : "border-transparent hover:border-purple-300"
                          }`}
                          onClick={() => setSelectedModelId(selectedModelId === item.id ? null : item.id)}
                        >
                          <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
                          {selectedModelId === item.id && (
                            <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
                            <p className="text-xs text-white truncate text-center">{item.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeCustomTab === "scene" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">{t.lifestyle?.selectScene || '选择场景（不选则AI匹配）'}</span>
                      {selectedSceneId && (
                        <button 
                          onClick={() => setSelectedSceneId(null)}
                          className="text-xs text-purple-600"
                        >
                          {t.lifestyle?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Upload Button */}
                      <button
                        onClick={() => sceneUploadRef.current?.click()}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-purple-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-purple-50"
                      >
                        <Plus className="w-8 h-8 text-zinc-400" />
                        <span className="text-xs text-zinc-500 mt-1">{t.common?.upload || '上传'}</span>
                      </button>
                      {allScenes.map(item => (
                        <div
                          key={item.id}
                          className={`aspect-square rounded-xl overflow-hidden relative border-2 transition-all cursor-pointer ${
                            selectedSceneId === item.id 
                              ? "border-purple-500 ring-2 ring-purple-500/30" 
                              : "border-transparent hover:border-purple-300"
                          }`}
                          onClick={() => setSelectedSceneId(selectedSceneId === item.id ? null : item.id)}
                        >
                          <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" unoptimized />
                          {selectedSceneId === item.id && (
                            <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
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

export default function LifestylePage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <LifestylePageContent />
    </Suspense>
  )
}

