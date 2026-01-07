'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  Download,
  Share2,
  Heart,
  Play,
  X,
  Check,
  Home,
  RefreshCw,
  Globe,
  Instagram,
  ImageIcon,
  Video
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

interface ResultImage {
  id: string
  title: string
  url: string
  type: 'web' | 'ins' | 'product'
}

interface Results {
  images: ResultImage[]
  video?: string
}

export default function ResultsPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false

  const [results, setResults] = useState<Results | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // Load results
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleResults')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    setResults(JSON.parse(stored))
  }, [router])

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'web':
        return <Globe className="w-3 h-3" />
      case 'ins':
        return <Instagram className="w-3 h-3" />
      default:
        return <ImageIcon className="w-3 h-3" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'web':
        return 'bg-blue-500'
      case 'ins':
        return 'bg-gradient-to-r from-purple-500 to-pink-500'
      default:
        return 'bg-amber-500'
    }
  }

  if (!results) {
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
          <div className="max-w-5xl mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-600" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-zinc-900">生成完成</h1>
                  <p className="text-sm text-zinc-500">
                    共生成 {results.images.length} 张图片
                    {results.video ? ' 和 1 个视频' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">全部完成</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center justify-between px-4 border-b bg-white shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <span className="font-semibold text-lg ml-2">生成结果</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium text-green-700">完成</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-32'}`}>
        <div className={`space-y-6 ${isDesktop ? 'max-w-5xl mx-auto px-8' : ''}`}>
          
          {/* Images Section */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              生成图片
            </h2>
            <div className={`grid gap-4 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {results.images.map((img, index) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative aspect-[3/4] bg-zinc-100 rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => setSelectedImage(img.url)}
                >
                  <Image src={img.url} alt={img.title} fill className="object-cover" />
                  
                  {/* Type Badge */}
                  <div className={`absolute top-2 left-2 px-2 py-1 ${getTypeColor(img.type)} rounded-full flex items-center gap-1`}>
                    {getTypeIcon(img.type)}
                    <span className="text-[10px] font-medium text-white">{img.title}</span>
                  </div>
                  
                  {/* Hover Actions */}
                  <div className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-3 transition-opacity ${
                    isDesktop ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(img.url, `${img.id}.png`)
                      }}
                      className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors"
                    >
                      <Download className="w-5 h-5 text-zinc-700" />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors"
                    >
                      <Heart className="w-5 h-5 text-zinc-700" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Video Section */}
          {results.video && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                UGC 短视频
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-2xl overflow-hidden bg-zinc-900 ${
                  isDesktop ? 'aspect-video max-w-2xl' : 'aspect-[9/16]'
                }`}
              >
                <video
                  src={results.video}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
                
                {/* Download Button */}
                <button
                  onClick={() => handleDownload(results.video!, 'brand-video.mp4')}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <Download className="w-5 h-5 text-zinc-700" />
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      {isDesktop ? (
        <div className="border-t bg-white p-4">
          <div className="max-w-5xl mx-auto flex justify-center gap-4">
            <button
              onClick={() => router.push('/brand-style')}
              className="px-8 h-12 rounded-xl border border-zinc-200 text-zinc-700 font-medium flex items-center gap-2 hover:bg-zinc-50 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              重新生成
            </button>
            <button
              onClick={() => router.push('/gallery')}
              className="px-8 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium flex items-center gap-2 hover:from-violet-600 hover:to-purple-700 transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
              查看图库
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => router.push('/brand-style')}
            className="flex-1 h-12 rounded-xl border border-zinc-200 text-zinc-700 font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            重新生成
          </button>
          <button
            onClick={() => router.push('/gallery')}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-5 h-5" />
            图库
          </button>
        </div>
      )}

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <TransformWrapper>
              <TransformComponent>
                <img 
                  src={selectedImage} 
                  alt="Zoomed" 
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </TransformComponent>
            </TransformWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

