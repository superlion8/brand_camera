"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, Loader2, FolderHeart } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { PRESET_PRODUCTS } from "@/data/presets"

interface AssetPickerPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (imageUrl: string) => void
  isLoading?: boolean
  themeColor?: 'purple' | 'amber' | 'blue'
  title?: string
}

const themeClasses = {
  purple: {
    accent: 'bg-purple-500',
    accentHover: 'hover:border-purple-500',
    button: 'bg-purple-500 hover:bg-purple-600',
    spinner: 'text-purple-500',
  },
  amber: {
    accent: 'bg-amber-500',
    accentHover: 'hover:border-amber-500',
    button: 'bg-amber-500 hover:bg-amber-600',
    spinner: 'text-amber-500',
  },
  blue: {
    accent: 'bg-blue-500',
    accentHover: 'hover:border-blue-500',
    button: 'bg-blue-500 hover:bg-blue-600',
    spinner: 'text-blue-500',
  },
}

export function AssetPickerPanel({
  open,
  onClose,
  onSelect,
  isLoading = false,
  themeColor = 'purple',
  title,
}: AssetPickerPanelProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()
  const { userProducts } = useAssetStore()
  const [sourceTab, setSourceTab] = useState<'preset' | 'user'>('preset')
  
  const theme = themeClasses[themeColor]
  const displayTitle = title || t.camera?.selectProduct || 'Select Product'

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }

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
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={isDesktop 
              ? "fixed inset-0 m-auto w-[700px] h-fit max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              : "fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            }
          >
            {/* Header */}
            <div className={`${isDesktop ? 'h-14 px-6' : 'h-12 px-4'} border-b flex items-center justify-between shrink-0`}>
              <span className={`font-semibold ${isDesktop ? 'text-lg' : ''}`}>{displayTitle}</span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <X className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
              </button>
            </div>
            
            {/* Source Tabs */}
            <div className={`${isDesktop ? 'px-6 py-3' : 'px-4 py-2'} border-b bg-white`}>
              <div className="flex bg-zinc-100 rounded-lg p-1">
                <button
                  onClick={() => setSourceTab("preset")}
                  className={`flex-1 ${isDesktop ? 'py-2.5 text-sm' : 'py-2 text-xs'} font-medium rounded-md transition-colors ${
                    sourceTab === "preset"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {t.camera?.officialExamples || 'Official Examples'} ({PRESET_PRODUCTS.length})
                </button>
                <button
                  onClick={() => setSourceTab("user")}
                  className={`flex-1 ${isDesktop ? 'py-2.5 text-sm' : 'py-2 text-xs'} font-medium rounded-md transition-colors ${
                    sourceTab === "user"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {t.camera?.myProducts || 'My Products'} ({userProducts.length})
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                  <Loader2 className={`w-8 h-8 ${theme.spinner} animate-spin`} />
                </div>
              )}
              
              {sourceTab === 'preset' ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                  {PRESET_PRODUCTS.map(product => (
                    <button
                      key={product.id}
                      disabled={isLoading}
                      onClick={() => handleSelect(product.imageUrl)}
                      className={`aspect-square rounded-xl overflow-hidden relative border-2 border-transparent ${theme.accentHover} transition-all bg-white disabled:opacity-50`}
                    >
                      <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                      <span className={`absolute top-1.5 left-1.5 ${theme.accent} text-white ${isDesktop ? 'text-[10px] px-1.5 py-0.5' : 'text-[8px] px-1 py-0.5'} rounded font-medium`}>
                        {t.common?.official || 'Official'}
                      </span>
                      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent ${isDesktop ? 'p-2 pt-6' : 'p-1.5 pt-4'}`}>
                        <p className={`${isDesktop ? 'text-xs' : 'text-[10px]'} text-white truncate text-center`}>{product.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : userProducts.length > 0 ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                  {userProducts.map(product => (
                    <button
                      key={product.id}
                      disabled={isLoading}
                      onClick={() => handleSelect(product.imageUrl)}
                      className={`aspect-square rounded-xl overflow-hidden relative border-2 border-transparent ${theme.accentHover} transition-all bg-white disabled:opacity-50`}
                    >
                      <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent ${isDesktop ? 'p-2 pt-6' : 'p-1.5 pt-4'}`}>
                        <p className={`${isDesktop ? 'text-xs' : 'text-[10px]'} text-white truncate text-center`}>{product.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
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
        </>
      )}
    </AnimatePresence>
  )
}
