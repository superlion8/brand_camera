'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  Download,
  X,
  Check,
  RefreshCw,
  Globe,
  Instagram,
  ImageIcon,
  Video,
  ArrowRight,
  ChevronRight
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useTranslation } from '@/stores/languageStore'

// Helper to proxy Instagram CDN images
function getProxiedUrl(url: string | undefined): string {
  if (!url) return ''
  // Proxy Instagram CDN images that have referrer restrictions
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

interface ResultImage {
  id: string
  title: string
  url: string
}

interface Originals {
  webModelImage?: string
  productImage?: string
  insImage?: string
  videoUrl?: string
  videoPrompt?: string
}

interface Results {
  images: ResultImage[]
  video?: string
  originals?: Originals
}

// Helper to proxy Instagram CDN images (bypass referrer restrictions)
function getProxiedUrl(url: string | undefined): string {
  if (!url) return ''
  // Only proxy Instagram CDN images
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

export default function ResultsPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  const { t } = useTranslation()

  const [results, setResults] = useState<Results | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Load results
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleResults')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    
    try {
      const parsed = JSON.parse(stored)
      // Ensure images is always an array
      const normalizedResults: Results = {
        images: Array.isArray(parsed.images) ? parsed.images : [],
        video: parsed.video || undefined,
        originals: parsed.originals || {}
      }
      setResults(normalizedResults)
    } catch (error) {
      console.error('Failed to parse results:', error)
      router.replace('/brand-style')
    }
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

  // Find images by id - with safe access
  const getImageById = (id: string) => {
    if (!results?.images || !Array.isArray(results.images)) return undefined
    return results.images.find(img => img.id === id)?.url
  }

  if (!results) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const webImage1 = getImageById('web-1')
  const webImage2 = getImageById('web-2')
  const insImage1 = getImageById('ins-1')
  const insImage2 = getImageById('ins-2')
  const productImage = getImageById('product')

  // Comparison Card Component
  const ComparisonCard = ({ 
    title, 
    icon, 
    iconBg,
    originalImage, 
    originalLabel,
    generatedImages 
  }: { 
    title: string
    icon: React.ReactNode
    iconBg: string
    originalImage?: string
    originalLabel: string
    generatedImages: { url?: string; label: string }[]
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-zinc-200 overflow-hidden"
    >
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="font-semibold text-zinc-800">{title}</span>
      </div>
      
      {/* Images Row */}
      <div className="p-4">
        <div className={`flex items-center gap-2 ${isDesktop ? '' : 'overflow-x-auto pb-2'}`}>
          {/* Original Image */}
          {originalImage && (
            <>
              <div className="flex-shrink-0">
                <div className="text-xs text-zinc-500 mb-1.5 text-center">{originalLabel}</div>
                <div 
                  className={`relative bg-zinc-100 rounded-xl overflow-hidden cursor-pointer border-2 border-zinc-200 ${
                    isDesktop ? 'w-32 h-40' : 'w-24 h-32'
                  }`}
                  onClick={() => setSelectedImage(getProxiedUrl(originalImage))}
                >
                  {/* Use native img for proxied external images to avoid Next.js Image issues */}
                  <img 
                    src={getProxiedUrl(originalImage)} 
                    alt={originalLabel} 
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-zinc-700/80 rounded text-[10px] text-white">
                    {t.brandStyle.original}
                  </div>
                </div>
              </div>
              
              {/* Arrow */}
              <div className="flex-shrink-0 px-1">
                <ChevronRight className="w-5 h-5 text-zinc-300" />
              </div>
            </>
          )}
          
          {/* Generated Images */}
          {generatedImages.map((img, idx) => (
            <div key={idx} className="flex-shrink-0">
              <div className="text-xs text-zinc-500 mb-1.5 text-center">{img.label}</div>
              <div 
                className={`relative bg-zinc-100 rounded-xl overflow-hidden group ${
                  isDesktop ? 'w-32 h-40' : 'w-24 h-32'
                } ${img.url ? 'cursor-pointer border-2 border-violet-300' : ''}`}
                onClick={() => img.url && setSelectedImage(img.url)}
              >
                {img.url ? (
                  <>
                    <Image src={img.url} alt={img.label} fill className="object-cover" unoptimized />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-violet-600/90 rounded text-[10px] text-white">
                      AI生成
                    </div>
                    {/* Download on hover */}
                    {isDesktop && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(img.url!, `${img.label}.png`)
                          }}
                          className="w-8 h-8 bg-white rounded-full flex items-center justify-center"
                        >
                          <Download className="w-4 h-4 text-zinc-700" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-400">未生成</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )

  // Video Comparison Component
  const VideoComparison = ({ 
    originalUrl, 
    originalPrompt,
    generatedUrl 
  }: { 
    originalUrl?: string
    originalPrompt?: string
    generatedUrl?: string 
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-zinc-200 overflow-hidden"
    >
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
          <Video className="w-4 h-4 text-red-600" />
        </div>
        <span className="font-semibold text-zinc-800">{t.brandStyle.videoStyle}</span>
      </div>
      
      <div className="p-4">
        <div className={`flex gap-4 ${isDesktop ? '' : 'flex-col'}`}>
          {/* Original Video */}
          {originalUrl && (
            <div className="flex-1">
              <div className="text-xs text-zinc-500 mb-1.5">{t.brandStyle.original}</div>
              <div className={`relative bg-zinc-900 rounded-xl overflow-hidden ${
                isDesktop ? 'aspect-video' : 'aspect-[9/16]'
              }`}>
                <video
                  src={originalUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
                <div className="absolute top-2 left-2 px-2 py-1 bg-zinc-700/80 rounded text-xs text-white">
                  {t.brandStyle.original}
                </div>
              </div>
            </div>
          )}
          
          {/* Video Prompt (if no original video) */}
          {!originalUrl && originalPrompt && (
            <div className="flex-1">
              <div className="text-xs text-zinc-500 mb-1.5">{t.brandStyle.videoPrompt}</div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <p className="text-sm text-zinc-600 line-clamp-4">{originalPrompt}</p>
              </div>
            </div>
          )}
          
          {/* Arrow for desktop */}
          {isDesktop && (originalUrl || originalPrompt) && (
            <div className="flex items-center px-2">
              <ChevronRight className="w-6 h-6 text-zinc-300" />
            </div>
          )}
          
          {/* Generated Video */}
          <div className="flex-1">
            <div className="text-xs text-zinc-500 mb-1.5">{t.brandStyle.aiGenerated}</div>
            <div className={`relative bg-zinc-900 rounded-xl overflow-hidden ${
              isDesktop ? 'aspect-video' : 'aspect-[9/16]'
            }`}>
              {generatedUrl ? (
                <>
                  <video
                    src={generatedUrl}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-violet-600/90 rounded text-xs text-white">
                    AI生成
                  </div>
                  <button
                    onClick={() => handleDownload(generatedUrl, 'brand-video.mp4')}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                  >
                    <Download className="w-4 h-4 text-zinc-700" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm text-zinc-500">{t.brandStyle.generating}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )

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
                  <h1 className="text-lg font-semibold text-zinc-900">{t.brandStyle.resultsTitle}</h1>
                  <p className="text-sm text-zinc-500">
                    {t.brandStyle.resultsDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{t.brandStyle.allComplete}</span>
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
            <span className="font-semibold text-lg ml-2">{t.brandStyle.resultsTitle}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium text-green-700">{t.brandStyle.taskCompleted}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-32'}`}>
        <div className={`space-y-4 ${isDesktop ? 'max-w-5xl mx-auto px-8' : ''}`}>
          
          {/* Web Style Comparison */}
          <ComparisonCard
            title={t.brandStyle.websiteStyle}
            icon={<Globe className="w-4 h-4 text-blue-600" />}
            iconBg="bg-blue-100"
            originalImage={results.originals?.webModelImage}
            originalLabel={t.brandStyle.original}
            generatedImages={[
              { url: webImage1, label: `${t.brandStyle.aiGenerated} 1` },
              { url: webImage2, label: `${t.brandStyle.aiGenerated} 2` }
            ]}
          />

          {/* INS Style Comparison */}
          <ComparisonCard
            title={t.brandStyle.insStyle}
            icon={<Instagram className="w-4 h-4 text-pink-600" />}
            iconBg="bg-gradient-to-br from-purple-100 to-pink-100"
            originalImage={results.originals?.insImage}
            originalLabel={t.brandStyle.original}
            generatedImages={[
              { url: insImage1, label: `${t.brandStyle.aiGenerated} 1` },
              { url: insImage2, label: `${t.brandStyle.aiGenerated} 2` }
            ]}
          />

          {/* Product Display Comparison */}
          {(results.originals?.productImage || productImage) && (
            <ComparisonCard
              title={t.brandStyle.productStyle}
              icon={<ImageIcon className="w-4 h-4 text-amber-600" />}
              iconBg="bg-amber-100"
              originalImage={results.originals?.productImage}
              originalLabel={t.brandStyle.original}
              generatedImages={[
                { url: productImage, label: t.brandStyle.aiGenerated }
              ]}
            />
          )}

          {/* Video Comparison - only show if video data exists */}
          {(results.video || results.originals?.videoUrl || results.originals?.videoPrompt) && (
            <VideoComparison
              originalUrl={results.originals?.videoUrl}
              originalPrompt={results.originals?.videoPrompt}
              generatedUrl={results.video}
            />
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
              {t.brandStyle.newGeneration}
            </button>
            <button
              onClick={() => router.push('/gallery')}
              className="px-8 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium flex items-center gap-2 hover:from-violet-600 hover:to-purple-700 transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
              {t.nav?.gallery}
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
            {t.brandStyle.newGeneration}
          </button>
          <button
            onClick={() => router.push('/gallery')}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-5 h-5" />
            {t.nav?.gallery}
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

