'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
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
import { useTranslation } from '@/stores/languageStore'

interface GenerationTask {
  id: string
  type: 'image' | 'video'
  status: 'pending' | 'generating' | 'completed' | 'error'
  result?: string
  error?: string
}

export default function GeneratingPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  const { t } = useTranslation()

  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const resultsRef = useRef<{ images: { id: string; url: string }[]; video?: string }>({ images: [] })

  // Load analysis data and build task list
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleAnalysis')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    const data = JSON.parse(stored)
    setAnalysisData(data)

    // Build task list based on available data
    const taskList: GenerationTask[] = []
    
    if (data.productPage?.modelImage) {
      taskList.push({ id: 'web-1', type: 'image', status: 'pending' })
      taskList.push({ id: 'web-2', type: 'image', status: 'pending' })
    }
    
    if (data.instagram?.bestModelImage) {
      taskList.push({ id: 'ins-1', type: 'image', status: 'pending' })
      taskList.push({ id: 'ins-2', type: 'image', status: 'pending' })
    }
    
    if (data.productPage?.productImage) {
      taskList.push({ id: 'product', type: 'image', status: 'pending' })
    }
    
    if (data.video?.prompt) {
      taskList.push({ id: 'video', type: 'video', status: 'pending' })
    }

    setTasks(taskList)
  }, [router])

  // Start all generations in parallel when tasks are ready
  useEffect(() => {
    if (!analysisData || tasks.length === 0 || isStarted) return
    setIsStarted(true)

    // Start all image generations in parallel
    tasks.forEach(task => {
      if (task.type === 'image') {
        generateImage(task.id)
      } else if (task.type === 'video') {
        generateVideo(task.id)
      }
    })
  }, [analysisData, tasks, isStarted])

  // Generate single image
  const generateImage = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'generating' } : t))

    try {
      // Determine image type and reference
      let imageType: string
      let referenceImage: string

      if (taskId.startsWith('web-')) {
        imageType = 'web'
        referenceImage = analysisData.productPage.modelImage
      } else if (taskId.startsWith('ins-')) {
        imageType = 'ins'
        referenceImage = analysisData.instagram.bestModelImage
      } else {
        imageType = 'product'
        referenceImage = analysisData.productPage.productImage
      }

      const res = await fetch('/api/brand-style/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: analysisData.productImage,
          referenceImage,
          type: imageType,
          brandSummary: analysisData.summary?.summary || '',
          styleKeywords: analysisData.summary?.styleKeywords || []
        })
      })

      const data = await res.json()
      
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Generation failed')
      }

      // Update task and store result
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed', result: data.imageUrl } : t
      ))
      resultsRef.current.images.push({ id: taskId, url: data.imageUrl })

    } catch (error) {
      console.error(`[Generate] ${taskId} failed:`, error)
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'error', error: (error as Error).message } : t
      ))
    }
  }

  // Generate video (with polling)
  const generateVideo = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'generating' } : t))

    try {
      // Start video job
      const res = await fetch('/api/brand-style/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: analysisData.productImage,
          prompt: analysisData.video.prompt,
          brandSummary: analysisData.summary?.summary || ''
        })
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Video generation failed')
      }

      if (data.videoJobId) {
        // Poll for completion
        pollVideoStatus(data.videoJobId, taskId)
      } else if (data.videoUrl) {
        // Direct result (shouldn't happen but handle it)
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: 'completed', result: data.videoUrl } : t
        ))
        resultsRef.current.video = data.videoUrl
      } else {
        throw new Error('No video job ID returned')
      }

    } catch (error) {
      console.error(`[Generate] ${taskId} failed:`, error)
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'error', error: (error as Error).message } : t
      ))
    }
  }

  // Poll video status
  const pollVideoStatus = async (videoJobId: string, taskId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/brand-style/video-status?videoId=${videoJobId}`)
        const data = await res.json()

        if (data.status === 'completed' && data.videoUrl) {
          setTasks(prev => prev.map(t => 
            t.id === taskId ? { ...t, status: 'completed', result: data.videoUrl } : t
          ))
          resultsRef.current.video = data.videoUrl
        } else if (data.status === 'failed') {
          setTasks(prev => prev.map(t => 
            t.id === taskId ? { ...t, status: 'error', error: data.error || 'Video failed' } : t
          ))
        } else {
          // Still in progress, poll again
          setTimeout(poll, 5000)
        }
      } catch (error) {
        console.error('[Video Poll] Error:', error)
        setTimeout(poll, 5000) // Retry on error
      }
    }

    poll()
  }

  // Navigate to results when all tasks are done
  useEffect(() => {
    if (tasks.length === 0) return

    const allDone = tasks.every(t => t.status === 'completed' || t.status === 'error')
    
    if (allDone) {
      // Build final results
      const finalResults = {
        images: resultsRef.current.images,
        video: resultsRef.current.video,
        originals: {
          webModelImage: analysisData?.productPage?.modelImage,
          productImage: analysisData?.productPage?.productImage,
          insImage: analysisData?.instagram?.bestModelImage,
          videoUrl: analysisData?.video?.videoUrl,
          videoPrompt: analysisData?.video?.prompt
        }
      }

      console.log('[Generate] All done, navigating...', finalResults)
      sessionStorage.setItem('brandStyleResults', JSON.stringify(finalResults))
      router.push('/brand-style/results')
    }
  }, [tasks, analysisData, router])

  const completedCount = tasks.filter(t => t.status === 'completed').length
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0

  // Get translated task title based on task ID
  const getTaskTitle = (taskId: string): string => {
    const titleMap: Record<string, string> = {
      'web-1': `${t.brandStyle.webStyleImage} 1`,
      'web-2': `${t.brandStyle.webStyleImage} 2`,
      'ins-1': `${t.brandStyle.insStyleImage} 1`,
      'ins-2': `${t.brandStyle.insStyleImage} 2`,
      'product': t.brandStyle.productDisplayImage,
      'video': t.brandStyle.ugcVideo,
    }
    return titleMap[taskId] || taskId
  }

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
                <h1 className="text-lg font-semibold text-zinc-900">{t.brandStyle.generatingTitle}</h1>
                <p className="text-sm text-zinc-500">
                  {t.brandStyle.completedCount?.replace('{completed}', String(completedCount)).replace('{total}', String(tasks.length)) || `Completed ${completedCount}/${tasks.length}`}
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
            <span className="font-semibold">{t.brandStyle.generating}</span>
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
          <div className="grid grid-cols-2 gap-4">
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
                <div className={`aspect-[9/16] relative ${
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
                        <Image src={task.result} alt={getTaskTitle(task.id)} fill className="object-cover" unoptimized />
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
                      <p className="text-sm text-zinc-500 mt-3">{t.brandStyle.generating}</p>
                    </div>
                  ) : task.status === 'error' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-red-500">{t.brandStyle.generationFailed || '生成失败'}</p>
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
                    <span className="text-sm font-medium text-zinc-700">{getTaskTitle(task.id)}</span>
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
              {t.brandStyle.generatingWaitMessage || '生成过程大约需要 2-3 分钟，请耐心等待'}
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                <Home className="w-5 h-5" />
                {t.brandStyle.backToHome || '返回首页'}
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
