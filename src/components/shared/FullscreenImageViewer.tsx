"use client"

import { X, ZoomIn, ZoomOut, Download } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef } from "react"
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
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  const startPosition = useRef({ x: 0, y: 0 })

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4))
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1)
    setScale(newScale)
    if (newScale === 1) setPosition({ x: 0, y: 0 })
  }
  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  // Mouse drag handlers (PC)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      startPosition.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - startPosition.current.x,
        y: e.clientY - startPosition.current.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      const touch = e.touches[0]
      startPosition.current = { x: touch.clientX - position.x, y: touch.clientY - position.y }
      setIsDragging(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      const touch = e.touches[0]
      setPosition({
        x: touch.clientX - startPosition.current.x,
        y: touch.clientY - startPosition.current.y,
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Double tap/click to zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset()
    } else {
      setScale(2)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black flex flex-col"
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
              {/* Zoom controls - PC only */}
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

          {/* Image Container */}
          <div 
            className="flex-1 overflow-hidden flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              src={imageUrl}
              alt="Fullscreen"
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
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
