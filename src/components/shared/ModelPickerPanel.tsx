"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { X, Loader2, Upload, Check, Users } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useTranslation } from "@/stores/languageStore"
import { usePresetStore } from "@/stores/presetStore"
import { fileToBase64 } from "@/lib/utils"
import { Asset } from "@/types"

interface ModelPickerPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (model: Asset) => void
  selectedId?: string | null
  themeColor?: 'purple' | 'amber' | 'blue' | 'pink'
  title?: string
  /** Allow uploading custom model */
  allowUpload?: boolean
  /** Custom models to show alongside presets */
  customModels?: Asset[]
  /** Callback when custom model is uploaded */
  onCustomUpload?: (model: Asset) => void
}

const themeClasses = {
  purple: {
    ring: 'ring-purple-500 border-purple-500',
    bg: 'bg-purple-500',
    hover: 'hover:border-purple-400 hover:bg-purple-50',
    spinner: 'text-purple-500',
  },
  amber: {
    ring: 'ring-amber-500 border-amber-500',
    bg: 'bg-amber-500',
    hover: 'hover:border-amber-400 hover:bg-amber-50',
    spinner: 'text-amber-500',
  },
  blue: {
    ring: 'ring-blue-500 border-blue-500',
    bg: 'bg-blue-500',
    hover: 'hover:border-blue-400 hover:bg-blue-50',
    spinner: 'text-blue-500',
  },
  pink: {
    ring: 'ring-pink-500 border-pink-500',
    bg: 'bg-pink-500',
    hover: 'hover:border-pink-400 hover:bg-pink-50',
    spinner: 'text-pink-500',
  },
}

export function ModelPickerPanel({
  open,
  onClose,
  onSelect,
  selectedId,
  themeColor = 'blue',
  title,
  allowUpload = true,
  customModels = [],
  onCustomUpload,
}: ModelPickerPanelProps) {
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()
  const { studioModels: presetModels, loadPresets, isLoading: presetsLoading } = usePresetStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const theme = themeClasses[themeColor]
  const displayTitle = title || t.referenceShot?.selectModel || 'Select Model'
  
  // Combine custom models with presets
  const allModels = [...customModels, ...(presetModels || [])]
  
  // Fetch presets when panel opens
  useEffect(() => {
    if (open && presetModels.length === 0) {
      loadPresets()
    }
  }, [open, presetModels.length, loadPresets])
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-model-${Date.now()}`,
        type: 'model',
        name: t.referenceShot?.uploadCustomModel || 'Custom Model',
        imageUrl: base64,
      }
      
      if (onCustomUpload) {
        onCustomUpload(newModel)
      }
      
      // Auto-select the uploaded model
      onSelect(newModel)
      onClose()
    } catch (error) {
      console.error('Failed to upload model:', error)
    }
    
    // Reset input
    e.target.value = ''
  }
  
  const handleSelect = (model: Asset) => {
    onSelect(model)
    onClose()
  }

  const loading = presetsLoading

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
              ? "fixed inset-0 m-auto w-[600px] h-fit max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              : "fixed bottom-0 left-0 right-0 h-[75%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            }
          >
            {/* Header */}
            <div className={`${isDesktop ? 'h-14 px-6' : 'h-12 px-4'} border-b flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-zinc-400" />
                <span className={`font-semibold ${isDesktop ? 'text-lg' : ''}`}>{displayTitle}</span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <X className={isDesktop ? "w-5 h-5" : "w-4 h-4"} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Upload button */}
              {allowUpload && (
                <div className="mb-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full p-4 rounded-xl border-2 border-dashed border-zinc-300 ${theme.hover} bg-zinc-50 transition-all flex items-center justify-center gap-2`}
                  >
                    <Upload className="w-5 h-5 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-600">
                      {t.referenceShot?.uploadCustomModel || 'Upload Custom Model'}
                    </span>
                  </button>
                </div>
              )}
              
              {/* Loading */}
              {loading ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] rounded-xl bg-zinc-200 animate-pulse"
                    />
                  ))}
                </div>
              ) : allModels.length > 0 ? (
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {allModels.map((model) => {
                    const isSelected = selectedId === model.id
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleSelect(model)}
                        className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                          isSelected
                            ? `${theme.ring} ring-2 ring-offset-1`
                            : 'border-transparent hover:border-zinc-300'
                        }`}
                      >
                        <Image 
                          src={model.imageUrl} 
                          alt={model.name || ''} 
                          fill 
                          className="object-cover" 
                        />
                        
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className={`absolute top-2 left-2 w-6 h-6 ${theme.bg} rounded-full flex items-center justify-center`}>
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        
                        {/* Name label */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                          <p className="text-xs text-white truncate text-center">{model.name}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
                  <Users className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">{t.referenceShot?.noModels || 'No models available'}</p>
                </div>
              )}
            </div>
          </motion.div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </>
      )}
    </AnimatePresence>
  )
}
