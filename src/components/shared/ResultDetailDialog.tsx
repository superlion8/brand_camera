"use client"

import { X, Heart, Download, ZoomIn, Copy, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useTranslation } from "@/stores/languageStore"
import { useState } from "react"

interface ResultDetailDialogProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  // Generation info
  genMode?: 'simple' | 'extended'
  modelType?: 'pro' | 'flash'
  prompt?: string
  timestamp?: string
  // Actions
  onFavorite?: () => void
  isFavorited?: boolean
  onDownload?: () => void
  // Fullscreen preview
  onFullscreen?: () => void
  // Debug info (only shown in debug mode)
  debugMode?: boolean
  debugInfo?: {
    model?: { name: string; imageUrl?: string }
    background?: { name: string; imageUrl?: string }
    modelType?: string
    genMode?: string
    [key: string]: any
  }
  // Theme
  themeColor?: 'blue' | 'purple' | 'amber' | 'green'
}

const themeClasses = {
  blue: {
    simpleBadge: 'bg-green-100 text-green-700',
    extendedBadge: 'bg-blue-100 text-blue-700',
    accent: 'bg-blue-500',
  },
  purple: {
    simpleBadge: 'bg-green-100 text-green-700',
    extendedBadge: 'bg-purple-100 text-purple-700',
    accent: 'bg-purple-500',
  },
  amber: {
    simpleBadge: 'bg-green-100 text-green-700',
    extendedBadge: 'bg-amber-100 text-amber-700',
    accent: 'bg-amber-500',
  },
  green: {
    simpleBadge: 'bg-green-100 text-green-700',
    extendedBadge: 'bg-blue-100 text-blue-700',
    accent: 'bg-green-500',
  },
}

export function ResultDetailDialog({
  open,
  onClose,
  imageUrl,
  genMode,
  modelType,
  prompt,
  timestamp,
  onFavorite,
  isFavorited = false,
  onDownload,
  onFullscreen,
  debugMode = false,
  debugInfo,
  themeColor = 'blue',
}: ResultDetailDialogProps) {
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()
  const [promptCopied, setPromptCopied] = useState(false)
  const theme = themeClasses[themeColor]

  const handleCopyPrompt = async () => {
    if (prompt) {
      await navigator.clipboard.writeText(prompt)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    }
  }

  if (!open || !imageUrl) return null

  // PC Desktop: Centered modal with max width
  // Mobile: Full screen overlay
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={isDesktop 
              ? "fixed inset-0 m-auto w-[600px] h-fit max-h-[90vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              : "fixed inset-0 bg-white z-50 flex flex-col overflow-hidden"
            }
          >
            {/* Header */}
            <div className={`${isDesktop ? 'h-14 px-6' : 'h-14 px-4'} flex items-center justify-between bg-white border-b shrink-0`}>
              <button
                onClick={onClose}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-zinc-700" />
              </button>
              <span className="font-semibold text-zinc-900">{t.common?.detail || 'Details'}</span>
              <div className="w-10" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image Section */}
              <div className={`${isDesktop ? 'bg-zinc-100 p-4' : 'bg-zinc-900'}`}>
                <div 
                  className={`relative cursor-pointer group ${isDesktop ? 'max-w-md mx-auto rounded-xl overflow-hidden shadow-lg' : ''}`}
                  onClick={onFullscreen}
                >
                  <img 
                    src={imageUrl} 
                    alt="Detail" 
                    className={`w-full ${isDesktop ? 'max-h-[50vh] object-contain bg-white' : 'aspect-[4/5] object-contain'}`}
                  />
                  {/* Zoom hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <ZoomIn className="w-6 h-6 text-zinc-700" />
                    </div>
                  </div>
                </div>
                {!isDesktop && (
                  <p className="text-center text-zinc-500 text-xs py-2">{t.imageActions?.longPressSave || 'Long press to save'}</p>
                )}
              </div>

              {/* Info Section */}
              <div className={`p-4 ${isDesktop ? 'pb-4' : 'pb-8'} bg-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Generation mode badge */}
                      {genMode && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          genMode === 'simple' ? theme.simpleBadge : theme.extendedBadge
                        }`}>
                          {genMode === 'simple' 
                            ? (t.gallery?.simpleMode || "Simple") 
                            : (t.gallery?.extendedMode || "Extended")}
                        </span>
                      )}
                      {modelType === 'flash' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                          Gemini 2.5
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      {timestamp || (t.common?.justNow || 'Just now')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {onFavorite && (
                      <button
                        onClick={onFavorite}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                          isFavorited
                            ? "bg-red-50 border-red-200 text-red-500"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
                      </button>
                    )}
                    {onDownload && (
                      <button
                        onClick={onDownload}
                        className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt Section */}
                {prompt && (
                  <div className="mt-4 p-3 bg-zinc-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-500">Prompt</span>
                      <button
                        onClick={handleCopyPrompt}
                        className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                      >
                        {promptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {promptCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-zinc-700 leading-relaxed">{prompt}</p>
                  </div>
                )}

                {/* Debug Info - Only shown in debug mode */}
                {debugMode && debugInfo && (
                  <div className="mt-4 space-y-3">
                    {/* Model info */}
                    {debugInfo.model && (
                      <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                        {debugInfo.model.imageUrl && (
                          <img 
                            src={debugInfo.model.imageUrl} 
                            alt="Model" 
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="text-xs text-zinc-500">{t.common?.model || 'Model'}</p>
                          <p className="text-sm font-medium text-zinc-700">{debugInfo.model.name}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Background info */}
                    {debugInfo.background && (
                      <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                        {debugInfo.background.imageUrl && (
                          <img 
                            src={debugInfo.background.imageUrl} 
                            alt="Background" 
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="text-xs text-zinc-500">{t.common?.background || 'Background'}</p>
                          <p className="text-sm font-medium text-zinc-700">{debugInfo.background.name}</p>
                        </div>
                      </div>
                    )}

                    {/* Model type */}
                    {(debugInfo.modelType || debugInfo.genMode) && (
                      <div className="p-3 bg-zinc-50 rounded-xl">
                        {debugInfo.modelType && (
                          <p className="text-xs text-zinc-600">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              debugInfo.modelType === 'pro' ? 'bg-green-500' : 'bg-amber-500'
                            }`} />
                            Model: Gemini {debugInfo.modelType === 'pro' ? '3.0 Pro' : '2.5 Flash'}
                            {debugInfo.modelType === 'flash' && ' (Fallback)'}
                          </p>
                        )}
                        {debugInfo.genMode && (
                          <p className="text-xs text-zinc-600 mt-1">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              debugInfo.genMode === 'simple' ? 'bg-green-500' : 'bg-blue-500'
                            }`} />
                            Mode: {debugInfo.genMode === 'simple' ? 'Simple' : 'Extended'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
