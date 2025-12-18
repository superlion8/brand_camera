"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Home, Check, ZoomIn, Plus, Upload,
  Camera, Sparkles, Users, Heart
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, compressBase64Image } from "@/lib/utils"
import Image from "next/image"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { usePresetStore } from "@/stores/presetStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { Asset } from "@/types"

type PageMode = "main" | "processing" | "results"

// 生成图片数量：6 张 (2 组 × 3 张)
const SOCIAL_NUM_IMAGES = 6

function SocialPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, refreshQuota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userModels, userBackgrounds } = useAssetStore()
  const { visibleModels, visibleBackgrounds, loadPresets } = usePresetStore()
  const { debugMode } = useSettingsStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("main")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<(string | null)[]>(Array(SOCIAL_NUM_IMAGES).fill(null))
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // 加载预设
  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // 从 URL 参数恢复模式
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as PageMode)
      const savedTaskId = sessionStorage.getItem('socialTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
      }
    }
  }, [searchParams])

  // 监听任务完成
  useEffect(() => {
    if (!currentTaskId) return
    const task = tasks.find(t => t.id === currentTaskId)
    if (!task?.imageSlots) return
    
    const images = task.imageSlots.map(slot => slot.imageUrl || null)
    setGeneratedImages(images)
    
    // 检查是否有图片完成
    const hasCompleted = task.imageSlots.some(slot => slot.status === 'completed')
    if (hasCompleted && mode === 'processing') {
      setMode('results')
      router.replace('/camera/social?mode=results')
    }
  }, [currentTaskId, tasks, mode, router])

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1024)
      setProductImage(compressed)
    }
    e.target.value = ''
  }

  // 模特上传
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1024)
      setSelectedModel({
        id: 'uploaded',
        type: 'model',
        name: '上传的模特',
        imageUrl: compressed,
        tags: ['uploaded'],
      })
      setShowModelPicker(false)
    }
    e.target.value = ''
  }

  // 背景上传
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1024)
      setSelectedBackground({
        id: 'uploaded',
        type: 'background',
        name: '上传的背景',
        imageUrl: compressed,
        tags: ['uploaded'],
      })
      setShowBgPicker(false)
    }
    e.target.value = ''
  }

  // 重置
  const handleReset = () => {
    setProductImage(null)
    setSelectedModel(null)
    setSelectedBackground(null)
    setGeneratedImages(Array(SOCIAL_NUM_IMAGES).fill(null))
    setMode("main")
  }

  // 开始生成
  const handleStartGeneration = async () => {
    if (!productImage) return

    const hasQuota = await checkQuota(SOCIAL_NUM_IMAGES)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('social', productImage, {
      model: selectedModel?.name,
      background: selectedBackground?.name,
    }, SOCIAL_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, SOCIAL_NUM_IMAGES)
    
    sessionStorage.setItem('socialTaskId', taskId)
    router.replace('/camera/social?mode=processing')
    
    // 预扣配额
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: SOCIAL_NUM_IMAGES,
        taskType: 'social',
      }),
    }).then(() => {
      console.log('[Social] Reserved', SOCIAL_NUM_IMAGES, 'images for task', taskId)
      refreshQuota()
    }).catch(e => {
      console.warn('[Social] Failed to reserve quota:', e)
    })

    try {
      const response = await fetch('/api/generate-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
          modelImage: selectedModel?.imageUrl || 'random',
          backgroundImage: selectedBackground?.imageUrl || 'random',
          taskId,
        }),
      })

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
                  genMode: data.imageType === 'lifestyle' ? 'simple' : 'extended',
                })
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
      sessionStorage.removeItem('socialTaskId')
    } catch (error: any) {
      console.error('Generation error:', error)
      for (let i = 0; i < SOCIAL_NUM_IMAGES; i++) {
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
      sessionStorage.removeItem('socialTaskId')
    }
  }

  // 合并模特列表
  const allModels = [...(visibleModels || []), ...(userModels || [])]
  const allBackgrounds = [...(visibleBackgrounds || []), ...(userBackgrounds || [])]

  return (
    <div className="h-full relative flex flex-col bg-zinc-50">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      <input type="file" ref={modelUploadRef} className="hidden" accept="image/*" onChange={handleModelUpload} />
      <input type="file" ref={bgUploadRef} className="hidden" accept="image/*" onChange={handleBgUpload} />

      <AnimatePresence mode="wait">
        {/* Main Page */}
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
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <Home className="w-5 h-5 text-zinc-600" />
              </button>
              <span className="font-semibold text-lg ml-2">{t.home?.socialMode || '社媒种草'}</span>
            </div>

            <div className="flex-1 overflow-y-auto pb-32 bg-zinc-50">
              <div className="p-4 space-y-4">
                {/* 商品图上传 */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-800 mb-2">
                    {t.social?.productImage || '商品图'}
                  </h3>
                  {!productImage ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-8 h-8 text-zinc-400" />
                      <span className="text-sm text-zinc-500">{t.common?.upload || '上传图片'}</span>
                    </button>
                  ) : (
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100">
                      <Image src={productImage} alt="Product" fill className="object-cover" />
                      <button
                        onClick={() => setProductImage(null)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 模特和背景选择 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 模特选择 */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800 mb-2">
                      {t.social?.model || '模特'} 
                      <span className="text-xs text-zinc-400 font-normal ml-1">({t.common?.auto || '可选'})</span>
                    </h3>
                    <button
                      onClick={() => setShowModelPicker(true)}
                      className="w-full aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors overflow-hidden"
                    >
                      {selectedModel ? (
                        <div className="relative w-full h-full">
                          <Image src={selectedModel.imageUrl} alt="Model" fill className="object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 px-2">
                            <span className="text-xs text-white truncate">{selectedModel.name}</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Users className="w-6 h-6 text-zinc-400" />
                          <span className="text-xs text-zinc-500">{t.social?.autoSelect || '随机选择'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 背景选择 */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800 mb-2">
                      {t.social?.background || '背景'}
                      <span className="text-xs text-zinc-400 font-normal ml-1">({t.common?.auto || '可选'})</span>
                    </h3>
                    <button
                      onClick={() => setShowBgPicker(true)}
                      className="w-full aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors overflow-hidden"
                    >
                      {selectedBackground ? (
                        <div className="relative w-full h-full">
                          <Image src={selectedBackground.imageUrl} alt="Background" fill className="object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 px-2">
                            <span className="text-xs text-white truncate">{selectedBackground.name}</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-zinc-400" />
                          <span className="text-xs text-zinc-500">{t.social?.autoSelect || '随机选择'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 说明 */}
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{t.social?.description || '生成 6 张社媒风格图'}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {t.social?.descriptionDetail || '包含 4 张韩系生活感 + 2 张对镜自拍'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t z-30">
              <button
                onClick={handleStartGeneration}
                disabled={!productImage}
                className={`w-full h-12 rounded-full text-base font-semibold flex items-center justify-center gap-2 transition-colors ${
                  productImage
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                {t.social?.generate || '生成种草图'} ({SOCIAL_NUM_IMAGES})
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
            className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-pink-50 to-purple-50"
          >
            <div className="relative mb-6">
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-pink-500/30 to-purple-500/30 blur-2xl rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="w-20 h-20 rounded-full border-4 border-transparent border-t-pink-500 border-r-purple-500"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-pink-600" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-zinc-800 mb-2">{t.social?.generating || '正在生成种草图...'}</h3>
            <p className="text-sm text-zinc-500">{t.social?.generatingDesc || '6 张图片生成中，请稍候'}</p>

            {/* 进度指示 */}
            <div className="flex gap-2 mt-6">
              {Array.from({ length: SOCIAL_NUM_IMAGES }).map((_, i) => {
                const task = tasks.find(t => t.id === currentTaskId)
                const slot = task?.imageSlots?.[i]
                const isCompleted = slot?.status === 'completed'
                const isGenerating = slot?.status === 'generating'
                
                return (
                  <motion.div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      isCompleted ? 'bg-green-500' : isGenerating ? 'bg-pink-500' : 'bg-zinc-300'
                    }`}
                    animate={isGenerating ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )
              })}
            </div>

            <button
              onClick={() => router.push('/')}
              className="mt-8 px-6 py-2 bg-white rounded-full text-zinc-700 text-sm font-medium hover:bg-zinc-100 transition-colors"
            >
              <Home className="w-4 h-4 inline mr-2" />
              {t.camera?.returnHome || '返回首页'}
            </button>

            <BottomNav forceShow />
          </motion.div>
        )}

        {/* Results Mode */}
        {mode === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-zinc-50"
          >
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
              <button
                onClick={handleReset}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <span className="font-semibold text-lg ml-2">{t.social?.result || '生成结果'}</span>
            </div>

            <div className="flex-1 overflow-y-auto pb-24 p-4">
              {/* 2x3 网格 */}
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((image, index) => {
                  const task = tasks.find(t => t.id === currentTaskId)
                  const slot = task?.imageSlots?.[index]
                  const isLoading = slot?.status === 'generating' || slot?.status === 'pending'
                  const isFailed = slot?.status === 'failed'
                  const imageType = index === 2 || index === 5 ? 'mirror' : 'lifestyle'

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100"
                    >
                      {image ? (
                        <>
                          <Image 
                            src={image} 
                            alt={`Result ${index + 1}`} 
                            fill 
                            className="object-cover cursor-pointer"
                            onClick={() => setFullscreenImage(image)}
                          />
                          {/* Badge */}
                          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            imageType === 'mirror' 
                              ? 'bg-purple-500 text-white' 
                              : 'bg-pink-500 text-white'
                          }`}>
                            {imageType === 'mirror' ? '对镜自拍' : '韩系生活'}
                          </div>
                          {/* 放大按钮 */}
                          <button
                            onClick={() => setFullscreenImage(image)}
                            className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                          >
                            <ZoomIn className="w-4 h-4 text-white" />
                          </button>
                        </>
                      ) : isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                          <span className="text-xs text-zinc-500 mt-2">{t.gallery?.generating || '生成中...'}</span>
                        </div>
                      ) : isFailed ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <X className="w-6 h-6 text-red-400" />
                          <span className="text-xs text-red-500 mt-2">{slot?.error || '生成失败'}</span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-zinc-400">{t.common?.waiting || '等待中'}</span>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t z-30">
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 h-12 rounded-full bg-zinc-100 text-zinc-700 font-semibold hover:bg-zinc-200 transition-colors"
                >
                  {t.social?.newGeneration || '重新生成'}
                </button>
                <button
                  onClick={() => router.push('/gallery')}
                  className="flex-1 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  {t.social?.viewGallery || '查看成片'}
                </button>
              </div>
            </div>

            <BottomNav forceShow />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model Picker Modal */}
      <AnimatePresence>
        {showModelPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowModelPicker(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">{t.social?.selectModel || '选择模特'}</h3>
                <button onClick={() => setShowModelPicker(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="grid grid-cols-3 gap-3">
                  {/* 上传按钮 */}
                  <button
                    onClick={() => modelUploadRef.current?.click()}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-1 hover:border-blue-400"
                  >
                    <Upload className="w-6 h-6 text-zinc-400" />
                    <span className="text-xs text-zinc-500">{t.common?.upload || '上传'}</span>
                  </button>
                  {/* 随机选择 */}
                  <button
                    onClick={() => { setSelectedModel(null); setShowModelPicker(false) }}
                    className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center gap-1 ${
                      !selectedModel ? 'border-pink-500 bg-pink-50' : 'border-zinc-200'
                    }`}
                  >
                    <Sparkles className="w-6 h-6 text-pink-500" />
                    <span className="text-xs text-pink-600">{t.social?.autoSelect || '随机'}</span>
                  </button>
                  {/* 模特列表 */}
                  {allModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model); setShowModelPicker(false) }}
                      className={`aspect-[3/4] rounded-xl overflow-hidden border-2 ${
                        selectedModel?.id === model.id ? 'border-pink-500' : 'border-transparent'
                      }`}
                    >
                      <Image src={model.imageUrl} alt={model.name || ''} width={100} height={133} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Background Picker Modal */}
      <AnimatePresence>
        {showBgPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowBgPicker(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">{t.social?.selectBackground || '选择背景'}</h3>
                <button onClick={() => setShowBgPicker(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="grid grid-cols-3 gap-3">
                  {/* 上传按钮 */}
                  <button
                    onClick={() => bgUploadRef.current?.click()}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-1 hover:border-blue-400"
                  >
                    <Upload className="w-6 h-6 text-zinc-400" />
                    <span className="text-xs text-zinc-500">{t.common?.upload || '上传'}</span>
                  </button>
                  {/* 随机选择 */}
                  <button
                    onClick={() => { setSelectedBackground(null); setShowBgPicker(false) }}
                    className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center gap-1 ${
                      !selectedBackground ? 'border-pink-500 bg-pink-50' : 'border-zinc-200'
                    }`}
                  >
                    <Sparkles className="w-6 h-6 text-pink-500" />
                    <span className="text-xs text-pink-600">{t.social?.autoSelect || '随机'}</span>
                  </button>
                  {/* 背景列表 */}
                  {allBackgrounds.map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg); setShowBgPicker(false) }}
                      className={`aspect-[3/4] rounded-xl overflow-hidden border-2 ${
                        selectedBackground?.id === bg.id ? 'border-pink-500' : 'border-transparent'
                      }`}
                    >
                      <Image src={bg.imageUrl} alt={bg.name || ''} width={100} height={133} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
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
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <Image src={fullscreenImage} alt="Fullscreen" fill className="object-contain" />
            <button className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
      />
    </div>
  )
}

export default function SocialPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    }>
      <SocialPageContent />
    </Suspense>
  )
}

