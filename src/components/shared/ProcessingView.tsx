"use client"

import { motion } from "framer-motion"
import { Loader2, Camera, Home, FolderHeart, ArrowLeft, Heart, Download } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useTranslation } from "@/stores/languageStore"
import { BottomNav } from "@/components/shared/BottomNav"
import { ReactNode } from "react"

export type ThemeColor = 'blue' | 'amber' | 'pink' | 'purple' | 'cyan'

interface ImageSlot {
  url?: string
  status: 'generating' | 'completed' | 'failed'
}

interface ProcessingViewProps {
  /** Number of images being generated */
  numImages: number
  
  /** Generated images array - can be sparse */
  generatedImages: (string | undefined)[]
  
  /** Image slots with status (optional, for more detailed status) */
  imageSlots?: ImageSlot[]
  
  /** Theme color for accents */
  themeColor?: ThemeColor
  
  /** Title text shown in header */
  title: string
  
  /** Mobile loading title */
  mobileTitle?: string
  
  /** Mobile status lines */
  mobileStatusLines?: ReactNode[]
  
  /** Grid columns (default: 4) */
  gridCols?: 2 | 3 | 4
  
  /** Image aspect ratio (default: '3/4') */
  aspectRatio?: '3/4' | '1/1'
  
  /** Show progress dots indicator on mobile */
  showProgressDots?: boolean
  
  /** Callback when "Shoot More" / "Retake" is clicked */
  onShootMore?: () => void
  
  /** Callback when "Return Home" is clicked */
  onReturnHome?: () => void
  
  /** Callback when "Go to Gallery" is clicked */
  onGoToGallery?: () => void
  
  /** Callback when download button is clicked */
  onDownload?: (url: string, index: number) => void
  
  /** Custom shoot more button text */
  shootMoreText?: string
  
  /** Custom return home button text */
  returnHomeText?: string
  
  /** Show bottom nav on mobile (default: true) */
  showBottomNav?: boolean
  
  /** Custom icon for shoot more button */
  shootMoreIcon?: ReactNode
}

const themeColors: Record<ThemeColor, { 
  spinner: string
  button: string
  glow: string
  dot: string
}> = {
  blue: { 
    spinner: 'text-blue-500', 
    button: 'bg-blue-600 hover:bg-blue-700', 
    glow: 'bg-blue-500/20',
    dot: 'bg-blue-500'
  },
  amber: { 
    spinner: 'text-amber-500', 
    button: 'bg-amber-500 hover:bg-amber-600', 
    glow: 'bg-amber-500/20',
    dot: 'bg-amber-500'
  },
  pink: { 
    spinner: 'text-pink-500', 
    button: 'bg-pink-500 hover:bg-pink-600', 
    glow: 'bg-pink-500/20',
    dot: 'bg-pink-500'
  },
  purple: { 
    spinner: 'text-purple-500', 
    button: 'bg-purple-600 hover:bg-purple-700', 
    glow: 'bg-purple-500/20',
    dot: 'bg-purple-500'
  },
  cyan: { 
    spinner: 'text-cyan-500', 
    button: 'bg-cyan-500 hover:bg-cyan-600', 
    glow: 'bg-cyan-500/20',
    dot: 'bg-cyan-500'
  },
}

const gridColsClass: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

const aspectRatioClass: Record<'3/4' | '1/1', string> = {
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
}

export function ProcessingView({
  numImages,
  generatedImages,
  imageSlots,
  themeColor = 'blue',
  title,
  mobileTitle,
  mobileStatusLines = [],
  gridCols = 4,
  aspectRatio = '3/4',
  showProgressDots = false,
  onShootMore,
  onReturnHome,
  onGoToGallery,
  onDownload,
  shootMoreText,
  returnHomeText,
  showBottomNav = true,
  shootMoreIcon,
}: ProcessingViewProps) {
  const router = useRouter()
  const { isDesktop } = useIsDesktop()
  const { t } = useTranslation()
  const colors = themeColors[themeColor]

  const handleGoToGallery = () => {
    if (onGoToGallery) {
      onGoToGallery()
    } else {
      router.push('/gallery')
    }
  }

  const getSlotStatus = (index: number): 'generating' | 'completed' | 'failed' => {
    if (imageSlots?.[index]) {
      return imageSlots[index].status
    }
    return generatedImages[index] ? 'completed' : 'generating'
  }

  return (
    <motion.div 
      key="processing"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className={`flex-1 flex flex-col ${isDesktop ? 'bg-zinc-50' : 'bg-zinc-950 items-center justify-center p-8 text-center'}`}
    >
      {isDesktop ? (
        /* PC Web: Skeleton grid layout */
        <>
          <div className="bg-white border-b border-zinc-200">
            <div className="max-w-4xl mx-auto px-8 py-4">
              <div className="flex items-center justify-between">
                {onShootMore ? (
                  <button onClick={onShootMore} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    <span>{shootMoreText || t.camera?.shootNew || 'Shoot More'}</span>
                  </button>
                ) : (
                  <div className="w-20" />
                )}
                <span className="font-bold text-zinc-900">{title}</span>
                <div className="w-20" />
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-8">
            <div className="max-w-4xl mx-auto px-8">
              <div className={`grid ${gridColsClass[gridCols]} gap-3`}>
                {Array.from({ length: numImages }).map((_, i) => {
                  const url = generatedImages[i]
                  const status = getSlotStatus(i)
                  
                  return (
                    <div key={i} className={`${aspectRatioClass[aspectRatio]} rounded-xl bg-zinc-200 overflow-hidden relative group`}>
                      {url ? (
                        <>
                          <Image src={url} alt="Result" fill className="object-cover" />
                          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white">
                              <Heart className="w-3.5 h-3.5 text-zinc-500" />
                            </button>
                            {onDownload && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onDownload(url, i) }}
                                className="w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white"
                              >
                                <Download className="w-3.5 h-3.5 text-zinc-500" />
                              </button>
                            )}
                          </div>
                        </>
                      ) : status === 'failed' ? (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                          <span className="text-xs">{t.camera?.generationFailed || 'Failed'}</span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 animate-pulse">
                          <Loader2 className={`w-6 h-6 ${colors.spinner} animate-spin mb-2`} />
                          <span className="text-xs text-zinc-400">{t.common?.generating || 'Generating...'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              <div className="flex justify-center gap-3 mt-8">
                {onShootMore && (
                  <button onClick={onShootMore} className={`px-6 h-11 rounded-xl ${colors.button} text-white font-medium flex items-center gap-2 transition-colors`}>
                    {shootMoreIcon || <Camera className="w-4 h-4" />}
                    {shootMoreText || t.camera?.shootNew || 'Shoot More'}
                  </button>
                )}
                {onReturnHome && (
                  <button onClick={onReturnHome} className="px-6 h-11 rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 font-medium flex items-center gap-2 transition-colors border border-zinc-200">
                    <Home className="w-4 h-4" />
                    {returnHomeText || t.camera?.returnHome || 'Return Home'}
                  </button>
                )}
                <button onClick={handleGoToGallery} className="px-6 h-11 rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 font-medium flex items-center gap-2 transition-colors border border-zinc-200">
                  <FolderHeart className="w-4 h-4" />
                  {t.lifestyle?.goToPhotos || 'Go to Photos'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Mobile: Unified dark spinner layout */
        <>
          <div className="relative mb-6">
            <div className={`absolute inset-0 ${colors.glow} blur-xl rounded-full animate-pulse`} />
            <Loader2 className={`w-16 h-16 ${colors.spinner} animate-spin relative z-10`} />
          </div>
          <h3 className="text-white text-2xl font-bold mb-2">{mobileTitle || title}</h3>
          
          {mobileStatusLines.length > 0 && (
            <div className="text-zinc-400 space-y-1 text-sm mb-6">
              {mobileStatusLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
          
          {/* Progress dots */}
          {showProgressDots && (
            <div className="flex gap-2 mb-8">
              {Array.from({ length: numImages }).map((_, i) => {
                const status = getSlotStatus(i)
                const isCompleted = status === 'completed'
                const isGenerating = status === 'generating'
                return (
                  <motion.div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      isCompleted ? 'bg-green-500' : isGenerating ? colors.dot : 'bg-zinc-600'
                    }`}
                    animate={isGenerating ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )
              })}
            </div>
          )}
          
          <div className="space-y-3 w-full max-w-xs">
            <p className="text-zinc-500 text-xs mb-4">{t.camera?.continueInBackground || 'Generation continues in background:'}</p>
            {onShootMore && (
              <button onClick={onShootMore} className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors">
                {shootMoreIcon || <Camera className="w-5 h-5" />}
                {shootMoreText || t.camera?.shootNew || 'Shoot More'}
              </button>
            )}
            {onReturnHome && (
              <button onClick={onReturnHome} className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20">
                <Home className="w-5 h-5" />
                {returnHomeText || t.camera?.returnHome || 'Return Home'}
              </button>
            )}
          </div>
          
          {showBottomNav && <BottomNav forceShow />}
        </>
      )}
    </motion.div>
  )
}
