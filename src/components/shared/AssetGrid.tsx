'use client'

import Image from 'next/image'
import { Check, Plus, Upload, ZoomIn, Pin } from 'lucide-react'
import { useIsDesktop } from '@/hooks/useIsMobile'

// Asset type that matches existing usage
export interface AssetGridItem {
  id: string
  name?: string
  imageUrl: string
  isPinned?: boolean
}

export type ThemeColor = 'blue' | 'pink' | 'amber'

interface AssetGridProps {
  items: AssetGridItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  
  // Configurable options
  themeColor?: ThemeColor
  gridCols?: number | { mobile: number; desktop: number }
  aspectRatio?: '3/4' | '1/1'
  selectionStyle?: 'badge' | 'overlay'
  showPinBadge?: boolean
  uploadIcon?: 'plus' | 'upload'
  
  // Labels
  uploadLabel?: string
  emptyText?: string
}

// Theme color mappings
const themeColors: Record<ThemeColor, {
  border: string
  ring: string
  hoverBorder: string
  badgeBg: string
  overlayBg: string
  uploadCircleBg: string
  uploadIconColor: string
  uploadHoverBg: string
  uploadHoverBorder: string
}> = {
  blue: {
    border: 'border-blue-500',
    ring: 'ring-blue-500/30',
    hoverBorder: 'hover:border-blue-300',
    badgeBg: 'bg-blue-500',
    overlayBg: 'bg-blue-600/20',
    uploadCircleBg: 'bg-blue-100',
    uploadIconColor: 'text-blue-600',
    uploadHoverBg: 'hover:bg-blue-50',
    uploadHoverBorder: 'hover:border-blue-400',
  },
  pink: {
    border: 'border-pink-600',
    ring: 'ring-pink-200',
    hoverBorder: 'hover:border-zinc-200',
    badgeBg: 'bg-pink-500',
    overlayBg: 'bg-pink-600/20',
    uploadCircleBg: 'bg-pink-100',
    uploadIconColor: 'text-pink-600',
    uploadHoverBg: 'hover:bg-pink-50',
    uploadHoverBorder: 'hover:border-pink-500',
  },
  amber: {
    border: 'border-amber-500',
    ring: 'ring-amber-500/30',
    hoverBorder: 'hover:border-amber-300',
    badgeBg: 'bg-amber-500',
    overlayBg: 'bg-amber-600/20',
    uploadCircleBg: 'bg-amber-100',
    uploadIconColor: 'text-amber-600',
    uploadHoverBg: 'hover:bg-amber-50',
    uploadHoverBorder: 'hover:border-amber-400',
  },
}

export function AssetGrid({
  items,
  selectedId,
  onSelect,
  onUpload,
  onZoom,
  themeColor = 'blue',
  gridCols = 2,
  aspectRatio = '3/4',
  selectionStyle = 'badge',
  showPinBadge = true,
  uploadIcon = 'upload',
  uploadLabel = 'Upload',
  emptyText = 'No items',
}: AssetGridProps) {
  const { isDesktop } = useIsDesktop()
  const colors = themeColors[themeColor]
  
  // Calculate grid columns
  const getMobileGridCols = () => {
    if (typeof gridCols === 'number') return gridCols
    return gridCols.mobile
  }
  
  const getDesktopGridCols = () => {
    if (typeof gridCols === 'number') return gridCols + 1 // Auto +1 for desktop
    return gridCols.desktop
  }
  
  const mobileCols = getMobileGridCols()
  const desktopCols = getDesktopGridCols()
  
  // Grid column class mapping
  const gridColsClass: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }
  
  const actualCols = isDesktop ? desktopCols : mobileCols
  const gridClass = gridColsClass[actualCols] || 'grid-cols-2'
  
  // Aspect ratio class
  const aspectClass = aspectRatio === '1/1' ? 'aspect-square' : 'aspect-[3/4]'
  
  // Upload button icon
  const UploadIcon = uploadIcon === 'plus' ? Plus : Upload

  return (
    <div className={`grid ${gridClass} gap-3`}>
      {/* Upload Button */}
      {onUpload && (
        <button
          onClick={onUpload}
          className={`${aspectClass} rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 ${colors.uploadHoverBorder} transition-all flex flex-col items-center justify-center bg-zinc-50 ${colors.uploadHoverBg}`}
        >
          {uploadIcon === 'upload' ? (
            <>
              <div className={`w-10 h-10 rounded-full ${colors.uploadCircleBg} flex items-center justify-center mb-2`}>
                <UploadIcon className={`w-5 h-5 ${colors.uploadIconColor}`} />
              </div>
              <span className="text-xs text-zinc-600 font-medium">{uploadLabel}</span>
            </>
          ) : (
            <>
              <Plus className="w-10 h-10 text-zinc-400" />
              <span className="text-sm text-zinc-500 mt-2">{uploadLabel}</span>
            </>
          )}
        </button>
      )}
      
      {/* Asset Items */}
      {items.map(item => {
        const isSelected = selectedId === item.id
        
        return (
          <div
            key={item.id}
            className={`${aspectClass} rounded-xl overflow-hidden relative border-2 transition-all ${
              isSelected 
                ? `${colors.border} ring-2 ${colors.ring}` 
                : `border-transparent ${colors.hoverBorder}`
            }`}
          >
            <button
              onClick={() => onSelect(item.id)}
              className="absolute inset-0"
            >
              <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
            </button>
            
            {/* Selection indicator */}
            {isSelected && selectionStyle === 'badge' && (
              <div className={`absolute top-2 left-2 w-6 h-6 ${colors.badgeBg} rounded-full flex items-center justify-center`}>
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            {isSelected && selectionStyle === 'overlay' && (
              <div className={`absolute inset-0 ${colors.overlayBg} flex items-center justify-center pointer-events-none`}>
                <Check className="w-6 h-6 text-white drop-shadow-md" />
              </div>
            )}
            
            {/* Pin badge */}
            {showPinBadge && item.isPinned && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm z-10">
                <Pin className="w-2.5 h-2.5" />
              </span>
            )}
            
            {/* Zoom button */}
            {onZoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onZoom(item.imageUrl)
                }}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            )}
            
            {/* Name label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
              <p className="text-xs text-white truncate text-center">{item.name}</p>
            </div>
          </div>
        )
      })}
      
      {/* Empty state */}
      {items.length === 0 && !onUpload && (
        <div className={`col-span-${actualCols} flex flex-col items-center justify-center py-12 text-zinc-400`}>
          <p className="text-sm">{emptyText}</p>
        </div>
      )}
    </div>
  )
}
