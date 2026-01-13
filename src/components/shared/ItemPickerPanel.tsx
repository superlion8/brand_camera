'use client'

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Check, Loader2 } from 'lucide-react'
import Image from 'next/image'

export interface PickerItem {
  id: string
  imageUrl: string
  label?: string
  badge?: { text: string; className: string }
}

export interface PickerTab {
  id: string
  label: string
}

interface ItemPickerPanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  
  // Tabs (optional)
  tabs?: PickerTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  
  // Upload button (optional)
  showUpload?: boolean
  uploadLabel?: string
  onUpload?: () => void
  
  // Items
  items: PickerItem[]
  selectedId?: string | null
  
  // Selection
  onSelect: (item: PickerItem) => void
  
  // Loading/Empty states
  loading?: boolean
  loadingText?: string
  emptyText?: string
  emptySubtext?: string
  
  // Grid layout
  gridCols?: 2 | 3 | 4
  aspectRatio?: '1/1' | '3/4' | '4/5'
  
  // Theme
  themeColor?: 'blue' | 'pink' | 'amber' | 'purple'
  
  // Custom content before grid
  headerContent?: ReactNode
}

export function ItemPickerPanel({
  open,
  onClose,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  showUpload,
  uploadLabel,
  onUpload,
  items,
  selectedId,
  onSelect,
  loading,
  loadingText = 'Loading...',
  emptyText = 'No items',
  emptySubtext,
  gridCols = 3,
  aspectRatio = '1/1',
  themeColor = 'blue',
  headerContent,
}: ItemPickerPanelProps) {
  const aspectRatioClass = {
    '1/1': 'aspect-square',
    '3/4': 'aspect-[3/4]',
    '4/5': 'aspect-[4/5]',
  }[aspectRatio]
  
  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[gridCols]
  
  const themeColors = {
    blue: {
      ring: 'ring-blue-500',
      bg: 'bg-blue-500',
      hover: 'hover:border-blue-400 hover:bg-blue-50',
      loader: 'text-blue-500',
    },
    pink: {
      ring: 'ring-pink-500',
      bg: 'bg-pink-500',
      hover: 'hover:border-pink-400 hover:bg-pink-50',
      loader: 'text-pink-500',
    },
    amber: {
      ring: 'ring-amber-500',
      bg: 'bg-amber-500',
      hover: 'hover:border-amber-400 hover:bg-amber-50',
      loader: 'text-amber-500',
    },
    purple: {
      ring: 'ring-purple-500',
      bg: 'bg-purple-500',
      hover: 'hover:border-purple-400 hover:bg-purple-50',
      loader: 'text-purple-500',
    },
  }[themeColor]

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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  {subtitle && (
                    <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              {/* Tabs */}
              {tabs && tabs.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Custom header content */}
              {headerContent}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Upload button */}
              {showUpload && onUpload && (
                <div className="mb-4">
                  <button
                    onClick={onUpload}
                    className={`w-full p-4 rounded-xl border-2 border-dashed border-zinc-300 ${themeColors.hover} bg-zinc-50 transition-all flex items-center justify-center gap-2`}
                  >
                    <Upload className="w-5 h-5 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-600">
                      {uploadLabel || 'Upload'}
                    </span>
                  </button>
                </div>
              )}
              
              {/* Loading state */}
              {loading && (
                <div className="h-40 flex flex-col items-center justify-center gap-3">
                  <Loader2 className={`w-8 h-8 ${themeColors.loader} animate-spin`} />
                  <p className="text-sm text-zinc-400">{loadingText}</p>
                </div>
              )}
              
              {/* Empty state */}
              {!loading && items.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-zinc-400 text-sm gap-2">
                  <p>{emptyText}</p>
                  {emptySubtext && <p className="text-xs">{emptySubtext}</p>}
                </div>
              )}
              
              {/* Grid */}
              {!loading && items.length > 0 && (
                <div className={`grid ${gridColsClass} gap-3`}>
                  {items.map((item) => {
                    const isSelected = selectedId === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className={`${aspectRatioClass} rounded-xl overflow-hidden relative border-2 transition-all ${
                          isSelected
                            ? `border-${themeColor}-500 ${themeColors.ring} ring-2 ring-offset-1`
                            : 'border-transparent hover:border-zinc-300'
                        }`}
                      >
                        <Image 
                          src={item.imageUrl} 
                          alt={item.label || ''} 
                          fill 
                          className="object-cover" 
                        />
                        
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className={`absolute top-2 left-2 w-6 h-6 ${themeColors.bg} rounded-full flex items-center justify-center`}>
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        
                        {/* Badge */}
                        {item.badge && (
                          <div className="absolute bottom-1 left-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${item.badge.className}`}>
                              {item.badge.text}
                            </span>
                          </div>
                        )}
                        
                        {/* Label */}
                        {item.label && !item.badge && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                            <p className="text-xs text-white truncate text-center">{item.label}</p>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
