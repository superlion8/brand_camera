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
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("main")
  const [styleMode, setStyleMode] = useState<StyleMode>("lifestyle")
  const [shootMode, setShootMode] = useState<ShootMode>("random")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  
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

  // 获取模特分类的图库图片（按类型分组）
  const modelGenerations = (generations || [])
    .filter(g => {
      if (!g) return false
      // 确保 outputImageUrls 是有效数组且有有效的 URL
      if (!Array.isArray(g.outputImageUrls)) return false
      const hasValidUrls = g.outputImageUrls.some(url => typeof url === 'string' && url.length > 0)
      if (!hasValidUrls) return false
      
      const type = (g.type || '').toLowerCase()
      // 只显示模特相关的分类
      return type === 'camera' || type === 'camera_model' || type === 'model' || 
             type === 'pro_studio' || type === 'prostudio' || type === 'group_shoot'
    })
    .slice(0, 20)

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

            <div className="flex-1 overflow-y-auto p-4 pb-32">
              {/* Section 1: 选择图片 */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center">1</span>
                  选择图片
                </h3>
                
                {!selectedImage ? (
                  <div className="space-y-3">
                    {/* 上传按钮 */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-28 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <ImageIcon className="w-7 h-7 text-zinc-400" />
                      <span className="text-sm text-zinc-500">点击上传图片</span>
                    </button>
                    
                    {/* 从成片选择 */}
                    <button
                      onClick={() => setShowGalleryPicker(true)}
                      className="w-full h-12 border border-zinc-200 rounded-xl flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-600">从成片选择（模特分类）</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="aspect-[4/5] rounded-xl overflow-hidden bg-zinc-200 relative">
                      <Image src={selectedImage} alt="Selected" fill className="object-cover" />
                    </div>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: 选择风格 */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center">2</span>
                  选择风格
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* 生活模式 */}
                  <button
                    onClick={() => setStyleMode('lifestyle')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      styleMode === 'lifestyle' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-zinc-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      styleMode === 'lifestyle' ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-sm text-zinc-900">生活模式</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Instagram风格</p>
                    {styleMode === 'lifestyle' && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </button>

                  {/* 棚拍模式 */}
                  <button
                    onClick={() => setStyleMode('studio')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      styleMode === 'studio' 
                        ? 'border-amber-500 bg-amber-50' 
                        : 'border-zinc-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      styleMode === 'studio' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-sm text-zinc-900">棚拍模式</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">专业电商风格</p>
                    {styleMode === 'studio' && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-amber-500" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Section 3: 选择拍摄类型 */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center">3</span>
                  选择拍摄类型
                </h3>
                
                <div className="space-y-2">
                  {/* 随意拍 */}
                  <button
                    onClick={() => setShootMode('random')}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      shootMode === 'random' 
                        ? (styleMode === 'lifestyle' ? 'border-blue-500 bg-blue-50' : 'border-amber-500 bg-amber-50')
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      shootMode === 'random' 
                        ? (styleMode === 'lifestyle' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white')
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      <Shuffle className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="font-semibold text-sm text-zinc-900">随意拍 (5张)</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {styleMode === 'lifestyle' 
                          ? 'AI设计5种ins风格pose' 
                          : 'AI设计5种电商展示pose'}
                      </p>
                    </div>
                    {shootMode === 'random' && (
                      <Check className={`w-5 h-5 ${styleMode === 'lifestyle' ? 'text-blue-500' : 'text-amber-500'}`} />
                    )}
                  </button>

                  {/* 多角度 */}
                  <button
                    onClick={() => setShootMode('multiangle')}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      shootMode === 'multiangle' 
                        ? (styleMode === 'lifestyle' ? 'border-blue-500 bg-blue-50' : 'border-amber-500 bg-amber-50')
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      shootMode === 'multiangle' 
                        ? (styleMode === 'lifestyle' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white')
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      <Grid3X3 className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="font-semibold text-sm text-zinc-900">多角度 (4张)</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">正面、左侧、右侧、背面</p>
                    </div>
                    {shootMode === 'multiangle' && (
                      <Check className={`w-5 h-5 ${styleMode === 'lifestyle' ? 'text-blue-500' : 'text-amber-500'}`} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t max-w-md mx-auto">
              <button
                onClick={handleStartGeneration}
                disabled={!selectedImage}
                className={`w-full h-14 rounded-xl text-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  selectedImage 
                    ? (styleMode === 'lifestyle' 
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600' 
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600')
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Camera className="w-5 h-5" />
                开始拍摄 ({numImages}张)
              </button>
            </div>

            <BottomNav />
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
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">从成片选择</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">仅显示模特分类的成片</p>
                </div>
                <button onClick={() => setShowGalleryPicker(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingAssets ? (
                  <div className="h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : modelGenerations.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-zinc-400 text-sm gap-2">
                    <p>暂无模特成片</p>
                    <p className="text-xs">先去拍摄一些模特照片吧</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {modelGenerations.flatMap((gen, gi) => 
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
                                gen.type === 'pro_studio' 
                                  ? 'bg-amber-500' 
                                  : gen.type === 'group_shoot'
                                    ? 'bg-cyan-500'
                                    : 'bg-blue-500'
                              }`}>
                                {gen.type === 'pro_studio' ? '专业棚拍' : gen.type === 'group_shoot' ? '组图' : '买家秀'}
                              </span>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                )}
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
