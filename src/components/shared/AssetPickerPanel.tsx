"use client"

import { useState, useCallback, useRef, memo } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, Loader2, FolderHeart, Plus, ZoomIn } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { fileToBase64 } from "@/lib/utils"
import { Asset } from "@/types"

// Threshold in pixels to distinguish tap from scroll
const TAP_THRESHOLD = 10

interface AssetPickerPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (imageUrl: string) => void
  onUploadClick?: () => void  // 点击"从相册上传"时的回调
  onDropUpload?: (base64: string) => void  // 拖放上传时的回调
  isLoading?: boolean
  themeColor?: 'purple' | 'amber' | 'blue'
  title?: string
  showUploadEntry?: boolean  // 是否显示上传入口
}

const themeClasses = {
  purple: {
    accent: 'bg-purple-500',
    accentHover: 'hover:border-purple-500 active:border-purple-600',
    button: 'bg-purple-500 hover:bg-purple-600',
    spinner: 'text-purple-500',
    uploadHover: 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20',
  },
  amber: {
    accent: 'bg-amber-500',
    accentHover: 'hover:border-amber-500 active:border-amber-600',
    button: 'bg-amber-500 hover:bg-amber-600',
    spinner: 'text-amber-500',
    uploadHover: 'hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  blue: {
    accent: 'bg-blue-500',
    accentHover: 'hover:border-blue-500 active:border-blue-600',
    button: 'bg-blue-500 hover:bg-blue-600',
    spinner: 'text-blue-500',
    uploadHover: 'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  },
}

// Memoized product item for better performance
const ProductItem = memo(function ProductItem({ 
  product, 
  onSelect, 
  onZoom, 
  themeHover, 
  isDesktop,
  isLoading 
}: { 
  product: Asset
  onSelect: (url: string) => void
  onZoom: (url: string) => void
  themeHover: string
  isDesktop: boolean
  isLoading: boolean
}) {
  // Track touch start position to distinguish tap from scroll
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent zoom button from triggering select
    if ((e.target as HTMLElement).closest('[data-zoom-btn]')) return
    // Record start position
    touchStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Prevent zoom button from triggering select
    if ((e.target as HTMLElement).closest('[data-zoom-btn]')) return
    
    // Check if this is a tap (not a scroll)
    if (touchStartRef.current) {
      const dx = Math.abs(e.clientX - touchStartRef.current.x)
      const dy = Math.abs(e.clientY - touchStartRef.current.y)
      
      // Only trigger if movement is within threshold (it's a tap, not a scroll)
      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
        onSelect(product.imageUrl)
      }
    }
    touchStartRef.current = null
  }, [onSelect, product.imageUrl])
  
  const handlePointerCancel = useCallback(() => {
    // Reset if touch is cancelled (e.g., scrolling takes over)
    touchStartRef.current = null
  }, [])

  return (
    <div className={`relative group ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        className={`w-full aspect-square rounded-xl overflow-hidden relative border-2 border-transparent ${themeHover} transition-colors bg-white dark:bg-zinc-800 cursor-pointer active:scale-95`}
        style={{ touchAction: 'pan-y' }}
      >
        <Image 
          src={product.imageUrl} 
          alt={product.name || ''} 
          fill 
          className="object-cover pointer-events-none" 
          loading="lazy"
          sizes="(max-width: 768px) 33vw, 20vw"
        />
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent ${isDesktop ? 'p-2 pt-6' : 'p-1.5 pt-4'} pointer-events-none`}>
          <p className={`${isDesktop ? 'text-xs' : 'text-[10px]'} text-white truncate text-center`}>{product.name}</p>
        </div>
      </div>
      {/* Zoom Button */}
      <button
        data-zoom-btn
        onClick={(e) => {
          e.stopPropagation()
          onZoom(product.imageUrl)
        }}
        className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
      >
        <ZoomIn className="w-3 h-3 text-white" />
      </button>
    </div>
  )
})

export function AssetPickerPanel({
  open,
  onClose,
  onSelect,
  onUploadClick,
  onDropUpload,
  isLoading = false,
  themeColor = 'purple',
  title,
  showUploadEntry = true,
}: AssetPickerPanelProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()
  const { userProducts } = useAssetStore()
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  const theme = themeClasses[themeColor]
  const displayTitle = title || t.camera?.selectProduct || 'Select Product'

  const handleSelect = useCallback((imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }, [onSelect, onClose])

  const handleUploadClick = useCallback(() => {
    onClose()
    onUploadClick?.()
  }, [onClose, onUploadClick])
  
  const handleZoom = useCallback((url: string) => {
    setZoomImage(url)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            key={`asset-picker-${isDesktop ? 'desktop' : 'mobile'}`}
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className={isDesktop 
              ? "fixed inset-0 m-auto w-[700px] h-fit max-h-[80vh] bg-white dark:bg-zinc-900 rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              : "fixed bottom-0 left-0 right-0 h-[80vh] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
            }
          >
            {/* Header */}
            <div className={`${isDesktop ? 'h-14 px-6' : 'h-12 px-4'} border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between shrink-0`}>
              <span className={`font-semibold ${isDesktop ? 'text-lg' : ''} text-zinc-900 dark:text-white`}>{displayTitle}</span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                <X className={`${isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-zinc-500 dark:text-zinc-400`} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 relative">
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center z-10 rounded-lg">
                  <Loader2 className={`w-8 h-8 ${theme.spinner} animate-spin`} />
                </div>
              )}
              
              {userProducts.length > 0 || (showUploadEntry && onUploadClick) ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'} pb-4`}>
                  {/* Upload from Album Entry */}
                  {showUploadEntry && onUploadClick && (
                    <div
                      onClick={handleUploadClick}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-' + themeColor + '-400', 'bg-' + themeColor + '-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-' + themeColor + '-400', 'bg-' + themeColor + '-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-' + themeColor + '-400', 'bg-' + themeColor + '-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/')) {
                          const base64 = await fileToBase64(file)
                          if (onDropUpload) {
                            onDropUpload(base64)
                          } else {
                            onSelect(base64)
                          }
                          onClose()
                        }
                      }}
                      className={`aspect-square rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 ${theme.uploadHover} flex flex-col items-center justify-center gap-2 transition-colors bg-zinc-50 dark:bg-zinc-800 cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <Plus className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center px-2">
                        {t.proStudio?.fromAlbum || 'From Album'}
                      </span>
                    </div>
                  )}
                  
                  {userProducts.map(product => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      onSelect={handleSelect}
                      onZoom={handleZoom}
                      themeHover={theme.accentHover}
                      isDesktop={isDesktop ?? false}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 py-12">
                  <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">{t.camera?.noMyProducts || 'No products yet'}</p>
                  <p className="text-xs mt-1">{t.camera?.uploadInAssets || 'Upload in Assets'}</p>
                  <button
                    onClick={() => {
                      onClose()
                      router.push("/brand-assets")
                    }}
                    className={`mt-4 px-4 py-2 ${theme.button} text-white text-sm rounded-lg`}
                  >
                    {t.camera?.goUpload || 'Go Upload'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
          
          {/* Zoom Modal */}
          <AnimatePresence>
            {zoomImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
                onClick={() => setZoomImage(null)}
              >
                <button
                  onClick={() => setZoomImage(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="relative w-full max-w-lg aspect-square mx-4"
                  onClick={e => e.stopPropagation()}
                >
                  <Image
                    src={zoomImage}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
