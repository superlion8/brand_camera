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
  ArrowLeft,
  X,
  ZoomIn
} from 'lucide-react'
import Image from 'next/image'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { ScreenLoadingGuard } from '@/components/ui/ScreenLoadingGuard'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useTranslation, useLanguageStore } from '@/stores/languageStore'

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
  const { isDesktop, isLoading: screenLoading } = useIsDesktop(1024)
  const { t, language } = useTranslation()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize steps with translations
  const getInitialSteps = (): AnalysisStep[] => [
    {
      id: 'product-page',
      title: t.brandStyle.analyzeProductPage,
      description: t.brandStyle.analyzeProductPageDesc,
      icon: <Globe className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'instagram',
      title: t.brandStyle.analyzeInstagram,
      description: t.brandStyle.analyzeInstagramDesc,
      icon: <Instagram className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'video',
      title: t.brandStyle.analyzeVideo,
      description: t.brandStyle.analyzeVideoDesc,
      icon: <Video className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'summary',
      title: t.brandStyle.generateSummary,
      description: t.brandStyle.generateSummaryDesc,
      icon: <ImageIcon className="w-5 h-5" />,
      status: 'pending'
    }
  ]

  const [steps, setSteps] = useState<AnalysisStep[]>(getInitialSteps())

  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0) // 用 ref 跟踪当前步骤，避免闭包问题
  const [zoomImage, setZoomImage] = useState<string | null>(null) // 放大查看的图片
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

    // Track which steps to run based on provided URLs
    const hasProductPage = inputData.productPageUrl?.trim()
    const hasInstagram = inputData.instagramUrl?.trim()
    const hasVideo = inputData.videoUrl?.trim()

    let productPageData: any = null
    let instagramData: any = null
    let videoData: any = null

    try {
      // Step 1: Analyze product page (if URL provided)
      if (hasProductPage) {
        currentStepRef.current = 0
        setCurrentStep(0)
        updateStep('product-page', { status: 'processing' })
        
        const productPageRes = await fetch('/api/brand-style/read-product-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputData.productPageUrl, language }),
          signal
        })
        
        productPageData = await productPageRes.json()
        if (!productPageRes.ok || productPageData.error) {
          throw new Error(productPageData.error || 'Failed to analyze product page')
        }
        
        updateStep('product-page', { 
          status: 'completed',
          result: {
            images: productPageData.images,
            selectedImage: productPageData.modelImage,
            text: productPageData.brandSummary
          }
        })
      } else {
        updateStep('product-page', { status: 'completed', result: { text: 'Skipped - no URL provided' } })
      }

      // Step 2: Analyze Instagram (if URL provided)
      if (hasInstagram) {
        currentStepRef.current = 1
        setCurrentStep(1)
        updateStep('instagram', { status: 'processing' })
        
        const instagramRes = await fetch('/api/brand-style/read-instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputData.instagramUrl, language }),
          signal
        })
        
        instagramData = await instagramRes.json()
        if (!instagramRes.ok || instagramData.error) {
          throw new Error(instagramData.error || 'Failed to analyze Instagram')
        }
        
        updateStep('instagram', { 
          status: 'completed',
          result: {
            images: instagramData.images,
            selectedImage: instagramData.bestModelImage
          }
        })
      } else {
        updateStep('instagram', { status: 'completed', result: { text: 'Skipped - no URL provided' } })
      }

      // Step 3: Analyze video (if URL provided)
      if (hasVideo) {
        currentStepRef.current = 2
        setCurrentStep(2)
        updateStep('video', { status: 'processing' })
        
        const videoRes = await fetch('/api/brand-style/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputData.videoUrl, language }),
          signal
        })
        
        videoData = await videoRes.json()
        if (!videoRes.ok || videoData.error) {
          throw new Error(videoData.error || 'Failed to analyze video')
        }
        
        // Add video URL to videoData (prefer playable URL if available)
        videoData.videoUrl = videoData.playableVideoUrl || inputData.videoUrl
        
        updateStep('video', { 
          status: 'completed',
          result: {
            videoPrompt: videoData.prompt
          }
        })
      } else {
        updateStep('video', { status: 'completed', result: { text: 'Skipped - no URL provided' } })
      }

      // Step 4: Generate summary (only if we have at least some data)
      currentStepRef.current = 3
      setCurrentStep(3)
      updateStep('summary', { status: 'processing' })
      
      const summaryRes = await fetch('/api/brand-style/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productPageData: productPageData || null,
          instagramData: instagramData || null,
          videoData: videoData || null,
          language
        }),
        signal
      })
      
      const summaryData = await summaryRes.json()
      if (!summaryRes.ok || summaryData.error) {
        throw new Error(summaryData.error || 'Failed to generate summary')
      }
      
      updateStep('summary', { 
        status: 'completed',
        result: {
          text: summaryData.summary
        }
      })

      // Store results and navigate to confirm page
      // Only store essential data to avoid exceeding sessionStorage quota
      const analysisData = {
        productPage: productPageData ? {
          // Only keep first 5 images for selection
          images: (productPageData.images || []).slice(0, 5),
          modelImage: productPageData.modelImage,
          productImage: productPageData.productImage,
          brandSummary: productPageData.brandSummary,
          brandKeywords: productPageData.brandKeywords
        } : null,
        instagram: instagramData ? {
          // Only keep first 5 images for selection
          images: (instagramData.images || []).slice(0, 5),
          bestModelImage: instagramData.bestModelImage
        } : null,
        video: videoData || null,
        summary: summaryData,
        productImage: inputData.productImage
      }
      
      try {
        sessionStorage.setItem('brandStyleAnalysis', JSON.stringify(analysisData))
      } catch (storageError) {
        console.error('Storage quota exceeded, trying with minimal data')
        // If still too large, store without large arrays
        const minimalData = {
          ...analysisData,
          productPage: { ...analysisData.productPage, images: [] },
          instagram: { ...analysisData.instagram, images: [] }
        }
        sessionStorage.setItem('brandStyleAnalysis', JSON.stringify(minimalData))
      }
      
      router.push('/brand-style/confirm')

    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      
      console.error('Analysis error:', error)
      // 使用 ref 获取当前步骤，避免闭包问题
      const stepIds = ['product-page', 'instagram', 'video', 'summary']
      const failedStepId = stepIds[currentStepRef.current]
      if (failedStepId) {
        updateStep(failedStepId, { 
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

  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

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
                <h1 className="text-lg font-semibold text-zinc-900">{t.brandStyle.analyzing}</h1>
                <p className="text-sm text-zinc-500">{t.brandStyle.subtitle}</p>
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
          <span className="font-semibold text-lg ml-2">{t.brandStyle.analyzing}...</span>
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
                          <button
                            onClick={() => setZoomImage(step.result!.selectedImage!)}
                            className="relative h-20 w-20 rounded-lg overflow-hidden bg-zinc-100 group cursor-pointer"
                          >
                            {/* Use proxy for external CDN images (Instagram, etc.) */}
                            <img 
                              src={step.result.selectedImage?.includes('cdninstagram.com') || step.result.selectedImage?.includes('fbcdn.net')
                                ? `/api/image-proxy?url=${encodeURIComponent(step.result.selectedImage)}`
                                : step.result.selectedImage
                              } 
                              alt="Result" 
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                console.log('[Image] Failed to load:', step.result?.selectedImage?.slice(0, 60))
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
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

      {/* Image Zoom Modal */}
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
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <TransformWrapper>
              <TransformComponent>
                <div className="relative w-[90vw] h-[80vh]">
                  <img
                    src={zoomImage?.includes('cdninstagram.com') || zoomImage?.includes('fbcdn.net')
                      ? `/api/image-proxy?url=${encodeURIComponent(zoomImage)}`
                      : zoomImage || ''
                    }
                    alt="Zoomed"
                    className="w-full h-full object-contain"
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

