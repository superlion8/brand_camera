"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Check, ChevronRight, Loader2, Sparkles, RefreshCw, AlertCircle } from "lucide-react"
import { useModelCreateStore, RecommendedModel } from "@/stores/modelCreateStore"
import { compressBase64Image } from "@/lib/utils"

export default function ModelCreateSelect() {
  const router = useRouter()
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  
  const {
    productImages,
    selectedBrands,
    brandStyleAnalysis,
    recommendedModels,
    selectedModels,
    isAnalyzing,
    error,
    setAnalysisResult,
    toggleModelSelection,
    setIsAnalyzing,
    setError,
    setCurrentStep,
  } = useModelCreateStore()
  
  // 检查前置条件
  useEffect(() => {
    if (productImages.length === 0) {
      router.push('/model-create')
    } else if (selectedBrands.length === 0) {
      router.push('/model-create/brands')
    }
  }, [productImages, selectedBrands, router])
  
  // 自动分析（首次进入）
  useEffect(() => {
    if (productImages.length > 0 && selectedBrands.length > 0 && recommendedModels.length === 0 && !isAnalyzing) {
      runAnalysis()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // 运行分析
  const runAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)
    
    try {
      // 压缩图片以避免超过 Vercel 4.5MB API 限制
      const compressedImages = await Promise.all(
        productImages.map(img => compressBase64Image(img, 1024))
      )
      
      const response = await fetch('/api/model-create/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: compressedImages,
          brands: selectedBrands,
        }),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '分析失败')
      }
      
      setAnalysisResult({
        brandStyleAnalysis: data.brandStyleAnalysis,
        productDescriptions: data.productDescriptions,
        recommendedModels: data.recommendedModels,
      })
    } catch (err: any) {
      console.error('Analysis error:', err)
      setError(err.message || '分析失败，请重试')
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // 处理图片加载错误（尝试不同扩展名）
  const handleImageError = (modelId: string, currentUrl: string) => {
    // 如果已经尝试过，标记为错误
    if (imageErrors[modelId]) return
    
    // 尝试切换扩展名
    const newUrl = currentUrl.includes('.png')
      ? currentUrl.replace('.png', '.jpg')
      : currentUrl.replace('.jpg', '.png')
    
    // 更新推荐模特的图片 URL
    const updatedModels = recommendedModels.map(m =>
      m.model_id === modelId ? { ...m, imageUrl: newUrl } : m
    )
    
    setAnalysisResult({
      brandStyleAnalysis,
      productDescriptions: [],
      recommendedModels: updatedModels,
    })
    
    setImageErrors(prev => ({ ...prev, [modelId]: true }))
  }
  
  // 下一步
  const handleNext = () => {
    if (selectedModels.length >= 1) {
      setCurrentStep(4)
      router.push('/model-create/generate')
    }
  }
  
  // Loading state
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center">
        <div className="text-center px-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">AI 正在分析...</h2>
          <p className="text-sm text-zinc-500">
            正在分析你的商品和品牌风格，为你推荐最合适的模特
          </p>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">分析失败</h2>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <button
            onClick={runAnalysis}
            className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-violet-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>重新分析</span>
          </button>
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
            onClick={() => router.push('/model-create/brands')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-zinc-900">选择风格</span>
          </div>
          <button
            onClick={runAnalysis}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  step <= 3 ? 'bg-violet-600' : 'bg-zinc-200'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span className="text-violet-600">✓ 商品</span>
            <span className="text-violet-600">✓ 品牌</span>
            <span className="text-violet-600 font-medium">选风格</span>
            <span>生成</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6">
        {/* Title */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-zinc-900 mb-1">
            为你推荐的模特 ({recommendedModels.length})
          </h1>
          <p className="text-sm text-zinc-500">
            选择 1-4 个喜欢的模特，AI 将为你生成专属定制模特
          </p>
        </div>
        
        {/* Selected Count */}
        {selectedModels.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-violet-600">
              已选择 {selectedModels.length}/4
            </span>
            <div className="flex -space-x-2">
              {selectedModels.slice(0, 4).map((model) => (
                <div
                  key={model.model_id}
                  className="w-8 h-8 rounded-full border-2 border-white overflow-hidden"
                >
                  <Image
                    src={model.imageUrl}
                    alt={model.model_id}
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Model Grid */}
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {recommendedModels.map((model, index) => {
              const isSelected = selectedModels.some(m => m.model_id === model.model_id)
              return (
                <motion.button
                  key={model.model_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => toggleModelSelection(model)}
                  disabled={!isSelected && selectedModels.length >= 4}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden group transition-all ${
                    isSelected
                      ? 'ring-3 ring-violet-600 ring-offset-2'
                      : 'hover:ring-2 hover:ring-violet-200 disabled:opacity-50'
                  }`}
                >
                  <Image
                    src={model.imageUrl}
                    alt={model.model_id}
                    fill
                    className="object-cover"
                    onError={() => handleImageError(model.model_id, model.imageUrl)}
                  />
                  
                  {/* Selection Indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-7 h-7 bg-violet-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Bottom Action - Above bottom nav */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto">
        <button
          onClick={handleNext}
          disabled={selectedModels.length === 0}
          className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
            selectedModels.length > 0
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200'
              : 'bg-zinc-300 cursor-not-allowed'
          }`}
        >
          <span>下一步：生成专属模特</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

