'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  ArrowRight,
  Check,
  Globe,
  Instagram,
  Video,
  Sparkles,
  Edit3,
  ImageIcon
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'

interface AnalysisData {
  productPage: {
    images: string[]
    modelImage: string
    productImage: string | null
    brandSummary: string
    brandKeywords: string[]
  }
  instagram: {
    images: string[]
    bestModelImage: string
  }
  video: {
    prompt: string
    thumbnailUrl?: string
  }
  summary: {
    summary: string
    styleKeywords: string[]
  }
  productImage: string
}

export default function ConfirmPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Load analysis data
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleAnalysis')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    setAnalysisData(JSON.parse(stored))
  }, [router])

  const handleGenerate = async () => {
    setIsGenerating(true)
    router.push('/brand-style/generating')
  }

  if (!analysisData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-600" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-zinc-900">确认分析结果</h1>
                  <p className="text-sm text-zinc-500">检查 AI 分析结果，确认后开始生成</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">分析完成</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center justify-between px-4 border-b bg-white shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <span className="font-semibold text-lg ml-2">确认结果</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium text-green-700">完成</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-32'}`}>
        <div className={`space-y-6 ${isDesktop ? 'max-w-4xl mx-auto px-8' : ''}`}>
          
          {/* Your Product */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white"
          >
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-5 h-5" />
              <h2 className="font-semibold">待生成商品</h2>
            </div>
            <div className="flex gap-4">
              <div className="relative w-24 h-32 rounded-xl overflow-hidden bg-white/20">
                <Image 
                  src={analysisData.productImage} 
                  alt="Product" 
                  fill 
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm leading-relaxed">
                  AI 将基于您的品牌风格，为这件商品生成：
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>2 张官网风格模特图</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>2 张 INS 风格模特图</span>
                  </li>
                  {analysisData.productPage.productImage && (
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>1 张商品展示图</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>1 条 UGC 风格短视频</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Analysis Results Grid */}
          <div className={`grid gap-4 ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* Web Model Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">官网模特参考</h3>
                  <p className="text-xs text-zinc-500">用于生成官网风格图</p>
                </div>
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                {analysisData.productPage.modelImage ? (
                  <Image 
                    src={analysisData.productPage.modelImage} 
                    alt="Web Model" 
                    fill 
                    className="object-cover"
                    unoptimized
                    onError={(e) => {
                      console.error('Failed to load web model image:', analysisData.productPage.modelImage)
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Globe className="w-8 h-8" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Instagram Model Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">INS 模特参考</h3>
                  <p className="text-xs text-zinc-500">用于生成 INS 风格图</p>
                </div>
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                {analysisData.instagram.bestModelImage ? (
                  <Image 
                    src={analysisData.instagram.bestModelImage} 
                    alt="Instagram Model" 
                    fill 
                    className="object-cover"
                    unoptimized
                    onError={(e) => {
                      console.error('Failed to load instagram model image:', analysisData.instagram.bestModelImage)
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Instagram className="w-8 h-8" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Product Image (if exists) */}
            {analysisData.productPage.productImage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-5 border border-zinc-200"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">商品图参考</h3>
                    <p className="text-xs text-zinc-500">用于生成纯商品展示图</p>
                  </div>
                </div>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100">
                  <Image 
                    src={analysisData.productPage.productImage} 
                    alt="Product Reference" 
                    fill 
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </motion.div>
            )}

            {/* Video Prompt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <Video className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">视频创作提示词</h3>
                  <p className="text-xs text-zinc-500">从 UGC 视频中反推</p>
                </div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl">
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {analysisData.video.prompt}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Brand Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-5 border border-zinc-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-semibold text-zinc-900">品牌风格摘要</h3>
              </div>
              <button className="text-violet-600 text-sm font-medium flex items-center gap-1 hover:text-violet-700">
                <Edit3 className="w-4 h-4" />
                编辑
              </button>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed mb-4">
              {analysisData.summary.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              {analysisData.summary.styleKeywords.map((keyword, i) => (
                <span 
                  key={i}
                  className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Generate Button */}
      {isDesktop ? (
        <div className="border-t bg-white p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg transition-all"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在准备生成...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>确认并开始生成</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t max-w-md mx-auto">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>正在准备...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>开始生成</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

