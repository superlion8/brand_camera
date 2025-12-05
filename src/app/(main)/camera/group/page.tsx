"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Home, Check, ZoomIn,
  Shuffle, Grid3X3, Camera, Sparkles, Users
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, compressBase64Image, ensureBase64 } from "@/lib/utils"
import Image from "next/image"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { useSettingsStore } from "@/stores/settingsStore"

type PageMode = "main" | "processing" | "results"
type StyleMode = "lifestyle" | "studio"  // 生活模式 / 棚拍模式
type ShootMode = "random" | "multiangle"

// 生成图片数量
const RANDOM_NUM_IMAGES = 5
const MULTIANGLE_NUM_IMAGES = 4

export default function GroupShootPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { generations } = useAssetStore()
  const { debugMode } = useSettingsStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("main")
  const [styleMode, setStyleMode] = useState<StyleMode>("lifestyle")
  const [shootMode, setShootMode] = useState<ShootMode>("random")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [gallerySubType, setGallerySubType] = useState<'all' | 'buyer' | 'pro' | 'group'>('all')
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setSelectedImage(base64)
    }
    e.target.value = ''
  }

  // 从成片选择 - 根据类型自动设置模式
  const handleSelectFromGallery = async (imageUrl: string, genType?: string) => {
    setIsLoadingAssets(true)
    setShowGalleryPicker(false)
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setSelectedImage(base64)
        
        // 智能模式选择：根据来源图片的类型
        if (genType) {
          if (genType === 'pro_studio') {
            // 专业棚拍 → 棚拍模式
            setStyleMode('studio')
          } else if (genType === 'camera' || genType === 'camera_model') {
            // 买家秀 → 生活模式
            setStyleMode('lifestyle')
          }
        }
      }
    } catch (e) {
      console.error("Failed to load image:", e)
    } finally {
      setIsLoadingAssets(false)
    }
  }

  // 重新选择
  const handleReselect = () => {
    setSelectedImage(null)
    setGeneratedImages([])
    setMode("main")
  }

  // 开始生成
  const handleStartGeneration = async () => {
    if (!selectedImage) return

    const numImages = shootMode === 'random' ? RANDOM_NUM_IMAGES : MULTIANGLE_NUM_IMAGES
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('group_shoot', selectedImage, { shootMode, styleMode }, numImages)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, numImages)

    // 压缩图片
    const compressedImage = await compressBase64Image(selectedImage, 1024)

    try {
      const response = await fetch('/api/generate-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startImage: compressedImage,
          mode: shootMode,
          styleMode: styleMode, // 新增：传递风格模式
          taskId,
        }),
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      const results: string[] = []
      let firstCompleted = false

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
              
              if (data.type === 'progress') {
                updateImageSlot(taskId, data.index, { status: 'generating' })
              } else if (data.type === 'image') {
                updateImageSlot(taskId, data.index, {
                  status: 'completed',
                  imageUrl: data.image,
                  modelType: data.modelType,
                  genMode: 'simple',
                })
                results[data.index] = data.image
                setGeneratedImages([...results])

                if (!firstCompleted) {
                  firstCompleted = true
                  setMode("results")
                }
              } else if (data.type === 'error') {
                updateImageSlot(taskId, data.index, {
                  status: 'failed',
                  error: data.error || '生成失败',
                })
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }

      updateTaskStatus(taskId, 'completed')
    } catch (error: any) {
      console.error('Generation error:', error)
      for (let i = 0; i < numImages; i++) {
        const task = tasks.find(t => t.id === taskId)
        const slot = task?.imageSlots?.[i]
        if (!slot || slot.status === 'pending' || slot.status === 'generating') {
          updateImageSlot(taskId, i, {
            status: 'failed',
            error: error.message || '网络错误',
          })
        }
      }
      updateTaskStatus(taskId, 'failed')
    }
  }

  // 辅助函数：判断是否是买家秀类型（与 gallery API 保持一致）
  const isBuyerShowType = (type: string | undefined) => {
    if (!type) return false
    const t = type.toLowerCase()
    return t === 'camera_model' || t === 'model' || t === 'camera' || t === 'model_studio' || t === 'edit' || t === 'editing'
  }
  
  // 辅助函数：判断是否是专业棚拍类型
  const isProStudioType = (type: string | undefined) => {
    if (!type) return false
    const t = type.toLowerCase()
    return t === 'pro_studio' || t === 'prostudio'
  }
  
  // 辅助函数：判断是否是组图类型
  const isGroupShootType = (type: string | undefined) => {
    if (!type) return false
    return type.toLowerCase() === 'group_shoot'
  }

  // 获取模特分类的图库图片（买家秀+专业棚拍+组图）
  const modelGenerations = (generations || [])
    .filter(g => {
      if (!g) return false
      // 确保 outputImageUrls 是有效数组且有有效的 URL
      if (!Array.isArray(g.outputImageUrls)) return false
      const hasValidUrls = g.outputImageUrls.some(url => typeof url === 'string' && url.length > 0)
      if (!hasValidUrls) return false
      
      // 只显示模特相关的分类: 买家秀 + 专业棚拍 + 组图
      return isBuyerShowType(g.type) || isProStudioType(g.type) || isGroupShootType(g.type)
    })
    .slice(0, 50) // 增加到50个

  // 从 sessionStorage 加载传入的图片
  useEffect(() => {
    const storedImage = sessionStorage.getItem('groupShootImage')
    if (storedImage) {
      sessionStorage.removeItem('groupShootImage')
      setSelectedImage(storedImage)
    }
  }, [])

  const numImages = shootMode === 'random' ? RANDOM_NUM_IMAGES : MULTIANGLE_NUM_IMAGES

  return (
    <div className="h-full relative flex flex-col bg-zinc-50">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      <AnimatePresence mode="wait">
        {/* Main Page - 图片选择 + 模式选择 在同一页面 */}
        {mode === "main" && (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
              <button
                onClick={() => router.push("/")}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <Home className="w-5 h-5 text-zinc-600" />
              </button>
              <span className="font-semibold text-lg ml-2">{t.home.groupShoot || '组图拍摄'}</span>
            </div>

            <div className="flex-1 overflow-y-auto pb-40">
              {/* 图片选择卡片 */}
              <div className="p-4">
                <div className={`rounded-2xl p-4 transition-colors ${
                  styleMode === 'lifestyle' 
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-100' 
                    : 'bg-gradient-to-br from-amber-50 to-orange-100'
                }`}>
                  {!selectedImage ? (
                    <div className="flex gap-3">
                      {/* 上传按钮 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 aspect-[4/5] max-h-48 border-2 border-dashed border-white/60 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-white hover:bg-white/30 transition-all bg-white/20 backdrop-blur-sm"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          styleMode === 'lifestyle' ? 'bg-blue-500' : 'bg-amber-500'
                        }`}>
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-center">
                          <p className={`font-semibold ${styleMode === 'lifestyle' ? 'text-blue-900' : 'text-amber-900'}`}>
                            {t.groupShootPage?.uploadImage || '上传图片'}
                          </p>
                          <p className={`text-xs mt-0.5 ${styleMode === 'lifestyle' ? 'text-blue-600/70' : 'text-amber-600/70'}`}>
                            {t.groupShootPage?.fromAlbum || '从相册选择'}
                          </p>
                        </div>
                      </button>
                      
                      {/* 从成片选择 */}
                      <button
                        onClick={() => setShowGalleryPicker(true)}
                        className="flex-1 aspect-[4/5] max-h-48 border-2 border-dashed border-white/60 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-white hover:bg-white/30 transition-all bg-white/20 backdrop-blur-sm"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          styleMode === 'lifestyle' ? 'bg-indigo-500' : 'bg-orange-500'
                        }`}>
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-center">
                          <p className={`font-semibold ${styleMode === 'lifestyle' ? 'text-indigo-900' : 'text-orange-900'}`}>
                            {t.groupShootPage?.selectFromPhotos || '从成片选择'}
                          </p>
                          <p className={`text-xs mt-0.5 ${styleMode === 'lifestyle' ? 'text-indigo-600/70' : 'text-orange-600/70'}`}>
                            {t.groupShootPage?.modelCategory || '模特分类'}
                          </p>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {/* 已选图片预览 - 紧凑 */}
                      <div className="relative w-24 h-32 shrink-0">
                        <div className="w-full h-full rounded-xl overflow-hidden shadow-lg ring-2 ring-white">
                          <Image src={selectedImage} alt="Selected" fill className="object-cover" />
                        </div>
                        <button
                          onClick={() => setSelectedImage(null)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      {/* 状态信息 */}
                      <div className="flex-1">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                          styleMode === 'lifestyle' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          <Check className="w-4 h-4" />
                          {t.groupShootPage?.imageSelected || '图片已选择'}
                        </div>
                        <p className={`text-xs mt-2 ${styleMode === 'lifestyle' ? 'text-blue-700/70' : 'text-amber-700/70'}`}>
                          {t.groupShootPage?.clickToReselect || '点击右上角 × 可重新选择'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 设置区域 */}
              <div className="px-4 space-y-3">
                {/* 风格选择 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStyleMode('lifestyle')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                      styleMode === 'lifestyle' 
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-200' 
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium text-sm">{t.groupShootPage?.lifestyleMode || '生活风格'}</span>
                  </button>
                  <button
                    onClick={() => setStyleMode('studio')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                      styleMode === 'studio' 
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-200' 
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="font-medium text-sm">{t.groupShootPage?.studioMode || '棚拍风格'}</span>
                  </button>
                </div>

                {/* 拍摄类型 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShootMode('random')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition-all ${
                      shootMode === 'random' 
                        ? (styleMode === 'lifestyle' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-orange-100 text-orange-700 ring-2 ring-orange-300')
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      <span className="font-medium text-sm">{t.groupShootPage?.randomShoot || '随意拍'}</span>
                    </div>
                    <p className="text-[10px] opacity-60 mt-0.5">5·{t.groupShootPage?.aiDesignPose || 'AI design pose'}</p>
                  </button>
                  <button
                    onClick={() => setShootMode('multiangle')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition-all ${
                      shootMode === 'multiangle' 
                        ? (styleMode === 'lifestyle' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-orange-100 text-orange-700 ring-2 ring-orange-300')
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Grid3X3 className="w-4 h-4" />
                      <span className="font-medium text-sm">{t.groupShootPage?.multiAngle || '多角度'}</span>
                    </div>
                    <p className="text-[10px] opacity-60 mt-0.5">4·{t.groupShootPage?.frontBackLeftRight || 'Front/Back/L/R'}</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Fixed Bottom Button - 参考商品影棚样式 */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto z-40">
              <button
                onClick={handleStartGeneration}
                disabled={!selectedImage}
                className={`w-full h-12 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                  selectedImage 
                    ? (styleMode === 'lifestyle' 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200')
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span>{t.camera.startShoot} ({numImages})</span>
              </button>
            </div>

            <BottomNav forceShow />
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
              <div className={`absolute inset-0 blur-xl rounded-full animate-pulse ${
                styleMode === 'lifestyle' ? 'bg-blue-500/20' : 'bg-amber-500/20'
              }`} />
              <Loader2 className={`w-16 h-16 animate-spin relative z-10 ${
                styleMode === 'lifestyle' ? 'text-blue-500' : 'text-amber-500'
              }`} />
            </div>
            
            <h3 className="text-white text-2xl font-bold mb-2">
              {styleMode === 'lifestyle' ? 'AI 正在创作ins风格组图...' : 'AI 正在创作专业展示图...'}
            </h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              {shootMode === 'random' ? (
                <>
                  <p>分析图片特征</p>
                  <p>设计{styleMode === 'lifestyle' ? '生活化' : '电商展示'}pose</p>
                  <p>生成5张多样化图片...</p>
                </>
              ) : (
                <>
                  <p>分析模特姿态</p>
                  <p>生成正面、侧面、背面...</p>
                </>
              )}
            </div>
            
            {/* Progress dots */}
            <div className="flex gap-2">
              {Array.from({ length: numImages }).map((_, i) => {
                const task = tasks.find(t => t.id === currentTaskId)
                const slot = task?.imageSlots?.[i]
                const status = slot?.status || 'pending'
                return (
                  <div 
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'generating' ? `${styleMode === 'lifestyle' ? 'bg-blue-500' : 'bg-amber-500'} animate-pulse` :
                      status === 'failed' ? 'bg-red-500' :
                      'bg-zinc-600'
                    }`}
                  />
                )
              })}
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
            <div className="h-14 flex items-center px-4 border-b bg-white z-10 shrink-0">
              <button 
                onClick={handleReselect} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold ml-2">
                {styleMode === 'lifestyle' ? '生活风格' : '棚拍风格'} · {shootMode === 'random' ? '随意拍' : '多角度'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: numImages }).map((_, i) => {
                  const task = tasks.find(t => t.id === currentTaskId)
                  const slot = task?.imageSlots?.[i]
                  const url = slot?.imageUrl || generatedImages[i]
                  const status = slot?.status || (url ? 'completed' : 'pending')
                  
                  const labels = shootMode === 'random' 
                    ? [`Pose ${i + 1}`]
                    : ['正面', '左侧', '右侧', '背面']
                  
                  if (status === 'pending' || status === 'generating') {
                    return (
                      <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                        <Loader2 className={`w-6 h-6 animate-spin mb-2 ${
                          styleMode === 'lifestyle' ? 'text-blue-400' : 'text-amber-400'
                        }`} />
                        <span className="text-[10px] text-zinc-400">{labels[i] || `图${i+1}`} 生成中...</span>
                      </div>
                    )
                  }
                  
                  if (status === 'failed' || !url) {
                    return (
                      <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                        {slot?.error || '生成失败'}
                      </div>
                    )
                  }
                  
                  return (
                    <div 
                      key={i} 
                      className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                      onClick={() => setFullscreenImage(url)}
                    >
                      <Image src={url} alt="Result" fill className="object-cover" />
                      <div className="absolute top-2 left-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${
                          styleMode === 'lifestyle' ? 'bg-blue-500' : 'bg-amber-500'
                        }`}>
                          {labels[i] || `图${i+1}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Debug Parameters - 只在调试模式显示 */}
            {debugMode && (
              <div className="mx-4 mb-4 p-4 bg-white rounded-xl border border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                <div className="flex items-start gap-4">
                  {/* 输入图 */}
                  {selectedImage && (
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                        onClick={() => setFullscreenImage(selectedImage)}
                      >
                        <img 
                          src={selectedImage} 
                          alt="输入图" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">输入图</p>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600 mt-0.5">
                        模特成片
                      </span>
                    </div>
                  )}
                  
                  {/* 模式信息 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">风格模式:</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        styleMode === 'lifestyle' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {styleMode === 'lifestyle' ? '生活风格' : '棚拍风格'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">拍摄模式:</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        shootMode === 'random' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {shootMode === 'random' ? '随意拍' : '多角度'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">生成数量:</span>
                      <span className="text-[10px] font-medium text-zinc-700">{numImages} 张</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">输入来源:</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-cyan-100 text-cyan-700">
                        从成片选择
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t max-w-md mx-auto">
              <button 
                onClick={handleReselect}
                className={`w-full h-12 text-lg rounded-xl font-semibold transition-colors ${
                  styleMode === 'lifestyle' 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                }`}
              >
                拍摄下一组
              </button>
            </div>
            
            <BottomNav forceShow />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Picker Modal - 只显示模特分类的成片 */}
      <AnimatePresence>
        {showGalleryPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowGalleryPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{t.groupShootPage?.selectFromPhotos || '从成片选择'}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{t.groupShootPage?.modelCategory || '选择模特成片'}</p>
                  </div>
                  <button onClick={() => setShowGalleryPicker(false)}>
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
                
                {/* 子分类 Tabs */}
                <div className="flex gap-2">
                  {[
                    { id: 'all', label: t.groupShootPage?.all || '全部' },
                    { id: 'buyer', label: t.groupShootPage?.buyerShow || '买家秀' },
                    { id: 'pro', label: t.groupShootPage?.proStudio || '专业棚拍' },
                    { id: 'group', label: t.groupShootPage?.groupPhoto || '组图' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setGallerySubType(tab.id as typeof gallerySubType)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        gallerySubType === tab.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  // 根据子分类过滤（与成片页面 API 逻辑保持一致）
                  const filteredGenerations = modelGenerations.filter(gen => {
                    if (gallerySubType === 'all') return true
                    if (gallerySubType === 'buyer') return isBuyerShowType(gen.type) // 买家秀
                    if (gallerySubType === 'pro') return isProStudioType(gen.type) // 专业棚拍
                    if (gallerySubType === 'group') return isGroupShootType(gen.type) // 组图
                    return true
                  })
                  
                  // 检查是否有数据在加载
                  const isLoading = !generations || generations.length === 0
                  
                  if (isLoading) {
                    return (
                      <div className="h-40 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-sm text-zinc-400">加载成片中...</p>
                      </div>
                    )
                  }
                  
                  if (filteredGenerations.length === 0) {
                    const subTypeLabel = gallerySubType === 'buyer' 
                      ? (t.groupShootPage?.buyerShow || '买家秀')
                      : gallerySubType === 'pro' 
                        ? (t.groupShootPage?.proStudio || '专业棚拍')
                        : gallerySubType === 'group' 
                          ? (t.groupShootPage?.groupPhoto || '组图')
                          : ''
                    return (
                      <div className="h-40 flex flex-col items-center justify-center text-zinc-400 text-sm gap-2">
                        <p>{t.groupShootPage?.noPhotos || '暂无成片'}{subTypeLabel && ` (${subTypeLabel})`}</p>
                        <p className="text-xs">{t.groupShootPage?.goShootFirst || '先去拍摄一些照片吧'}</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredGenerations.flatMap((gen, gi) => 
                        (gen.outputImageUrls || [])
                          .filter((url): url is string => typeof url === 'string' && url.length > 0)
                          .map((url, ui) => (
                            <button
                              key={`${gen.id || gi}-${ui}`}
                              onClick={() => handleSelectFromGallery(url, gen.type)}
                              className="aspect-square rounded-lg overflow-hidden relative hover:ring-2 hover:ring-blue-500 transition-all"
                            >
                              <Image src={url} alt="" fill className="object-cover" />
                              {/* 类型标签 */}
                              <div className="absolute bottom-1 left-1">
                                <span className={`px-1 py-0.5 rounded text-[8px] font-medium text-white ${
                                  isProStudioType(gen.type)
                                    ? 'bg-amber-500' 
                                    : isGroupShootType(gen.type)
                                      ? 'bg-cyan-500'
                                      : 'bg-blue-500'
                                }`}>
                                  {isProStudioType(gen.type) ? (t.groupShootPage?.proStudio || '棚拍') : isGroupShootType(gen.type) ? (t.groupShootPage?.groupPhoto || '组图') : (t.groupShootPage?.buyerShow || '买家秀')}
                                </span>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  )
                })()}
              </div>
            </motion.div>
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
