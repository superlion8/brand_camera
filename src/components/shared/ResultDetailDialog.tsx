"use client"

import { X, Heart, Download, ZoomIn } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useTranslation } from "@/stores/languageStore"
import { ReactNode } from "react"

// Badge configuration
export interface BadgeConfig {
  text: string
  className: string // Tailwind classes for styling
}

// Action button configuration
export interface ActionConfig {
  text: string
  icon?: ReactNode
  onClick: () => void
  className: string // Tailwind classes for styling
  fullWidth?: boolean // Default true for single button, auto for multiple
}

export interface ResultDetailDialogProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  title?: string
  
  // Badges (tags/labels)
  badges?: BadgeConfig[]
  
  // Timestamp
  timestamp?: string
  
  // Favorite action
  onFavorite?: () => void
  isFavorited?: boolean
  
  // Download action
  onDownload?: () => void
  
  // Fullscreen preview
  onFullscreen?: () => void
  
  // Bottom action buttons
  actions?: ActionConfig[]
  
  // Custom content (for debug info, prompts, etc.)
  children?: ReactNode
  
  // Mobile hint text
  mobileHint?: string
}

export function ResultDetailDialog({
  open,
  onClose,
  imageUrl,
  title,
  badges = [],
  timestamp,
  onFavorite,
  isFavorited = false,
  onDownload,
  onFullscreen,
  actions = [],
  children,
  mobileHint,
}: ResultDetailDialogProps) {
  const { t } = useTranslation()
  const { isDesktop } = useIsDesktop()

  if (!open || !imageUrl) return null

  const displayTitle = title || t.common?.detail || 'Details'
  const displayTimestamp = timestamp || t.common?.justNow || 'Just now'
  const displayMobileHint = mobileHint || t.imageActions?.longPressSave || 'Long press to save'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 ${isDesktop ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/40'}`}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed z-50 bg-white overflow-hidden flex flex-col ${
              isDesktop 
                ? 'inset-0 m-auto w-[600px] h-fit max-h-[90vh] rounded-2xl shadow-2xl' 
                : 'inset-0'
            }`}
          >
            {/* Header */}
            <div className={`h-14 flex items-center justify-between bg-white border-b shrink-0 ${isDesktop ? 'px-6' : 'px-4'}`}>
              <button
                onClick={onClose}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-zinc-700" />
              </button>
              <span className="font-semibold text-zinc-900">{displayTitle}</span>
              <div className="w-10" />
            </div>

            {/* Content - Scrollable */}
            <div className={`flex-1 overflow-y-auto ${isDesktop ? '' : 'pb-24'}`}>
              {/* Image Section */}
              <div className={isDesktop ? 'bg-zinc-100 p-4' : 'bg-zinc-900'}>
                <div 
                  className={`relative cursor-pointer group ${
                    isDesktop 
                      ? 'max-w-md mx-auto rounded-xl overflow-hidden shadow-lg' 
                      : 'aspect-[3/4]'
                  }`}
                  onClick={onFullscreen}
                >
                  <img 
                    src={imageUrl} 
                    alt="Detail" 
                    className={`w-full object-contain ${
                      isDesktop ? 'max-h-[50vh] bg-white' : 'h-full'
                    }`}
                  />
                  {/* Zoom hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <ZoomIn className="w-6 h-6 text-zinc-700" />
                    </div>
                  </div>
                </div>
                {!isDesktop && (
                  <p className="text-center text-zinc-500 text-xs py-2">{displayMobileHint}</p>
                )}
              </div>

              {/* Info Section */}
              <div className={`p-4 bg-white ${isDesktop ? '' : 'pb-8'}`}>
                {/* Badges and Actions Row */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    {/* Badges */}
                    {badges.length > 0 && (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {badges.map((badge, index) => (
                          <span key={index} className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                            {badge.text}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Timestamp */}
                    <p className="text-xs text-zinc-400">{displayTimestamp}</p>
                  </div>
                  
                  {/* Favorite & Download */}
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

                {/* Custom Content (Debug info, Prompts, etc.) */}
                {children}

                {/* Action Buttons */}
                {actions.length > 0 && (
                  <div className={`mt-4 ${actions.length === 1 ? '' : 'space-y-3'}`}>
                    {actions.length === 1 ? (
                      // Single button - full width
                      <button
                        onClick={actions[0].onClick}
                        className={`w-full h-12 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${actions[0].className}`}
                      >
                        {actions[0].icon}
                        {actions[0].text}
                      </button>
                    ) : actions.length === 2 ? (
                      // Two buttons - side by side
                      <div className="flex gap-3">
                        {actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={action.onClick}
                            className={`flex-1 h-12 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${action.className}`}
                          >
                            {action.icon}
                            {action.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      // Multiple buttons - stacked with potential row grouping
                      <>
                        {/* First two buttons side by side */}
                        {actions.length >= 2 && (
                          <div className="flex gap-3">
                            {actions.slice(0, 2).map((action, index) => (
                              <button
                                key={index}
                                onClick={action.onClick}
                                className={`flex-1 h-12 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${action.className}`}
                              >
                                {action.icon}
                                {action.text}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Remaining buttons full width */}
                        {actions.slice(2).map((action, index) => (
                          <button
                            key={index + 2}
                            onClick={action.onClick}
                            className={`w-full h-12 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${action.className}`}
                          >
                            {action.icon}
                            {action.text}
                          </button>
                        ))}
                      </>
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

// Helper function to create common badge styles
export const badgeStyles = {
  simple: 'bg-green-100 text-green-700',
  extended: 'bg-blue-100 text-blue-700',
  flash: 'bg-amber-100 text-amber-700',
  pro: 'bg-green-100 text-green-700',
  pink: 'bg-pink-100 text-pink-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  gradient: 'bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700',
}

// Helper function to create common action button styles
export const actionStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  amber: 'bg-amber-500 hover:bg-amber-600 text-white',
  pink: 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white',
  purple: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white',
  cyan: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white',
  secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
}
