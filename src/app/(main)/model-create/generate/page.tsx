"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Check, Download, Heart, Loader2, Sparkles, 
  RefreshCw, AlertCircle, Share2, Save, ChevronRight, Home
} from "lucide-react"
import { useModelCreateStore, GeneratedModelImage } from "@/stores/modelCreateStore"
import { useAssetStore } from "@/stores/assetStore"
import { generateId } from "@/lib/utils"

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
      
      // Step 2: Generate images in parallel (max 2 at a time to avoid rate limits)
      const results: GeneratedModelImage[] = []
      
      for (let i = 0; i < generatedPrompts.length; i += 2) {
        const batch = generatedPrompts.slice(i, i + 2)
        const batchPromises = batch.map(async (prompt: string, batchIndex: number) => {
          const actualIndex = i + batchIndex
          
          // Update status to generating
          setImageStatuses(prev => prev.map(s => 
            s.index === actualIndex ? { ...s, status: 'generating' } : s
          ))
          
          try {
            const imageResponse = await fetch('/api/model-create/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productImages,
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
        
        // Small delay between batches
        if (i + 2 < generatedPrompts.length) {
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
      // Add to gallery
      addGeneration({
        id: image.id,
        type: 'model_studio',
        inputImageUrl: productImages[0],
        outputImageUrls: [image.imageUrl],
        prompt: image.prompt,
        createdAt: new Date().toISOString(),
      })
      
      setSavedImages(prev => new Set([...prev, image.id]))
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
          <h2 className="text-xl font-bold text-zinc-900 mb-2">正在分析模特风格...</h2>
          <p className="text-sm text-zinc-500">
            AI 正在根据你选择的模特，生成专属定制描述
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
          <h2 className="text-xl font-bold text-zinc-900 mb-2">生成失败</h2>
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
              <span>重新生成</span>
            </button>
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
            >
              返回首页
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
              {status === 'completed' ? '生成完成' : '正在生成'}
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
            <span className="text-violet-600">✓ 商品</span>
            <span className="text-violet-600">✓ 品牌</span>
            <span className="text-violet-600">✓ 模特</span>
            <span className={status === 'completed' ? 'text-violet-600 font-medium' : 'text-violet-600'}>
              {status === 'completed' ? '✓ 完成' : '生成中'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-zinc-900 mb-1">
            {status === 'completed' ? '你的专属模特' : '正在生成专属模特...'}
          </h1>
          <p className="text-sm text-zinc-500">
            {status === 'completed' 
              ? '点击保存将模特添加到你的资产库'
              : 'AI 正在为你创建独一无二的模特形象'}
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
                  <Image
                    src={imgStatus.imageUrl}
                    alt={`生成的模特 ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                      <button
                        onClick={() => {
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
                            <span>已保存</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>保存</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(imgStatus.imageUrl!, index)}
                        className="w-10 h-10 bg-white/90 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <Download className="w-4 h-4 text-zinc-700" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Saved Badge */}
                  {savedImages.has(generatedImages[index]?.id) && (
                    <div className="absolute top-2 right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </>
              ) : imgStatus.status === 'generating' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-2" />
                  <span className="text-sm text-zinc-500">生成中...</span>
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
                  <span className="text-sm text-zinc-400">等待中...</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Completion Message */}
        {status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-900 mb-1">生成完成!</h3>
                <p className="text-sm text-green-700">
                  已为你生成 {generatedImages.length} 个专属模特，点击保存添加到资产库
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Bottom Actions */}
      {status === 'completed' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100 max-w-md mx-auto">
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-3.5 rounded-xl font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>再来一次</span>
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>返回首页</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

