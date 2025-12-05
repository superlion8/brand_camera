"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowRight, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, FolderHeart, Sparkles, Check
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, ensureBase64 } from "@/lib/utils"
import { Asset } from "@/types"
import Image from "next/image"
import { 
  STUDIO_MODELS, 
  ALL_STUDIO_BACKGROUNDS, 
  STUDIO_BG_LIGHT,
  STUDIO_BG_SOLID,
  STUDIO_BG_PATTERN,
  getRandomStudioModel, 
  getRandomStudioBackground,
  PRESET_PRODUCTS 
} from "@/data/presets"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"

type PageMode = "camera" | "review" | "processing" | "results"

// 专业棚拍生成6张图：背景库模式2张 + 随机背景模式2张 + 扩展模式2张
const PRO_STUDIO_NUM_IMAGES = 6

// Asset Grid Component
function AssetGrid({ 
  items, 
  selectedId, 
  onSelect,
  emptyText = "暂无资源"
}: { 
  items: Asset[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyText?: string
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <p className="text-sm">{emptyText}</p>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all ${
            selectedId === item.id 
              ? "border-amber-500 ring-2 ring-amber-500/30" 
              : "border-transparent hover:border-amber-300"
          }`}
        >
          <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
          {selectedId === item.id && (
            <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-3">
            <p className="text-[9px] text-white truncate text-center">{item.name}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// Background Grid with categories
function BackgroundGrid({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'light' | 'solid' | 'pattern'>('all')
  
  const bgMap = {
    all: ALL_STUDIO_BACKGROUNDS,
    light: STUDIO_BG_LIGHT,
    solid: STUDIO_BG_SOLID,
    pattern: STUDIO_BG_PATTERN,
  }
  
  const tabs = [
    { id: 'all', label: '全部', count: ALL_STUDIO_BACKGROUNDS.length },
    { id: 'light', label: '打光', count: STUDIO_BG_LIGHT.length },
    { id: 'solid', label: '纯色', count: STUDIO_BG_SOLID.length },
    { id: 'pattern', label: '花色', count: STUDIO_BG_PATTERN.length },
  ]
  
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-amber-500 text-white"
                : "bg-white text-zinc-600 border border-zinc-200"
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {bgMap[activeTab].map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`aspect-square rounded-lg overflow-hidden relative border-2 transition-all ${
              selectedId === item.id 
                ? "border-amber-500 ring-2 ring-amber-500/30" 
                : "border-transparent hover:border-amber-300"
            }`}
          >
            <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
            {selectedId === item.id && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </button>
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
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { userProducts } = useAssetStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Selection state
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  
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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // Get selected assets
  const selectedModel = selectedModelId ? STUDIO_MODELS.find(m => m.id === selectedModelId) : null
  const selectedBg = selectedBgId ? ALL_STUDIO_BACKGROUNDS.find(b => b.id === selectedBgId) : null

  // Camera permission check
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const cachedPermission = localStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
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
    }
    checkCameraPermission()
  }, [])

  // 拍照
  const handleCapture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
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

    // 准备模特和背景
    const isModelRandom = !selectedModelId
    const isBgRandom = !selectedBgId

    // 生成任务配置
    const tasks = [
      { mode: 'background-lib', index: 0 },
      { mode: 'background-lib', index: 1 },
      { mode: 'random-bg', index: 2 },
      { mode: 'random-bg', index: 3 },
      { mode: 'extended', index: 4 },
      { mode: 'extended', index: 5 },
    ]

    const results: string[] = []
    const modes: string[] = []
    let firstCompleted = false

    // 并行生成所有图片
    const promises = tasks.map(async (task) => {
      // 每张图获取模特和背景
      let taskModel: string | null = null
      let taskBg: string | null = null

      if (isModelRandom) {
        const randomModel = getRandomStudioModel()
        taskModel = await ensureBase64(randomModel.imageUrl)
      } else if (selectedModel) {
        taskModel = await ensureBase64(selectedModel.imageUrl)
      }

      if (task.mode === 'background-lib') {
        if (isBgRandom) {
          const randomBg = getRandomStudioBackground()
          taskBg = await ensureBase64(randomBg.imageUrl)
        } else if (selectedBg) {
          taskBg = await ensureBase64(selectedBg.imageUrl)
        }
      }

      updateImageSlot(taskId, task.index, { status: 'generating' })

      try {
        const response = await fetch('/api/generate-pro-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: compressedProduct,
            modelImage: taskModel,
            backgroundImage: taskBg,
            mode: task.mode,
            index: task.index,
            taskId,
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
            error: data.error || '生成失败',
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

  // 重置
  const handleReset = () => {
    setCapturedImage(null)
    setSelectedModelId(null)
    setSelectedBgId(null)
    setGeneratedImages([])
    setGeneratedModes([])
    setMode("camera")
  }

  // 获取模式标签
  const getModeLabel = (modeStr: string) => {
    switch (modeStr) {
      case 'background-lib': return '背景库'
      case 'random-bg': return 'AI背景'
      case 'extended': return '扩展'
      default: return modeStr
    }
  }

  return (
    <div className="h-full flex flex-col bg-black relative">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-black/80 backdrop-blur-md z-20 absolute top-0 left-0 right-0">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"
        >
          <Home className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white">{t.home.proStudio || '专业棚拍'}</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-14 flex flex-col">
        {/* Camera/Review/Processing View */}
        {(mode === "camera" || mode === "review") && (
          <div className="flex-1 relative">
            {/* Camera Preview */}
            {mode === "camera" && (
              hasCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="absolute inset-0 w-full h-full object-cover"
                  videoConstraints={{ facingMode: "environment" }}
                  onUserMediaError={() => setHasCamera(false)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
                  <Camera className="w-16 h-16 text-zinc-600 mb-4" />
                  <p className="text-zinc-400 text-center px-8 text-sm">
                    无法访问相机
                  </p>
                  <p className="text-zinc-500 text-center px-8 text-xs mt-1">
                    请上传商品图片
                  </p>
                </div>
              )
            )}

            {/* Review Image */}
            {mode === "review" && capturedImage && (
              <div className="absolute inset-0">
                <Image src={capturedImage} alt="Captured" fill className="object-contain bg-black" />
              </div>
            )}

            {/* Selection Badges */}
            {mode === "review" && (
              <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {selectedModel && (
                  <span className="px-2 py-1 bg-amber-500/80 text-white text-xs rounded-full backdrop-blur-md">
                    模特: {selectedModel.name}
                  </span>
                )}
                {selectedBg && (
                  <span className="px-2 py-1 bg-amber-500/80 text-white text-xs rounded-full backdrop-blur-md">
                    背景: {selectedBg.name}
                  </span>
                )}
                {!selectedModel && !selectedBg && (
                  <span className="px-2 py-1 bg-black/50 text-white/80 text-xs rounded-full backdrop-blur-md">
                    模特和背景将随机选择
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
                  <div className="w-64 h-64 border border-amber-400/50 rounded-lg relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400" />
                  </div>
                </div>
                <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                  拍摄或上传商品图片
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing Mode */}
        {mode === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-amber-900/50 to-zinc-900">
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/50 to-orange-500/50 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-amber-300 animate-spin" />
                </div>
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <p className="mt-8 text-white font-medium text-lg">AI 正在创作专业棚拍图...</p>
            <p className="mt-2 text-amber-300/70 text-sm">预计需要 30-60 秒</p>
            <div className="mt-6 flex gap-2">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-500/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Results Mode */}
        {mode === "results" && (
          <div className="flex-1 overflow-y-auto pb-24 bg-zinc-900">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg">生成结果</h2>
                <span className="text-amber-400 text-sm">
                  {generatedImages.filter(Boolean).length}/{PRO_STUDIO_NUM_IMAGES}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[...Array(PRO_STUDIO_NUM_IMAGES)].map((_, i) => {
                  const img = generatedImages[i]
                  const modeStr = generatedModes[i]
                  
                  if (img) {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 cursor-pointer group"
                        onClick={() => setFullscreenImage(img)}
                      >
                        <Image src={img} alt={`Result ${i + 1}`} fill className="object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-medium rounded-full">
                            {getModeLabel(modeStr)}
                          </span>
                        </div>
                        <button className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Heart className="w-4 h-4 text-white" />
                        </button>
                      </motion.div>
                    )
                  } else {
                    return (
                      <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-800 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                        <span className="text-zinc-500 text-xs mt-2">生成中...</span>
                      </div>
                    )
                  }
                })}
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3.5 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors"
                >
                  重新拍摄
                </button>
                <button
                  onClick={() => router.push('/gallery')}
                  className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-colors"
                >
                  查看图库
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        {(mode === "camera" || mode === "review") && (
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
                    <span className="text-sm font-medium">自定义模特/背景</span>
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
                    className="w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-center transition-all"
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
                  <span className="text-[10px]">相册</span>
                </button>

                {/* Shutter */}
                <button 
                  onClick={handleCapture}
                  disabled={!hasCamera}
                  className="w-20 h-20 rounded-full border-4 border-amber-400/50 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-[72px] h-[72px] bg-gradient-to-br from-amber-400 to-orange-500 rounded-full group-active:from-amber-500 group-active:to-orange-600 transition-colors" />
                </button>

                {/* Asset Library */}
                <button 
                  onClick={() => setShowProductPanel(true)}
                  className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <FolderHeart className="w-6 h-6" />
                  </div>
                  <span className="text-[10px]">资源库</span>
                </button>
              </div>
            )}
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
              className="absolute bottom-0 left-0 right-0 h-[65%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold text-lg">自定义配置</span>
                <button 
                  onClick={() => setShowCustomPanel(false)} 
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors"
                >
                  确定
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                {[
                  { id: "model", label: "专业模特" },
                  { id: "bg", label: "棚拍背景" }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveCustomTab(tab.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeCustomTab === tab.id 
                        ? "bg-amber-500 text-white" 
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
                {activeCustomTab === "model" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">选择模特（不选则随机）</span>
                      {selectedModelId && (
                        <button 
                          onClick={() => setSelectedModelId(null)}
                          className="text-xs text-amber-600"
                        >
                          清除选择
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={STUDIO_MODELS} 
                      selectedId={selectedModelId} 
                      onSelect={(id) => setSelectedModelId(selectedModelId === id ? null : id)}
                    />
                  </div>
                )}
                {activeCustomTab === "bg" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">选择背景（不选则随机）</span>
                      {selectedBgId && (
                        <button 
                          onClick={() => setSelectedBgId(null)}
                          className="text-xs text-amber-600"
                        >
                          清除选择
                        </button>
                      )}
                    </div>
                    <BackgroundGrid 
                      selectedId={selectedBgId} 
                      onSelect={(id) => setSelectedBgId(selectedBgId === id ? null : id)}
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
              className="absolute bottom-0 left-0 right-0 h-[60%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">选择商品</span>
                <button 
                  onClick={() => setShowProductPanel(false)} 
                  className="h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
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
                    官方示例
                    <span className="ml-1 text-zinc-400">({PRESET_PRODUCTS.length})</span>
                  </button>
                  <button
                    onClick={() => setProductSourceTab("user")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "user"
                        ? "bg-white text-zinc-900 shadow-sm"
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
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
                {productSourceTab === "preset" ? (
                  <div className="grid grid-cols-3 gap-3 pb-20 relative">
                    {isLoadingAssets && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
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
                        className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
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
                        className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all"
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
                    <p className="text-sm">暂无我的商品</p>
                    <p className="text-xs mt-1">请先在资源库上传商品</p>
                    <button 
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      去上传
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
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
            <Image src={fullscreenImage} alt="Fullscreen" fill className="object-contain" />
            <button className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
            <button className="absolute bottom-8 right-8 w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
              <Download className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
        usedCount={quota?.usedCount || 0}
        totalQuota={quota?.totalQuota || 0}
      />
      
      {(mode === "processing" || mode === "results") && <BottomNav forceShow />}
    </div>
  )
}
