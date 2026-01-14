"use client"

import Image from "next/image"
import { Plus, ZoomIn } from "lucide-react"
import { Asset } from "@/types"

interface BackgroundSelectionSectionProps {
  // State
  backgrounds: Asset[]
  selectedBgId: string | null
  isDesktop: boolean
  // Actions
  onSelectBg: (id: string | null) => void
  onUpload: () => void
  onViewMore: () => void
  onZoom: (imageUrl: string) => void
  // Translations
  t: any
  // Optional: random text
  randomText?: string
  // Display count
  displayCount?: number
  // Optional styling
  className?: string
  // Alternative title (e.g., "Scene" for Lifestyle)
  title?: string
}

export function BackgroundSelectionSection({
  backgrounds,
  selectedBgId,
  isDesktop,
  onSelectBg,
  onUpload,
  onViewMore,
  onZoom,
  t,
  randomText,
  displayCount = 6,
  className = "",
  title,
}: BackgroundSelectionSectionProps) {
  const selectedBg = selectedBgId ? backgrounds.find(b => b.id === selectedBgId) : null
  const displayBackgrounds = backgrounds.slice(0, displayCount)
  const hasMore = backgrounds.length > displayCount

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-900">
          {title || t.proStudio?.selectBackground || "Select Background"}
          <span className="text-zinc-400 font-normal ml-1">
            ({randomText || t.common?.randomIfNotSelected || "random if not selected"})
          </span>
        </h3>
        {hasMore && (
          <button
            onClick={onViewMore}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {t.common?.viewMore || "View More"} ({backgrounds.length})
          </button>
        )}
      </div>
      
      <p className="text-xs text-zinc-500 mb-2">
        {randomText || t.common?.randomIfNotSelected || "Random if not selected"}
      </p>
      
      <div className={`grid gap-2 ${isDesktop ? 'grid-cols-3' : 'grid-cols-3'}`}>
        {/* Upload Button */}
        <button
          onClick={onUpload}
          className="aspect-[4/3] rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50"
        >
          <Plus className="w-6 h-6 text-zinc-400 mb-1" />
          <span className="text-xs text-zinc-500">{t.common?.upload || "Upload"}</span>
        </button>
        
        {/* Background Cards */}
        {displayBackgrounds.map((bg) => {
          const isSelected = selectedBgId === bg.id
          return (
            <div
              key={bg.id}
              onClick={() => onSelectBg(isSelected ? null : bg.id)}
              className={`aspect-[4/3] rounded-xl overflow-hidden relative cursor-pointer group transition-all ${
                isSelected
                  ? "ring-2 ring-blue-500 ring-offset-2"
                  : "hover:ring-2 hover:ring-zinc-300"
              }`}
            >
              <Image
                src={bg.imageUrl}
                alt={bg.name || "Background"}
                fill
                className="object-cover"
                unoptimized
              />
              {/* Zoom on hover */}
              <div 
                className="absolute bottom-2 right-2 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onZoom(bg.imageUrl)
                }}
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </div>
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
