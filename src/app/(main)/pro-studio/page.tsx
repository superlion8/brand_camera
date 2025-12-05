"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Wand2, Camera, Home, Heart, Download, Upload, Sparkles
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, ensureBase64 } from "@/lib/utils"
import { Asset } from "@/types"
import Image from "next/image"
import { 
  STUDIO_MODELS, 
  ALL_STUDIO_BACKGROUNDS, 
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
import Webcam from "react-webcam"

type PageMode = "camera" | "review" | "processing" | "results"

// 专业棚拍生成6张图：背景库模式2张 + 随机背景模式2张 + 扩展模式2张
const PRO_STUDIO_NUM_IMAGES = 6

export default function ProStudioPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { userProducts, userModels, userBackgrounds } = useAssetStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [isModelRandom, setIsModelRandom] = useState(true)
  const [isBgRandom, setIsBgRandom] = useState(true)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModes, setGeneratedModes] = useState<string[]>([])
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

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
    
    // 初始化图片槽位
    initImageSlots(taskId, PRO_STUDIO_NUM_IMAGES)

    // 压缩商品图
    const compressedProduct = await compressBase64Image(capturedImage, 1024)

    // 准备模特和背景
    let modelBase64: string | null = null
    let bgBase64: string | null = null

    // 获取模特图片
    const modelToUse = isModelRandom ? getRandomStudioModel() : selectedModel
    if (modelToUse) {
      modelBase64 = await ensureBase64(modelToUse.imageUrl)
    }

    // 获取背景图片（只用于背景库模式）
    const bgToUse = isBgRandom ? getRandomStudioBackground() : selectedBackground
    if (bgToUse) {
      bgBase64 = await ensureBase64(bgToUse.imageUrl)
    }

    // 生成任务配置
    const tasks = [
      // 背景库模式 x2
      { mode: 'background-lib', index: 0 },
      { mode: 'background-lib', index: 1 },
      // 随机背景模式 x2
      { mode: 'random-bg', index: 2 },
      { mode: 'random-bg', index: 3 },
      // 扩展模式 x2
      { mode: 'extended', index: 4 },
      { mode: 'extended', index: 5 },
    ]

    const results: string[] = []
    const modes: string[] = []
    let firstCompleted = false

    // 并行生成所有图片
    const promises = tasks.map(async (task) => {
      // 每张图随机选择模特（如果是随机模式）
      let taskModel = modelBase64
      let taskBg = bgBase64

      if (isModelRandom) {
        const randomModel = getRandomStudioModel()
        taskModel = await ensureBase64(randomModel.imageUrl)
      }

      if (isBgRandom && task.mode === 'background-lib') {
        const randomBg = getRandomStudioBackground()
        taskBg = await ensureBase64(randomBg.imageUrl)
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

    // 更新任务状态
    updateTaskStatus(taskId, 'completed')
  }

  // 重置
  const handleReset = () => {
    setCapturedImage(null)
    setSelectedModel(null)
    setSelectedBackground(null)
    setIsModelRandom(true)
    setIsBgRandom(true)
    setGeneratedImages([])
    setGeneratedModes([])
    setMode("camera")
  }

  // 获取模式标签
  const getModeLabel = (modeStr: string) => {
    switch (modeStr) {
      case 'background-lib': return '背景库'
      case 'random-bg': return 'AI背景'
      case 'extended': return '扩展模式'
      default: return modeStr
    }
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md z-20">
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

      {/* Camera Mode */}
      {mode === "camera" && (
        <div className="flex-1 relative">
          {hasCamera ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              className="absolute inset-0 w-full h-full object-cover"
              videoConstraints={{ facingMode: "environment" }}
              onUserMediaError={() => setHasCamera(false)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-800">
              <Camera className="w-16 h-16 text-zinc-500 mb-4" />
              <p className="text-zinc-400 text-center px-8">
                无法访问相机，请上传商品图片
              </p>
            </div>
          )}

          {/* Capture Button */}
          <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-4">
            {hasCamera && (
              <button
                onClick={handleCapture}
                className="w-20 h-20 rounded-full bg-white border-4 border-amber-400 active:scale-95 transition-transform"
              />
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <Upload className="w-6 h-6 text-white" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Review Mode */}
      {mode === "review" && capturedImage && (
        <div className="flex-1 flex flex-col">
          {/* Preview */}
          <div className="flex-1 relative bg-black">
            <Image
              src={capturedImage}
              alt="Captured"
              fill
              className="object-contain"
            />
          </div>

          {/* Options */}
          <div className="bg-zinc-900 p-4 space-y-4">
            {/* Model Selection */}
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">模特</span>
              <button
                onClick={() => setShowModelPicker(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg"
              >
                {isModelRandom ? (
                  <span className="text-amber-400 text-sm">随机选择</span>
                ) : selectedModel ? (
                  <>
                    <img src={selectedModel.imageUrl} className="w-6 h-6 rounded object-cover" />
                    <span className="text-white text-sm">{selectedModel.name}</span>
                  </>
                ) : (
                  <span className="text-zinc-400 text-sm">选择模特</span>
                )}
              </button>
            </div>

            {/* Background Selection */}
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">背景 (背景库模式)</span>
              <button
                onClick={() => setShowBgPicker(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg"
              >
                {isBgRandom ? (
                  <span className="text-amber-400 text-sm">随机选择</span>
                ) : selectedBackground ? (
                  <>
                    <img src={selectedBackground.imageUrl} className="w-6 h-6 rounded object-cover" />
                    <span className="text-white text-sm">{selectedBackground.name}</span>
                  </>
                ) : (
                  <span className="text-zinc-400 text-sm">选择背景</span>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-zinc-800 text-white rounded-xl"
              >
                重拍
              </button>
              <button
                onClick={handleShootIt}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Wand2 className="w-5 h-5" />
                Shoot It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Mode */}
      {mode === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-amber-900 to-zinc-900">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
            </div>
          </div>
          <p className="mt-6 text-white font-medium">AI 正在生成专业棚拍图...</p>
          <p className="mt-2 text-amber-300/70 text-sm">预计需要 30-60 秒</p>
        </div>
      )}

      {/* Results Mode */}
      {mode === "results" && (
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="p-4">
            <h2 className="text-white font-semibold mb-4">生成结果</h2>
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map((img, i) => (
                img && (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800"
                    onClick={() => setFullscreenImage(img)}
                  >
                    <Image src={img} alt={`Result ${i + 1}`} fill className="object-cover" />
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-amber-500 text-white text-xs rounded">
                        {getModeLabel(generatedModes[i])}
                      </span>
                    </div>
                  </motion.div>
                )
              ))}
              {/* Loading placeholders */}
              {Array(PRO_STUDIO_NUM_IMAGES - generatedImages.filter(Boolean).length).fill(null).map((_, i) => (
                <div key={`loading-${i}`} className="aspect-[3/4] rounded-xl bg-zinc-800 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-zinc-800 text-white rounded-xl"
              >
                重新拍摄
              </button>
              <button
                onClick={() => router.push('/gallery')}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl"
              >
                查看图库
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Picker Modal */}
      <AnimatePresence>
        {showModelPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex flex-col"
          >
            <div className="h-14 flex items-center justify-between px-4 bg-zinc-900">
              <button onClick={() => setShowModelPicker(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
              <span className="text-white font-semibold">选择模特</span>
              <button
                onClick={() => {
                  setIsModelRandom(true)
                  setSelectedModel(null)
                  setShowModelPicker(false)
                }}
                className="text-amber-400 text-sm"
              >
                随机
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {STUDIO_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model)
                      setIsModelRandom(false)
                      setShowModelPicker(false)
                    }}
                    className={`aspect-[3/4] rounded-xl overflow-hidden border-2 ${
                      selectedModel?.id === model.id ? 'border-amber-400' : 'border-transparent'
                    }`}
                  >
                    <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Picker Modal */}
      <AnimatePresence>
        {showBgPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex flex-col"
          >
            <div className="h-14 flex items-center justify-between px-4 bg-zinc-900">
              <button onClick={() => setShowBgPicker(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
              <span className="text-white font-semibold">选择背景</span>
              <button
                onClick={() => {
                  setIsBgRandom(true)
                  setSelectedBackground(null)
                  setShowBgPicker(false)
                }}
                className="text-amber-400 text-sm"
              >
                随机
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {ALL_STUDIO_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => {
                      setSelectedBackground(bg)
                      setIsBgRandom(false)
                      setShowBgPicker(false)
                    }}
                    className={`aspect-square rounded-xl overflow-hidden border-2 ${
                      selectedBackground?.id === bg.id ? 'border-amber-400' : 'border-transparent'
                    }`}
                  >
                    <img src={bg.imageUrl} alt={bg.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
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

