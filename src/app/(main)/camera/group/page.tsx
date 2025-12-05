"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Camera, Home, Heart, Check, ZoomIn,
  Shuffle, RotateCcw, Grid3X3
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

type PageMode = "select" | "mode" | "processing" | "results"
type ShootMode = "random" | "multiangle"

// 随意拍生成5张图，多角度生成4张图
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
  const [mode, setMode] = useState<PageMode>("select")
  const [shootMode, setShootMode] = useState<ShootMode | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setSelectedImage(base64)
      setMode("mode")
    }
    e.target.value = ''
  }

  // 从图库选择
  const handleSelectFromGallery = async (imageUrl: string) => {
    setIsLoadingAssets(true)
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setSelectedImage(base64)
        setMode("mode")
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
    setShootMode(null)
    setGeneratedImages([])
    setSelectedResultIndex(null)
    setMode("select")
  }

  // 开始生成
  const handleStartGeneration = async () => {
    if (!selectedImage || !shootMode) return

    const numImages = shootMode === 'random' ? RANDOM_NUM_IMAGES : MULTIANGLE_NUM_IMAGES
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('camera', selectedImage, { shootMode }, numImages)
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
                // 更新进度状态
                updateImageSlot(taskId, data.index, { status: 'generating' })
              } else if (data.type === 'image') {
                // 收到图片
                updateImageSlot(taskId, data.index, {
                  status: 'completed',
                  imageUrl: data.image,
                  modelType: data.modelType,
                  genMode: shootMode === 'random' ? 'simple' : 'simple',
                })
                results[data.index] = data.image
                setGeneratedImages([...results])

                // 第一张完成后切换到结果页面
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
      // Mark all remaining slots as failed
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

  // 获取最近的图库图片
  const recentGalleryImages = generations
    .filter(g => g.outputImageUrls && g.outputImageUrls.length > 0)
    .flatMap(g => g.outputImageUrls)
    .slice(0, 12)

  return (
    <div className="h-full relative flex flex-col bg-black">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      <AnimatePresence mode="wait">
        {/* Select Image Mode */}
        {mode === "select" && (
          <motion.div 
            key="select"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-zinc-50"
          >
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b bg-white">
              <button
                onClick={() => router.push("/")}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <Home className="w-5 h-5 text-zinc-600" />
              </button>
              <span className="font-semibold text-lg ml-2">组图拍摄</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Upload Section */}
              <div>
                <h3 className="text-sm font-medium text-zinc-700 mb-3">上传图片</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-zinc-400" />
                  <span className="text-sm text-zinc-500">点击上传图片</span>
                </button>
              </div>

              {/* From Gallery Section */}
              {recentGalleryImages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 mb-3">从图库选择</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {isLoadingAssets && (
                      <div className="col-span-4 h-32 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                    {!isLoadingAssets && recentGalleryImages.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectFromGallery(url)}
                        className="aspect-square rounded-lg overflow-hidden relative hover:ring-2 hover:ring-blue-500 transition-all"
                      >
                        <Image src={url} alt="" fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Mode Selection */}
        {mode === "mode" && (
          <motion.div 
            key="mode"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-zinc-50"
          >
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b bg-white">
              <button
                onClick={handleReselect}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <span className="font-semibold text-lg ml-2">选择拍摄模式</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Preview Image */}
              <div className="aspect-[4/5] rounded-xl overflow-hidden relative bg-zinc-200">
                {selectedImage && (
                  <Image src={selectedImage} alt="Selected" fill className="object-cover" />
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <button
                  onClick={() => setShootMode('random')}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                    shootMode === 'random' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-zinc-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    shootMode === 'random' ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    <Shuffle className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-zinc-900">随意拍</h4>
                    <p className="text-sm text-zinc-500 mt-1">
                      AI 智能生成5种不同的pose，展示商品的多样化效果
                    </p>
                  </div>
                  {shootMode === 'random' && (
                    <div className="ml-auto">
                      <Check className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setShootMode('multiangle')}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                    shootMode === 'multiangle' 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-zinc-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    shootMode === 'multiangle' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    <Grid3X3 className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-zinc-900">多角度</h4>
                    <p className="text-sm text-zinc-500 mt-1">
                      自动生成正面、左侧、右侧、背面4个角度的展示图
                    </p>
                  </div>
                  {shootMode === 'multiangle' && (
                    <div className="ml-auto">
                      <Check className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </button>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartGeneration}
                disabled={!shootMode}
                className={`w-full h-14 rounded-xl text-lg font-semibold transition-colors ${
                  shootMode 
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800' 
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                开始拍摄 ({shootMode === 'random' ? RANDOM_NUM_IMAGES : shootMode === 'multiangle' ? MULTIANGLE_NUM_IMAGES : 0}张)
              </button>
            </div>
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
            
            <h3 className="text-white text-2xl font-bold mb-2">
              {shootMode === 'random' ? 'AI 正在创作多种风格...' : 'AI 正在生成多角度图...'}
            </h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              {shootMode === 'random' ? (
                <>
                  <p>分析图片特征</p>
                  <p>生成5种不同的pose指令</p>
                  <p>创作多样化展示图...</p>
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
              {Array.from({ length: shootMode === 'random' ? RANDOM_NUM_IMAGES : MULTIANGLE_NUM_IMAGES }).map((_, i) => {
                const task = tasks.find(t => t.id === currentTaskId)
                const slot = task?.imageSlots?.[i]
                const status = slot?.status || 'pending'
                return (
                  <div 
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'generating' ? 'bg-blue-500 animate-pulse' :
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
            <div className="h-14 flex items-center px-4 border-b bg-white z-10">
              <button 
                onClick={handleReselect} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold ml-2">
                {shootMode === 'random' ? '随意拍结果' : '多角度结果'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24">
              {shootMode === 'random' ? (
                // 随意拍：5张图
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: RANDOM_NUM_IMAGES }).map((_, i) => {
                    const task = tasks.find(t => t.id === currentTaskId)
                    const slot = task?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'pending')
                    
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                          <span className="text-[10px] text-zinc-400">Pose {i + 1} 生成中...</span>
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
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500 text-white">
                            Pose {i + 1}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                // 多角度：4张图（正面、左侧、右侧、背面）
                <div className="space-y-4">
                  {/* 正面 */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-2">正面</h4>
                    {(() => {
                      const task = tasks.find(t => t.id === currentTaskId)
                      const slot = task?.imageSlots?.[0]
                      const url = slot?.imageUrl || generatedImages[0]
                      const status = slot?.status || (url ? 'completed' : 'pending')
                      
                      if (status === 'pending' || status === 'generating') {
                        return (
                          <div className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                            <span className="text-[10px] text-zinc-400">生成中...</span>
                          </div>
                        )
                      }
                      
                      if (status === 'failed' || !url) {
                        return (
                          <div className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                            {slot?.error || '生成失败'}
                          </div>
                        )
                      }
                      
                      return (
                        <div 
                          className="aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer relative"
                          onClick={() => setFullscreenImage(url)}
                        >
                          <Image src={url} alt="正面" fill className="object-cover" />
                          <div className="absolute top-2 left-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500 text-white">
                              正面
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  
                  {/* 侧面（左+右） */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-2">侧面</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2].map((idx) => {
                        const task = tasks.find(t => t.id === currentTaskId)
                        const slot = task?.imageSlots?.[idx]
                        const url = slot?.imageUrl || generatedImages[idx]
                        const status = slot?.status || (url ? 'completed' : 'pending')
                        const label = idx === 1 ? '左侧' : '右侧'
                        
                        if (status === 'pending' || status === 'generating') {
                          return (
                            <div key={idx} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                              <span className="text-[10px] text-zinc-400">{label}生成中...</span>
                            </div>
                          )
                        }
                        
                        if (status === 'failed' || !url) {
                          return (
                            <div key={idx} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                              {slot?.error || '生成失败'}
                            </div>
                          )
                        }
                        
                        return (
                          <div 
                            key={idx}
                            className="aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer relative"
                            onClick={() => setFullscreenImage(url)}
                          >
                            <Image src={url} alt={label} fill className="object-cover" />
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500 text-white">
                                {label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* 背面 */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-2">背面</h4>
                    {(() => {
                      const task = tasks.find(t => t.id === currentTaskId)
                      const slot = task?.imageSlots?.[3]
                      const url = slot?.imageUrl || generatedImages[3]
                      const status = slot?.status || (url ? 'completed' : 'pending')
                      
                      if (status === 'pending' || status === 'generating') {
                        return (
                          <div className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                            <span className="text-[10px] text-zinc-400">生成中...</span>
                          </div>
                        )
                      }
                      
                      if (status === 'failed' || !url) {
                        return (
                          <div className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                            {slot?.error || '生成失败'}
                          </div>
                        )
                      }
                      
                      return (
                        <div 
                          className="aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer relative"
                          onClick={() => setFullscreenImage(url)}
                        >
                          <Image src={url} alt="背面" fill className="object-cover" />
                          <div className="absolute top-2 left-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500 text-white">
                              背面
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pb-20 bg-white border-t shadow-up">
              <button 
                onClick={handleReselect}
                className="w-full h-12 text-lg rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                拍摄下一组
              </button>
            </div>
            
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

