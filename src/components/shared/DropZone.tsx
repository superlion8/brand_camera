"use client"

import { useState, useRef, ReactNode, DragEvent, ChangeEvent } from "react"
import { Upload } from "lucide-react"
import { useTranslation } from "@/stores/languageStore"

interface DropZoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  className?: string
  children?: ReactNode
  // Custom content
  icon?: ReactNode
  title?: string
  subtitle?: string
  // Theme color for hover state
  themeColor?: 'amber' | 'pink' | 'blue' | 'purple'
  // Aspect ratio
  aspectRatio?: string
  // Disabled state
  disabled?: boolean
}

const themeClasses = {
  amber: {
    border: 'hover:border-amber-400',
    bg: 'hover:bg-amber-50/50',
    dragBorder: 'border-amber-400',
    dragBg: 'bg-amber-50',
  },
  pink: {
    border: 'hover:border-pink-400',
    bg: 'hover:bg-pink-50/50',
    dragBorder: 'border-pink-400',
    dragBg: 'bg-pink-50',
  },
  blue: {
    border: 'hover:border-blue-400',
    bg: 'hover:bg-blue-50/50',
    dragBorder: 'border-blue-400',
    dragBg: 'bg-blue-50',
  },
  purple: {
    border: 'hover:border-purple-400',
    bg: 'hover:bg-purple-50/50',
    dragBorder: 'border-purple-400',
    dragBg: 'bg-purple-50',
  },
}

export function DropZone({
  onFileSelect,
  accept = "image/*",
  className = "",
  children,
  icon,
  title,
  subtitle,
  themeColor = 'amber',
  aspectRatio,
  disabled = false,
}: DropZoneProps) {
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      // Check if file matches accept pattern
      if (accept) {
        const acceptPatterns = accept.split(',').map(p => p.trim())
        const isAccepted = acceptPatterns.some(pattern => {
          if (pattern === '*/*') return true
          if (pattern.endsWith('/*')) {
            const type = pattern.replace('/*', '')
            return file.type.startsWith(type)
          }
          return file.type === pattern
        })
        if (!isAccepted) {
          console.warn('File type not accepted:', file.type)
          return
        }
      }
      onFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const baseClasses = `
    rounded-2xl border-2 border-dashed border-zinc-300 
    flex flex-col items-center justify-center gap-3 
    transition-all cursor-pointer
    ${theme.border} ${theme.bg}
    ${isDragging ? `${theme.dragBorder} ${theme.dragBg}` : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `

  return (
    <>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${baseClasses} ${className}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {children || (
          <>
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
              {icon || <Upload className="w-8 h-8 text-zinc-400" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700">
                {title || t.common?.upload || 'Upload'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {subtitle || t.common?.clickToUploadOrDrag || 'Click to upload or drag & drop'}
              </p>
            </div>
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                <p className="text-sm font-medium text-zinc-600">
                  {t.common?.dropHere || 'Drop here'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
