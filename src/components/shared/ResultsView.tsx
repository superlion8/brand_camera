'use client'

import { useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { ArrowLeft, Heart, Download, Loader2, Wand2, RefreshCw, Camera } from 'lucide-react'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { useLanguageStore } from '@/stores/languageStore'
import { BottomNav } from './BottomNav'

export type ThemeColor = 'blue' | 'pink' | 'amber' | 'purple' | 'green'

export interface ResultImage {
  url?: string
  status: 'completed' | 'pending' | 'generating' | 'failed'
  error?: string
}

export interface ResultBadge {
  text: string
  className: string
}

interface ResultsViewProps {
  // Basic
  title: string
  onBack: () => void
  
  // Image data (dynamic count)
  images: ResultImage[]
  
  // Badge customization (the difference point)
  getBadge: (index: number) => ResultBadge
  
  // Theme color
  themeColor?: ThemeColor
  
  // Layout customization
  aspectRatio?: '3/4' | '1/1' | '4/5'
  gridCols?: { mobile: number; desktop: number }
  
  // Favorite/Download
  onFavorite: (index: number) => void
  isFavorited: (index: number) => boolean
  onDownload: (url: string, index: number) => void
  
  // Three unified button callbacks
  onShootNext: () => void
  onGoEdit: (selectedImageUrl: string) => void
  onRegenerate: () => void
  
  // Image click handler (for detail dialog)
  onImageClick: (index: number) => void
  
  // Optional customization
  showBottomNav?: boolean
  
  // Children for ResultDetailDialog etc.
  children?: ReactNode
}

// Theme color mappings
const themeColors: Record<ThemeColor, {
  primary: string
  primaryHover: string
  gradient?: string
  gradientHover?: string
}> = {
  blue: {
    primary: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
  },
  pink: {
    primary: 'bg-pink-500',
    primaryHover: 'hover:bg-pink-600',
    gradient: 'bg-gradient-to-r from-pink-500 to-purple-500',
    gradientHover: 'hover:from-pink-600 hover:to-purple-600',
  },
  amber: {
    primary: 'bg-amber-500',
    primaryHover: 'hover:bg-amber-600',
  },
  purple: {
    primary: 'bg-purple-500',
    primaryHover: 'hover:bg-purple-600',
    gradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
    gradientHover: 'hover:from-purple-600 hover:to-pink-600',
  },
  green: {
    primary: 'bg-green-500',
    primaryHover: 'hover:bg-green-600',
  },
}

export function ResultsView({
  title,
  onBack,
  images,
  getBadge,
  themeColor = 'blue',
  aspectRatio = '3/4',
  gridCols = { mobile: 2, desktop: 4 },
  onFavorite,
  isFavorited,
  onDownload,
  onShootNext,
  onGoEdit,
  onRegenerate,
  onImageClick,
  showBottomNav = true,
  children,
}: ResultsViewProps) {
  const { isDesktop } = useIsDesktop()
  const { t } = useLanguageStore()
  const colors = themeColors[themeColor]
  
  // Selection mode for "Go Edit"
  const [selectMode, setSelectMode] = useState<'view' | 'edit'>('view')
  
  // Aspect ratio class mapping
  const aspectRatioClass = {
    '3/4': 'aspect-[3/4]',
    '1/1': 'aspect-square',
    '4/5': 'aspect-[4/5]',
  }[aspectRatio]
  
  // Grid cols class
  const gridColsClass = isDesktop 
    ? `grid-cols-${gridCols.desktop}` 
    : `grid-cols-${gridCols.mobile}`
  
  // Get completed images
  const completedImages = images
    .map((img, i) => ({ ...img, index: i }))
    .filter(img => img.status === 'completed' && img.url)
  
  // Handle image click
  const handleImageClick = (index: number) => {
    const img = images[index]
    if (img.status !== 'completed' || !img.url) return
    
    if (selectMode === 'edit') {
      // In edit selection mode, trigger onGoEdit
      onGoEdit(img.url)
      setSelectMode('view')
    } else {
      // Normal mode, trigger onImageClick
      onImageClick(index)
    }
  }
  
  // Handle Go Edit button click
  const handleGoEditClick = () => {
    if (completedImages.length === 1) {
      // Only one image, go directly
      onGoEdit(completedImages[0].url!)
    } else {
      // Multiple images, enter selection mode
      setSelectMode('edit')
    }
  }
  
  // Cancel selection mode
  const handleCancelSelect = () => {
    setSelectMode('view')
  }
  
  // Get primary button class
  const getPrimaryButtonClass = () => {
    if (colors.gradient) {
      return `${colors.gradient} ${colors.gradientHover}`
    }
    return `${colors.primary} ${colors.primaryHover}`
  }

  return (
    <motion.div 
      key="results"
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }}
      className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
    >
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200 shrink-0">
          <div className="max-w-5xl mx-auto px-8 py-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={onBack}
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <h1 className="text-lg font-semibold text-zinc-900">
                {selectMode === 'edit' ? (t.results?.selectForEdit || 'Select image to edit') : title}
              </h1>
              {selectMode === 'edit' && (
                <button 
                  onClick={handleCancelSelect}
                  className="ml-auto text-sm text-zinc-500 hover:text-zinc-700"
                >
                  {t.common?.cancel || 'Cancel'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center px-4 border-b bg-white z-10">
          <button 
            onClick={onBack} 
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold ml-2">
            {selectMode === 'edit' ? (t.results?.selectForEdit || 'Select image to edit') : title}
          </span>
          {selectMode === 'edit' && (
            <button 
              onClick={handleCancelSelect}
              className="ml-auto text-sm text-zinc-500 hover:text-zinc-700 px-3"
            >
              {t.common?.cancel || 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-8'}`}>
        <div className={isDesktop ? 'max-w-6xl mx-auto px-8' : ''}>
          {/* Image Grid */}
          <div className={`grid gap-4 ${isDesktop ? `grid-cols-${gridCols.desktop}` : `grid-cols-${gridCols.mobile} gap-3`}`}>
            {images.map((img, i) => {
              const badge = getBadge(i)
              
              if (img.status === 'pending' || img.status === 'generating') {
                return (
                  <div key={i} className={`${aspectRatioClass} bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200`}>
                    <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-2" />
                    <span className="text-[10px] text-zinc-400">{t.common?.generating || 'Generating...'}</span>
                  </div>
                )
              }
              
              if (img.status === 'failed' || !img.url) {
                return (
                  <div key={i} className={`${aspectRatioClass} bg-zinc-200 rounded-xl flex flex-col items-center justify-center text-zinc-400 text-xs px-2 text-center`}>
                    <span className="mb-1">{badge.text}</span>
                    <span>{img.error || t.camera?.generationFailed || 'Failed'}</span>
                  </div>
                )
              }
              
              return (
                <div 
                  key={i} 
                  className={`group relative ${aspectRatioClass} bg-zinc-100 rounded-xl overflow-hidden shadow-sm border-2 cursor-pointer hover:shadow-md transition-all ${
                    selectMode === 'edit' 
                      ? 'border-blue-400 ring-2 ring-blue-200' 
                      : 'border-zinc-200'
                  }`}
                  onClick={() => handleImageClick(i)}
                >
                  <Image src={img.url} alt={`Result ${i + 1}`} fill className="object-cover" />
                  
                  {/* Selection mode overlay */}
                  {selectMode === 'edit' && (
                    <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <Wand2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons - show on hover (only in view mode) */}
                  {selectMode === 'view' && (
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                          isFavorited(i) 
                            ? "bg-red-500 text-white" 
                            : "bg-white/90 backdrop-blur hover:bg-white text-zinc-500"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onFavorite(i)
                        }}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFavorited(i) ? "fill-current" : ""}`} />
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation()
                          onDownload(img.url!, i) 
                        }}
                        className="w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white text-zinc-500"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  
                  {/* Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* PC: Buttons inline */}
          {isDesktop && selectMode === 'view' && (
            <div className="mt-8 flex justify-center gap-3">
              <button 
                onClick={onShootNext}
                className={`px-6 h-12 rounded-xl text-white font-semibold transition-colors flex items-center gap-2 ${getPrimaryButtonClass()}`}
              >
                <Camera className="w-4 h-4" />
                {t.camera?.shootNextSet || 'Shoot Next'}
              </button>
              <button 
                onClick={handleGoEditClick}
                className="px-6 h-12 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {t.gallery?.goEdit || 'Go Edit'}
              </button>
              <button 
                onClick={onRegenerate}
                className="px-6 h-12 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t.results?.regenerate || 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Bottom buttons */}
      {!isDesktop && selectMode === 'view' && (
        <div className="p-4 pb-20 bg-white border-t shadow-up space-y-2">
          <button 
            onClick={onShootNext}
            className={`w-full h-12 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 ${getPrimaryButtonClass()}`}
          >
            <Camera className="w-4 h-4" />
            {t.camera?.shootNextSet || 'Shoot Next'}
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleGoEditClick}
              className="flex-1 h-11 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              {t.gallery?.goEdit || 'Go Edit'}
            </button>
            <button 
              onClick={onRegenerate}
              className="flex-1 h-11 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t.results?.regenerate || 'Regenerate'}
            </button>
          </div>
        </div>
      )}
      
      {/* Bottom Nav */}
      {!isDesktop && showBottomNav && <BottomNav forceShow />}
      
      {/* Children (ResultDetailDialog, FullscreenImageViewer, etc.) */}
      {children}
    </motion.div>
  )
}
