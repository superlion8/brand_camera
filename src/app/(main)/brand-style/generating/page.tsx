'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  Check,
  Loader2,
  ImageIcon,
  Video,
  Home,
  X,
  ZoomIn
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

interface GenerationTask {
  id: string
  title: string
  type: 'image' | 'video'
  status: 'pending' | 'generating' | 'completed' | 'error'
  result?: string
  error?: string
}

export default function GeneratingPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  const abortControllerRef = useRef<AbortController | null>(null)

  const [tasks, setTasks] = useState<GenerationTask[]>([
    { id: 'web-1', title: '官网风格图 1', type: 'image', status: 'pending' },
    { id: 'web-2', title: '官网风格图 2', type: 'image', status: 'pending' },
    { id: 'ins-1', title: 'INS 风格图 1', type: 'image', status: 'pending' },
    { id: 'ins-2', title: 'INS 风格图 2', type: 'image', status: 'pending' },
    { id: 'product', title: '商品展示图', type: 'image', status: 'pending' },
    { id: 'video', title: 'UGC 短视频', type: 'video', status: 'pending' },
  ])

  const [analysisData, setAnalysisData] = useState<any>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  // Use ref to store results (avoid closure issues)
  const resultsRef = useRef<{ images: { id: string; title: string; url: string }[]; video?: string }>({
    images: [],
    video: undefined
  })

  // Load analysis data
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleAnalysis')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    const data = JSON.parse(stored)
    setAnalysisData(data)
    
    // Remove product task if no product reference image
    if (!data.productPage.productImage) {
      setTasks(prev => prev.filter(t => t.id !== 'product'))
    }
  }, [router])

  // Start generation
  useEffect(() => {
    if (!analysisData) return
    
    abortControllerRef.current = new AbortController()
    runGeneration()
    
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [analysisData])

  const updateTask = (taskId: string, updates: Partial<GenerationTask>, taskTitle?: string, taskType?: 'image' | 'video') => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ))
    
    // Also update resultsRef for completed tasks (avoid closure issues when saving)
    if (updates.status === 'completed' && updates.result) {
      if (taskType === 'video' || taskId === 'video') {
        resultsRef.current.video = updates.result
      } else {
        // Add to images array if not already there
        if (!resultsRef.current.images.find(img => img.id === taskId)) {
          resultsRef.current.images.push({
            id: taskId,
            title: taskTitle || taskId,
            url: updates.result
          })
        }
      }
    }
  }

  const runGeneration = async () => {
    if (!analysisData) return
    const signal = abortControllerRef.current?.signal

    const generateImage = async (taskId: string, taskTitle: string, type: string, referenceImage: string) => {
      updateTask(taskId, { status: 'generating' })
      
      try {
        const res = await fetch('/api/brand-style/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: analysisData.productImage,
            referenceImage,
            type,
            brandSummary: analysisData.summary.summary,
            styleKeywords: analysisData.summary.styleKeywords
          }),
          signal
        })
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Generation failed')
        }
        const data = await res.json()
        
        updateTask(taskId, { status: 'completed', result: data.imageUrl }, taskTitle, 'image')
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error(`[Generate] ${taskId} failed:`, error)
        updateTask(taskId, { status: 'error', error: (error as Error).message })
      }
    }

    const generateVideo = async () => {
      updateTask('video', { status: 'generating' })
      
      try {
        const res = await fetch('/api/brand-style/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: analysisData.productImage,
            prompt: analysisData.video.prompt,
            brandSummary: analysisData.summary.summary
          }),
          signal
        })
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Video generation failed')
        }
        const data = await res.json()
        
        updateTask('video', { status: 'completed', result: data.videoUrl }, 'UGC 短视频', 'video')
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error('[Generate] video failed:', error)
        updateTask('video', { status: 'error', error: (error as Error).message })
      }
    }

    // Generate images in sequence (to avoid rate limits)
    if (analysisData?.productPage?.modelImage) {
      await generateImage('web-1', '官网风格图 1', 'web', analysisData.productPage.modelImage)
      await generateImage('web-2', '官网风格图 2', 'web', analysisData.productPage.modelImage)
    }
    
    if (analysisData?.instagram?.bestModelImage) {
      await generateImage('ins-1', 'INS 风格图 1', 'ins', analysisData.instagram.bestModelImage)
      await generateImage('ins-2', 'INS 风格图 2', 'ins', analysisData.instagram.bestModelImage)
    }
    
    if (analysisData?.productPage?.productImage) {
      await generateImage('product', '商品展示图', 'product', analysisData.productPage.productImage)
    }
    
    // Generate video last
    if (analysisData?.video) {
      await generateVideo()
    }

    // Store results from ref (not from state, to avoid closure issues)
    // Include original images for comparison display
    const fullResults = {
      ...resultsRef.current,
      originals: {
        webModelImage: analysisData?.productPage?.modelImage || undefined,
        productImage: analysisData?.productPage?.productImage || undefined,
        insImage: analysisData?.instagram?.bestModelImage || undefined,
        videoUrl: analysisData?.video?.videoUrl || undefined,
        videoPrompt: analysisData?.video?.prompt || undefined
      }
    }
    console.log('[Generate] All done, results:', fullResults)
    sessionStorage.setItem('brandStyleResults', JSON.stringify(fullResults))
    router.push('/brand-style/results')
  }

  const completedCount = tasks.filter(t => t.status === 'completed').length
  const progress = (completedCount / tasks.length) * 100

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">正在生成内容</h1>
                <p className="text-sm text-zinc-500">
                  已完成 {completedCount}/{tasks.length} 项
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mr-3">
            <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
          </div>
          <div>
            <span className="font-semibold">生成中...</span>
            <span className="text-sm text-zinc-500 ml-2">{completedCount}/{tasks.length}</span>
          </div>
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
        <div className={`${isDesktop ? 'max-w-4xl mx-auto px-8' : ''}`}>
          
          {/* Task Grid */}
          <div className={`grid gap-4 ${isDesktop ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-2xl border overflow-hidden ${
                  task.status === 'generating' 
                    ? 'border-violet-300 ring-2 ring-violet-100' 
                    : task.status === 'error'
                    ? 'border-red-300'
                    : 'border-zinc-200'
                }`}
              >
                <div className={`aspect-square relative ${
                  task.status === 'completed' && task.result 
                    ? '' 
                    : 'bg-zinc-100'
                }`}>
                  {task.status === 'completed' && task.result ? (
                    task.type === 'image' ? (
                      <button
                        onClick={() => setZoomImage(task.result!)}
                        className="w-full h-full relative group cursor-pointer"
                      >
                        <Image src={task.result} alt={task.title} fill className="object-cover" unoptimized />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : (
                      <video 
                        src={task.result} 
                        className="w-full h-full object-cover"
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                      />
                    )
                  ) : task.status === 'generating' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="relative">
                        <div className="w-12 h-12 border-4 border-violet-200 rounded-full" />
                        <div className="absolute inset-0 w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-sm text-zinc-500 mt-3">生成中...</p>
                    </div>
                  ) : task.status === 'error' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-red-500">生成失败</p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {task.type === 'video' ? (
                        <Video className="w-8 h-8 text-zinc-300" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  {task.status === 'completed' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    {task.type === 'video' ? (
                      <Video className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-zinc-400" />
                    )}
                    <span className="text-sm font-medium text-zinc-700">{task.title}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 space-y-3"
          >
            <p className="text-center text-sm text-zinc-400">
              生成过程大约需要 2-3 分钟，请耐心等待
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                <Home className="w-5 h-5" />
                返回首页
              </button>
            </div>
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
                  <Image
                    src={zoomImage}
                    alt="Zoomed"
                    fill
                    className="object-contain"
                    unoptimized
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

