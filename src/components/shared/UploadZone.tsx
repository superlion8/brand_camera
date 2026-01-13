"use client"

import { useState, useRef, ReactNode, DragEvent, ChangeEvent } from "react"
import { Upload, Plus, Image as ImageIcon, FolderHeart } from "lucide-react"
import { useTranslation } from "@/stores/languageStore"
import { fileToBase64 } from "@/lib/utils"

// Size presets
type SizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto'

interface UploadZoneProps {
  // Callbacks
  onFileSelect?: (file: File) => void
  onBase64?: (base64: string) => void // Convenience callback that converts to base64
  onFromAssets?: () => void // Opens asset picker
  onFromGallery?: () => void // Opens gallery picker
  
  // File settings
  accept?: string
  multiple?: boolean
  
  // Appearance
  size?: SizePreset
  aspectRatio?: string // e.g., "1/1", "3/4", "4/3"
  themeColor?: 'amber' | 'pink' | 'blue' | 'purple' | 'green' | 'zinc'
  variant?: 'default' | 'compact' | 'minimal' // Different visual styles
  
  // Content
  icon?: ReactNode
  title?: string
  subtitle?: string
  children?: ReactNode // Full custom content
  
  // State
  disabled?: boolean
  className?: string
  
  // Quick action buttons
  showQuickActions?: boolean // Show "From Assets" / "From Photos" buttons
}

const themeClasses = {
  amber: {
    border: 'hover:border-amber-400',
    bg: 'hover:bg-amber-50/50',
    dragBorder: 'border-amber-400',
    dragBg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
  },
  pink: {
    border: 'hover:border-pink-400',
    bg: 'hover:bg-pink-50/50',
    dragBorder: 'border-pink-400',
    dragBg: 'bg-pink-50',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-500',
  },
  blue: {
    border: 'hover:border-blue-400',
    bg: 'hover:bg-blue-50/50',
    dragBorder: 'border-blue-400',
    dragBg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
  },
  purple: {
    border: 'hover:border-purple-400',
    bg: 'hover:bg-purple-50/50',
    dragBorder: 'border-purple-400',
    dragBg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-500',
  },
  green: {
    border: 'hover:border-green-400',
    bg: 'hover:bg-green-50/50',
    dragBorder: 'border-green-400',
    dragBg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-500',
  },
  zinc: {
    border: 'hover:border-zinc-400',
    bg: 'hover:bg-zinc-50/50',
    dragBorder: 'border-zinc-400',
    dragBg: 'bg-zinc-100',
    iconBg: 'bg-zinc-100',
    iconColor: 'text-zinc-500',
  },
}

const sizeClasses = {
  xs: 'w-20 h-20',        // 80px - for small add buttons
  sm: 'w-28 h-28',        // 112px - for additional items
  md: 'w-full h-32',      // 128px height - medium upload area
  lg: 'w-full h-48',      // 192px height - large upload area  
  xl: 'w-full h-64',      // 256px height - extra large
  auto: 'w-full',         // Auto height, uses aspect-ratio
}

export function UploadZone({
  onFileSelect,
  onBase64,
  onFromAssets,
  onFromGallery,
  accept = "image/*",
  multiple = false,
  size = 'md',
  aspectRatio,
  themeColor = 'blue',
  variant = 'default',
  icon,
  title,
  subtitle,
  children,
  disabled = false,
  className = "",
  showQuickActions = false,
}: UploadZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const theme = themeClasses[themeColor]

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      // Check if file matches accept pattern
      if (accept && !checkFileType(file, accept)) {
        console.warn('File type not accepted:', file.type)
        return
      }
      
      if (onFileSelect) {
        onFileSelect(file)
      }
      if (onBase64) {
        const base64 = await fileToBase64(file)
        onBase64(base64)
      }
    }
  }

  const checkFileType = (file: File, accept: string): boolean => {
    const acceptPatterns = accept.split(',').map(p => p.trim())
    return acceptPatterns.some(pattern => {
      if (pattern === '*/*') return true
      if (pattern.endsWith('/*')) {
        const type = pattern.replace('/*', '')
        return file.type.startsWith(type)
      }
      return file.type === pattern
    })
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (onFileSelect) {
        onFileSelect(file)
      }
      if (onBase64) {
        const base64 = await fileToBase64(file)
        onBase64(base64)
      }
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // Build classes based on variant
  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
        return 'p-2'
      case 'minimal':
        return 'p-4 border-zinc-200'
      default:
        return 'p-4'
    }
  }

  const sizeClass = size === 'auto' && aspectRatio ? 'w-full' : sizeClasses[size]
  
  const baseClasses = `
    rounded-xl border-2 border-dashed border-zinc-300 
    flex flex-col items-center justify-center gap-2 
    transition-all cursor-pointer relative
    ${theme.border} ${theme.bg}
    ${isDragging ? `${theme.dragBorder} ${theme.dragBg}` : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${getVariantClasses()}
  `

  // Render content based on size and variant
  const renderContent = () => {
    if (children) return children

    // For xs/sm sizes, show minimal content
    if (size === 'xs' || size === 'sm') {
      return (
        <>
          {icon || <Plus className={`w-6 h-6 ${theme.iconColor}`} />}
          {title && <span className="text-xs text-zinc-500">{title}</span>}
        </>
      )
    }

    // Default content
    return (
      <>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme.iconBg}`}>
          {icon || <Upload className={`w-6 h-6 ${theme.iconColor}`} />}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700">
            {title || t.common?.upload || 'Upload'}
          </p>
          {subtitle !== '' && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {subtitle ?? (t.common?.clickToUploadOrDrag || 'Click to upload or drag & drop')}
            </p>
          )}
        </div>
      </>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main upload area */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${baseClasses} ${sizeClass}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {renderContent()}
        
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl z-10">
            <p className={`text-sm font-medium ${theme.iconColor}`}>
              {t.common?.dropHere || 'Drop here'}
            </p>
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      {showQuickActions && (onFromAssets || onFromGallery) && (
        <div className="grid grid-cols-2 gap-2">
          {onFromAssets && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFromAssets()
              }}
              className="h-9 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 flex items-center justify-center gap-1.5 transition-colors text-xs text-zinc-600"
            >
              <FolderHeart className="w-3.5 h-3.5" />
              {t.common?.fromAssets || 'From Assets'}
            </button>
          )}
          {onFromGallery && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFromGallery()
              }}
              className="h-9 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 flex items-center justify-center gap-1.5 transition-colors text-xs text-zinc-600"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {t.common?.fromGallery || 'From Photos'}
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

// Export the old DropZone for backwards compatibility
export { UploadZone as DropZone }
