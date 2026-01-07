'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Globe, 
  Instagram, 
  Video, 
  ImageIcon,
  Check,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'

interface AnalysisStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: {
    images?: string[]
    selectedImage?: string
    text?: string
    videoPrompt?: string
  }
  error?: string
}

export default function AnalyzingPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  const abortControllerRef = useRef<AbortController | null>(null)

  const [steps, setSteps] = useState<AnalysisStep[]>([
    {
      id: 'product-page',
      title: '分析商品页面',
      description: '读取网页内容，提取商品图片和品牌信息',
      icon: <Globe className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'instagram',
      title: '分析 Instagram',
      description: '获取帖子图片，找到最佳模特展示图',
      icon: <Instagram className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'video',
      title: '分析短视频',
      description: '下载视频并反推创作提示词',
      icon: <Video className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'summary',
      title: '生成品牌风格摘要',
      description: '综合分析，提取品牌风格关键词',
      icon: <ImageIcon className="w-5 h-5" />,
      status: 'pending'
    }
  ])

  const [currentStep, setCurrentStep] = useState(0)
  const [inputData, setInputData] = useState<{
    productPageUrl: string
    instagramUrl: string
    videoUrl: string
    productImage: string
  } | null>(null)

  // Load input data from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleInput')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    setInputData(JSON.parse(stored))
  }, [router])

  // Start analysis when input data is loaded
  useEffect(() => {
    if (!inputData) return
    
    abortControllerRef.current = new AbortController()
    runAnalysis()
    
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [inputData])

  const updateStep = (stepId: string, updates: Partial<AnalysisStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }

  const runAnalysis = async () => {
    if (!inputData) return
    const signal = abortControllerRef.current?.signal

    try {
      // Step 1: Analyze product page
      setCurrentStep(0)
      updateStep('product-page', { status: 'processing' })
      
      const productPageRes = await fetch('/api/brand-style/read-product-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputData.productPageUrl }),
        signal
      })
      
      if (!productPageRes.ok) throw new Error('Failed to analyze product page')
      const productPageData = await productPageRes.json()
      
      updateStep('product-page', { 
        status: 'completed',
        result: {
          images: productPageData.images,
          selectedImage: productPageData.modelImage,
          text: productPageData.brandSummary
        }
      })

      // Step 2: Analyze Instagram
      setCurrentStep(1)
      updateStep('instagram', { status: 'processing' })
      
      const instagramRes = await fetch('/api/brand-style/read-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputData.instagramUrl }),
        signal
      })
      
      if (!instagramRes.ok) throw new Error('Failed to analyze Instagram')
      const instagramData = await instagramRes.json()
      
      updateStep('instagram', { 
        status: 'completed',
        result: {
          images: instagramData.images,
          selectedImage: instagramData.bestModelImage
        }
      })

      // Step 3: Analyze video
      setCurrentStep(2)
      updateStep('video', { status: 'processing' })
      
      const videoRes = await fetch('/api/brand-style/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputData.videoUrl }),
        signal
      })
      
      if (!videoRes.ok) throw new Error('Failed to analyze video')
      const videoData = await videoRes.json()
      
      updateStep('video', { 
        status: 'completed',
        result: {
          videoPrompt: videoData.prompt
        }
      })

      // Step 4: Generate summary
      setCurrentStep(3)
      updateStep('summary', { status: 'processing' })
      
      const summaryRes = await fetch('/api/brand-style/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productPageData,
          instagramData,
          videoData
        }),
        signal
      })
      
      if (!summaryRes.ok) throw new Error('Failed to generate summary')
      const summaryData = await summaryRes.json()
      
      updateStep('summary', { 
        status: 'completed',
        result: {
          text: summaryData.summary
        }
      })

      // Store results and navigate to confirm page
      sessionStorage.setItem('brandStyleAnalysis', JSON.stringify({
        productPage: productPageData,
        instagram: instagramData,
        video: videoData,
        summary: summaryData,
        productImage: inputData.productImage
      }))
      
      router.push('/brand-style/confirm')

    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      
      console.error('Analysis error:', error)
      const currentStepData = steps[currentStep]
      if (currentStepData) {
        updateStep(currentStepData.id, { 
          status: 'error',
          error: (error as Error).message
        })
      }
    }
  }

  const getStatusIcon = (status: AnalysisStep['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />
      case 'processing':
        return <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-zinc-300" />
    }
  }

  const completedCount = steps.filter(s => s.status === 'completed').length
  const progress = (completedCount / steps.length) * 100

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-3xl mx-auto px-8 py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">正在分析品牌风格</h1>
                <p className="text-sm text-zinc-500">请稍候，AI 正在分析您的品牌素材...</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <span className="font-semibold text-lg ml-2">分析中...</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="h-1 bg-zinc-200">
        <motion.div 
          className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4'}`}>
        <div className={`space-y-4 ${isDesktop ? 'max-w-3xl mx-auto px-8' : ''}`}>
          
          {/* Product Image Preview */}
          {inputData?.productImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-4 border border-zinc-200"
            >
              <p className="text-sm text-zinc-500 mb-3">待生成商品</p>
              <div className="relative h-32 rounded-xl overflow-hidden bg-zinc-100">
                <Image 
                  src={inputData.productImage} 
                  alt="Product" 
                  fill 
                  className="object-contain"
                  unoptimized
                />
              </div>
            </motion.div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-2xl p-4 border transition-all ${
                  step.status === 'processing' 
                    ? 'border-violet-300 ring-2 ring-violet-100' 
                    : step.status === 'error'
                    ? 'border-red-300'
                    : 'border-zinc-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    step.status === 'completed' ? 'bg-green-100 text-green-600' :
                    step.status === 'processing' ? 'bg-violet-100 text-violet-600' :
                    step.status === 'error' ? 'bg-red-100 text-red-600' :
                    'bg-zinc-100 text-zinc-400'
                  }`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold ${
                        step.status === 'pending' ? 'text-zinc-400' : 'text-zinc-900'
                      }`}>
                        {step.title}
                      </h3>
                      {getStatusIcon(step.status)}
                    </div>
                    <p className={`text-sm mt-0.5 ${
                      step.status === 'pending' ? 'text-zinc-300' : 'text-zinc-500'
                    }`}>
                      {step.error || step.description}
                    </p>
                    
                    {/* Result Preview */}
                    <AnimatePresence>
                      {step.status === 'completed' && step.result?.selectedImage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3"
                        >
                          <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-zinc-100">
                            <Image 
                              src={step.result.selectedImage} 
                              alt="Result" 
                              fill 
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </motion.div>
                      )}
                      {step.status === 'completed' && step.result?.videoPrompt && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 bg-zinc-50 rounded-lg"
                        >
                          <p className="text-xs text-zinc-600 line-clamp-2">
                            {step.result.videoPrompt}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-4"
          >
            <p className="text-sm text-zinc-400">
              分析过程大约需要 1-2 分钟，请耐心等待
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

