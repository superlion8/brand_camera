"use client"

import { X, ZoomIn, ZoomOut, Download } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useCallback } from "react"
import { useIsDesktop } from "@/hooks/useIsMobile"

interface FullscreenImageViewerProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  onDownload?: () => void
}

export function FullscreenImageViewer({
  open,
  onClose,
  imageUrl,
  onDownload,
}: FullscreenImageViewerProps) {
  const { isDesktop } = useIsDesktop()
  const [scale, setScale] = useState(1)

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1))
  const handleReset = () => setScale(1)

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset()
    } else {
      setScale(2)
    }
  }

  // ESC 键关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 bg-black/80 backdrop-blur shrink-0 relative z-10">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex items-center gap-2">
              {isDesktop && (
                <>
                  <button
                    onClick={handleZoomOut}
                    disabled={scale <= 1}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
                  >
                    <ZoomOut className="w-5 h-5 text-white" />
                  </button>
                  <span className="text-white text-sm font-medium min-w-[50px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={scale >= 4}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition-colors"
                  >
                    <ZoomIn className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
              
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Image - 点击黑色区域关闭 */}
          <div 
            className="flex-1 overflow-hidden flex items-center justify-center p-4"
            onClick={(e) => {
              // 点击图片外的黑色区域时关闭
              if (e.target === e.currentTarget) onClose()
            }}
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={imageUrl}
              alt="Fullscreen"
              className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          </div>

          {/* Mobile hint */}
          {!isDesktop && (
            <div className="h-12 flex items-center justify-center bg-black/80 backdrop-blur">
              <p className="text-zinc-500 text-xs">
                Double tap to zoom • Long press to save
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
