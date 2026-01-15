"use client"

import { useState, ReactNode } from "react"
import { X, Heart, Download, Trash2, ZoomIn, Loader2, FolderPlus, Sparkles, Wand2, Grid3X3, Palette } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useTranslation } from "@/stores/languageStore"

// Quick Action configuration
export interface QuickActionConfig {
  id: string
  label: string
  icon: ReactNode
  onClick: () => void
  bgColor: string // e.g., 'from-pink-50 to-purple-50'
  iconBgColor: string // e.g., 'from-pink-500 to-purple-500'
  borderColor: string // e.g., 'border-pink-100'
  shadowColor?: string // e.g., 'shadow-pink-200/50'
  disabled?: boolean
  loading?: boolean
}

// Input Image configuration
export interface InputImageConfig {
  url: string
  label: string
  highlight?: boolean // For reference images etc.
  highlightColor?: string // e.g., 'border-pink-300'
}

// Badge configuration
export interface BadgeConfig {
  text: string
  className: string
}

export interface PhotoDetailDialogProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  
  // Header info
  badges?: BadgeConfig[]
  timestamp?: string
  
  // Actions
  onFavorite?: () => void
  isFavorited?: boolean
  onDownload?: () => void
  onDelete?: () => void
  onFullscreen?: () => void
  onInputImageClick?: (url: string) => void
  
  // Quick Actions (icon grid)
  quickActions?: QuickActionConfig[]
  
  // Save as Asset
  onSaveAsAsset?: () => void
  saveAsAssetLabel?: string
  
  // Input Images
  inputImages?: InputImageConfig[]
  
  // Custom content (for debug info, etc.)
  children?: ReactNode
}

export function PhotoDetailDialog({
  open,
  onClose,
  imageUrl,
  badges = [],
  timestamp,
  onFavorite,
  isFavorited = false,
  onDownload,
  onDelete,
  onFullscreen,
  onInputImageClick,
  quickActions = [],
  onSaveAsAsset,
  saveAsAssetLabel,
  inputImages = [],
  children,
}: PhotoDetailDialogProps) {
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()

  if (!open || !imageUrl) return null

  const displayTimestamp = timestamp || new Date().toLocaleString()
  
  // Quick action label translations
  const actionLabelMap: Record<string, string> = {
    'try-on': t.gallery?.goTryOn || 'Try On',
    'edit': t.gallery?.goEdit || 'Edit',
    'group-shoot': t.gallery?.goGroupShoot || 'Group Shoot',
    'material': t.gallery?.modifyMaterial || 'Material & Fit',
  }
  
  // Apply translations to quick actions
  const translatedQuickActions = quickActions.map(action => ({
    ...action,
    label: actionLabelMap[action.id] || action.label,
  }))

  // Desktop: Two-column layout
  // Mobile: Single column with bottom sheet style
  
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed z-50 bg-white overflow-hidden ${
              isDesktop 
                ? 'inset-0 m-auto w-[900px] h-fit max-h-[90vh] rounded-2xl shadow-2xl flex' 
                : 'bottom-0 left-0 right-0 h-[90%] rounded-t-2xl flex flex-col'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {isDesktop ? (
              // Desktop: Two-column layout
              <>
                {/* Left: Image */}
                <div className="w-[55%] bg-zinc-900 relative flex items-center justify-center">
                  <img 
                    src={imageUrl} 
                    alt="Photo" 
                    className="max-w-full max-h-[90vh] object-contain cursor-pointer"
                    onClick={onFullscreen}
                  />
                  {/* Close button on image */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Right: Info Panel */}
                <div className="w-[45%] flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <div>
                      {badges.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {badges.map((badge, index) => (
                            <span key={index} className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                              {badge.text}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-zinc-400 mt-1">{displayTimestamp}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {onFavorite && (
                        <button
                          onClick={onFavorite}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            isFavorited
                              ? "bg-red-50 text-red-500 shadow-sm"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isFavorited ? "fill-current" : ""}`} />
                        </button>
                      )}
                      {onDownload && (
                        <button
                          onClick={onDownload}
                          className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={onDelete}
                          className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* Quick Actions */}
                    {translatedQuickActions.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                          {t.gallery?.quickActions || 'Quick Actions'}
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                          {translatedQuickActions.map((action) => (
                            <button
                              key={action.id}
                              disabled={action.disabled || action.loading}
                              onClick={action.onClick}
                              className={`group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${action.bgColor} hover:opacity-90 border ${action.borderColor} transition-all disabled:opacity-50`}
                            >
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.iconBgColor} flex items-center justify-center shadow-lg ${action.shadowColor || ''} group-hover:scale-110 transition-transform`}>
                                {action.loading ? (
                                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                                ) : (
                                  action.icon
                                )}
                              </div>
                              <span className="text-xs font-medium text-zinc-700">{action.label}</span>
                            </button>
                          ))}
                        </div>
                        
                        {/* Save as Asset */}
                        {onSaveAsAsset && (
                          <button 
                            onClick={onSaveAsAsset}
                            className="w-full mt-3 h-11 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium flex items-center justify-center gap-2 transition-colors"
                          >
                            <FolderPlus className="w-4 h-4" />
                            {saveAsAssetLabel || t.gallery?.saveAsAsset || 'Save as Asset'}
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Input Images */}
                    {inputImages.length > 0 && (
                      <div className="mb-6 pt-4 border-t border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                          {t.gallery?.inputImages || 'Input Images'}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {inputImages.map((img, index) => (
                            <div key={index} className="flex flex-col items-center">
                              <div 
                                className={`w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 cursor-pointer relative group shadow-sm border-2 ${
                                  img.highlight ? (img.highlightColor || 'border-pink-300') : 'border-zinc-200'
                                }`}
                                onClick={() => onInputImageClick?.(img.url)}
                              >
                                <Image 
                                  src={img.url} 
                                  alt={img.label} 
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <p className={`text-xs mt-1.5 ${img.highlight ? 'text-pink-500' : 'text-zinc-500'}`}>
                                {img.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Custom Content */}
                    {children}
                  </div>
                </div>
              </>
            ) : (
              // Mobile: Single column layout
              <>
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b shrink-0">
                  <button onClick={onClose} className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center">
                    <X className="w-5 h-5 text-zinc-700" />
                  </button>
                  <span className="font-semibold">{t.common?.detail || 'Details'}</span>
                  <div className="w-10" />
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Image */}
                  <div className="bg-zinc-900 aspect-[3/4] relative" onClick={onFullscreen}>
                    <img src={imageUrl} alt="Photo" className="w-full h-full object-contain" />
                  </div>
                  
                  {/* Info */}
                  <div className="p-4 pb-32">
                    {/* Badges & Actions */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {badges.length > 0 && (
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {badges.map((badge, index) => (
                              <span key={index} className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                                {badge.text}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-zinc-400">{displayTimestamp}</p>
                      </div>
                      <div className="flex gap-2">
                        {onFavorite && (
                          <button
                            onClick={onFavorite}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                              isFavorited ? "bg-red-50 border-red-200 text-red-500" : "border-zinc-200 text-zinc-600"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
                          </button>
                        )}
                        {onDownload && (
                          <button onClick={onDownload} className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 flex items-center justify-center">
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Quick Actions - Mobile: 2x2 grid */}
                    {translatedQuickActions.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {translatedQuickActions.slice(0, 4).map((action) => (
                          <button
                            key={action.id}
                            disabled={action.disabled || action.loading}
                            onClick={action.onClick}
                            className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br ${action.bgColor} border ${action.borderColor} transition-all disabled:opacity-50`}
                          >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.iconBgColor} flex items-center justify-center shrink-0`}>
                              {action.loading ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                              ) : (
                                action.icon
                              )}
                            </div>
                            <span className="text-sm font-medium text-zinc-700">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Save as Asset */}
                    {onSaveAsAsset && (
                      <button 
                        onClick={onSaveAsAsset}
                        className="w-full h-11 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium flex items-center justify-center gap-2 mb-4"
                      >
                        <FolderPlus className="w-4 h-4" />
                        {saveAsAssetLabel || t.gallery?.saveAsAsset || 'Save as Asset'}
                      </button>
                    )}
                    
                    {/* Input Images */}
                    {inputImages.length > 0 && (
                      <div className="pt-4 border-t border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                          {t.gallery?.inputImages || 'Input Images'}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {inputImages.map((img, index) => (
                            <div key={index} className="flex flex-col items-center">
                              <div 
                                className={`w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 border-2 cursor-pointer ${
                                  img.highlight ? (img.highlightColor || 'border-pink-300') : 'border-zinc-200'
                                }`}
                                onClick={() => onInputImageClick?.(img.url)}
                              >
                                <Image src={img.url} alt={img.label} width={64} height={64} className="w-full h-full object-cover" />
                              </div>
                              <p className={`text-xs mt-1 ${img.highlight ? 'text-pink-500' : 'text-zinc-500'}`}>
                                {img.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Custom Content */}
                    {children}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Preset Quick Actions for common use cases
export const createQuickActions = {
  tryOn: (onClick: () => void, loading = false): QuickActionConfig => ({
    id: 'try-on',
    label: 'Try On',
    icon: <Sparkles className="w-5 h-5 text-white" />,
    onClick,
    bgColor: 'from-pink-50 to-purple-50',
    iconBgColor: 'from-pink-500 to-purple-500',
    borderColor: 'border-pink-100',
    shadowColor: 'shadow-pink-200/50',
    loading,
  }),
  edit: (onClick: () => void, loading = false): QuickActionConfig => ({
    id: 'edit',
    label: 'Edit',
    icon: <Wand2 className="w-5 h-5 text-white" />,
    onClick,
    bgColor: 'from-blue-50 to-blue-50',
    iconBgColor: 'from-blue-500 to-blue-500',
    borderColor: 'border-blue-100',
    shadowColor: 'shadow-blue-200/50',
    loading,
  }),
  groupShoot: (onClick: () => void, loading = false): QuickActionConfig => ({
    id: 'group-shoot',
    label: 'Group Shoot',
    icon: <Grid3X3 className="w-5 h-5 text-white" />,
    onClick,
    bgColor: 'from-cyan-50 to-cyan-50',
    iconBgColor: 'from-blue-500 to-cyan-500',
    borderColor: 'border-cyan-100',
    shadowColor: 'shadow-cyan-200/50',
    loading,
  }),
  material: (onClick: () => void, loading = false): QuickActionConfig => ({
    id: 'material',
    label: 'Material & Fit',
    icon: <Palette className="w-5 h-5 text-white" />,
    onClick,
    bgColor: 'from-purple-50 to-pink-50',
    iconBgColor: 'from-purple-500 to-pink-500',
    borderColor: 'border-purple-100',
    shadowColor: 'shadow-purple-200/50',
    loading,
  }),
}
