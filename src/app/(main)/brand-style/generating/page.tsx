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
import { useTranslation } from '@/stores/languageStore'

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
  const { t } = useTranslation()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Load analysis data
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleAnalysis')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    const data = JSON.parse(stored)
    setAnalysisData(data)
  }, [router])

  // Start generation when analysis data is loaded
  useEffect(() => {
    if (!analysisData || isGenerating) return
    
    setIsGenerating(true)
    abortControllerRef.current = new AbortController()
    runBatchGeneration()
    
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [analysisData])

  const runBatchGeneration = async () => {
    if (!analysisData) return
    const signal = abortControllerRef.current?.signal

    try {
      const response = await fetch('/api/brand-style/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisData }),
        signal
      })

      if (!response.ok) {
        throw new Error('Failed to start generation')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response stream')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Parse SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleStreamEvent(data)
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      console.error('[Generate] Batch generation failed:', error)
    }
  }

  const handleStreamEvent = (event: any) => {
    switch (event.type) {
      case 'init':
        // Initialize tasks from server
        setTasks(event.tasks.map((t: any) => ({
          ...t,
          status: 'pending'
        })))
        break
        
      case 'progress':
        // Update task status
        setTasks(prev => prev.map(task => 
          task.id === event.taskId
            ? { ...task, status: event.status, result: event.result, error: event.error }
            : task
        ))
        break
        
      case 'complete':
        // Store results and navigate
        console.log('[Generate] All done, results:', event.results)
        sessionStorage.setItem('brandStyleResults', JSON.stringify(event.results))
        router.push('/brand-style/results')
        break
        
      case 'error':
        console.error('[Generate] Error:', event.error)
        break
    }
  }

  const completedCount = tasks.filter(t => t.status === 'completed').length
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0

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
                  {t.brandStyle.completedCount?.replace('{completed}', String(completedCount)).replace('{total}', String(tasks.length)) || `已完成 ${completedCount}/${tasks.length} 项`}
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
