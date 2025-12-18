"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Check, Download, Heart, Loader2, Sparkles, 
  RefreshCw, AlertCircle, Share2, Save, ChevronRight, Home, X
} from "lucide-react"
import { useModelCreateStore, GeneratedModelImage } from "@/stores/modelCreateStore"
import { useAssetStore } from "@/stores/assetStore"
import { generateId, compressBase64Image } from "@/lib/utils"
import { useTranslation } from "@/stores/languageStore"

type GenerationStatus = 'idle' | 'generating-prompts' | 'generating-images' | 'completed' | 'error'

interface ImageGenStatus {
  index: number
  status: 'pending' | 'generating' | 'completed' | 'error'
  imageUrl?: string
  error?: string
}

export default function ModelCreateGenerate() {
  const router = useRouter()
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [imageStatuses, setImageStatuses] = useState<ImageGenStatus[]>([])
  const [prompts, setPrompts] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [savedImages, setSavedImages] = useState<Set<string>>(new Set())
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  const {
    productImages,
    selectedBrands,
    productDescriptions,
    selectedModels,
    generatedImages,
    setGeneratedPrompts,
    setGeneratedImages,
    reset,
  } = useModelCreateStore()
  
  const { addGeneration } = useAssetStore()
  const { t } = useTranslation()
  
  // 检查前置条件
  useEffect(() => {
    if (productImages.length === 0) {
      router.push('/model-create')
    } else if (selectedBrands.length === 0) {
      router.push('/model-create/brands')
    } else if (selectedModels.length === 0) {
      router.push('/model-create/select')
    }
  }, [productImages, selectedBrands, selectedModels, router])
  
  // 自动开始生成
  useEffect(() => {
    if (selectedModels.length > 0 && status === 'idle' && generatedImages.length === 0) {
      startGeneration()
    }
  }, [selectedModels]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // 开始生成流程
  const startGeneration = async () => {
    setStatus('generating-prompts')
    setErrorMessage('')
    
    try {
      // Step 1: Generate prompts based on selected models
      const modelImageUrls = selectedModels.map(m => m.imageUrl)
      
      const promptResponse = await fetch('/api/model-create/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedModelImages: modelImageUrls,
        }),
      })
      
      const promptData = await promptResponse.json()
      
      if (!promptData.success) {
        throw new Error(promptData.error || '生成描述失败')
      }
      
      const generatedPrompts = promptData.prompts.slice(0, 4)
      setPrompts(generatedPrompts)
      setGeneratedPrompts(generatedPrompts)
      
      // Initialize image generation status
      const initialStatuses: ImageGenStatus[] = generatedPrompts.map((_: string, i: number) => ({
        index: i,
        status: 'pending',
      }))
      setImageStatuses(initialStatuses)
      setStatus('generating-images')
      
      // Step 2: Generate images in parallel (all 4 at once)
      const results: GeneratedModelImage[] = []
      
      for (let i = 0; i < generatedPrompts.length; i += 4) {
        const batch = generatedPrompts.slice(i, i + 4)
        const batchPromises = batch.map(async (prompt: string, batchIndex: number) => {
          const actualIndex = i + batchIndex
          
          // Update status to generating
          setImageStatuses(prev => prev.map(s => 
            s.index === actualIndex ? { ...s, status: 'generating' } : s
          ))
          
          try {
            // 压缩图片以避免超过 Vercel 4.5MB API 限制
            const compressedImages = await Promise.all(
              productImages.map(img => compressBase64Image(img, 1024))
            )
            
            const imageResponse = await fetch('/api/model-create/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productImages: compressedImages,
                modelPrompt: prompt,
                productDescriptions,
              }),
            })
            
            const imageData = await imageResponse.json()
            
            if (!imageData.success) {
              throw new Error(imageData.error || '图片生成失败')
            }
            
            // Update status to completed
            setImageStatuses(prev => prev.map(s => 
              s.index === actualIndex 
                ? { ...s, status: 'completed', imageUrl: imageData.imageUrl }
                : s
            ))
            
            return {
              id: imageData.generationId || generateId(),
              imageUrl: imageData.imageUrl,
              prompt,
              isSaved: false,
            }
          } catch (err: any) {
            // Update status to error
            setImageStatuses(prev => prev.map(s => 
              s.index === actualIndex 
                ? { ...s, status: 'error', error: err.message }
                : s
            ))
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults.filter(Boolean) as GeneratedModelImage[])
        
        // Small delay between batches (if more than 4 prompts)
        if (i + 4 < generatedPrompts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      setGeneratedImages(results)
      setStatus('completed')
      
    } catch (err: any) {
      console.error('Generation error:', err)
      setErrorMessage(err.message || '生成失败，请重试')
      setStatus('error')
    }
  }
  
  // 保存到资产库
  const handleSaveToAssets = async (image: GeneratedModelImage) => {
    try {
      // Add to gallery with create_model type
      addGeneration({
        id: image.id,
        type: 'create_model',
        inputImageUrl: productImages[0],
        outputImageUrls: [image.imageUrl],
        prompt: image.prompt,
        createdAt: new Date().toISOString(),
      })
      
      setSavedImages(prev => new Set(Array.from(prev).concat(image.id)))
    } catch (err) {
      console.error('Save error:', err)
    }
  }
  
  // 下载图片
  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `custom-model-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    }
  }
  
  // 返回首页
  const handleGoHome = () => {
    reset()
    router.push('/')
  }
  
  // 重新开始
  const handleRestart = () => {
    reset()
    router.push('/model-create')
  }
  
  // Generating prompts state
  if (status === 'generating-prompts') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center">
        <div className="text-center px-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate.generatingModel}</h2>
          <p className="text-sm text-zinc-500">
            {t.modelCreate.generatingDesc}
          </p>
        </div>
      </div>
    )
  }
  
  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate.generateFailed}</h2>
          <p className="text-sm text-zinc-500 mb-6">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setStatus('idle')
                startGeneration()
              }}
              className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-violet-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.modelCreate.regenerate}</span>
            </button>
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
            >
              {t.modelCreate.returnHome}
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50 via-white to-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-violet-100/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push('/model-create/select')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-zinc-900">
              {status === 'completed' ? t.modelCreate.generateComplete : t.modelCreate.generating}
            </span>
          </div>
          <div className="w-10" />
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  status === 'completed' || step <= 4 ? 'bg-violet-600' : 'bg-zinc-200'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span className="text-violet-600">✓ {t.modelCreate.stepProduct}</span>
            <span className="text-violet-600">✓ {t.modelCreate.stepBrand}</span>
            <span className="text-violet-600">✓ {t.modelCreate.stepModel}</span>
            <span className={status === 'completed' ? 'text-violet-600 font-medium' : 'text-violet-600'}>
              {status === 'completed' ? `✓ ${t.modelCreate.stepGenerate}` : t.modelCreate.generating}
            </span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-zinc-900 mb-1">
            {status === 'completed' ? t.modelCreate.yourCustomModel : t.modelCreate.generatingCustomModel}
          </h1>
          <p className="text-sm text-zinc-500">
            {status === 'completed' 
              ? t.modelCreate.saveToAssetsHint
              : t.modelCreate.generatingDesc}
          </p>
        </div>
        
        {/* Image Grid */}
        <div className="grid grid-cols-2 gap-4">
          {imageStatuses.map((imgStatus, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100"
            >
              {imgStatus.status === 'completed' && imgStatus.imageUrl ? (
                <>
                  {/* 点击图片放大 */}
                  <div 
                    className="absolute inset-0 cursor-pointer z-10"
                    onClick={() => setZoomImage(imgStatus.imageUrl!)}
                  />
                  <Image
                    src={imgStatus.imageUrl}
                    alt={`${t.modelCreate.generatedModel} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Actions - 底部操作栏 */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent z-20">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const img = generatedImages.find((_, i) => i === index)
                          if (img) handleSaveToAssets(img)
                        }}
                        disabled={savedImages.has(generatedImages[index]?.id)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          savedImages.has(generatedImages[index]?.id)
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-zinc-900 hover:bg-zinc-100'
                        }`}
                      >
                        {savedImages.has(generatedImages[index]?.id) ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{t.modelCreate.saved}</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>{t.modelCreate.save}</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(imgStatus.imageUrl!, index)
                        }}
                        className="w-10 h-10 bg-white/90 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <Download className="w-4 h-4 text-zinc-700" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Saved Badge */}
                  {savedImages.has(generatedImages[index]?.id) && (
                    <div className="absolute top-2 right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center z-20">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </>
              ) : imgStatus.status === 'generating' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-2" />
                  <span className="text-sm text-zinc-500">{t.modelCreate.generatingImage}</span>
                </div>
              ) : imgStatus.status === 'error' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                  <span className="text-xs text-red-500 text-center">{imgStatus.error || '生成失败'}</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center mb-2">
                    <span className="text-sm font-medium text-zinc-500">{index + 1}</span>
                  </div>
                  <span className="text-sm text-zinc-400">{t.modelCreate.waiting}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
      </div>
      
      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setZoomImage(null)}
          >
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-lg aspect-[3/4] mx-4"
              onClick={e => e.stopPropagation()}
            >
              <Image
                src={zoomImage}
                alt={t.modelCreate.generatedModel}
                fill
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bottom Actions - Above bottom nav */}
      {status === 'completed' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto">
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-3.5 rounded-xl font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.modelCreate.tryAgain}</span>
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>{t.modelCreate.returnHome}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

