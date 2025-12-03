"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus, ChevronRight, Check, X, Pin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Asset, AssetType, ModelStyle } from "@/types"
import { useAssetStore } from "@/stores/assetStore"
import { PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_VIBES } from "@/data/presets"
import { useLanguageStore } from "@/stores/languageStore"

// Preset assets from centralized data
const demoPresets: Record<AssetType, Asset[]> = {
  model: PRESET_MODELS,
  background: PRESET_BACKGROUNDS,
  vibe: PRESET_VIBES,
  product: [],
}

// Helper to sort by pinned status
const sortByPinned = (assets: Asset[]) => 
  [...assets].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

interface AssetSelectorProps {
  title?: string
  type: AssetType
  selected: Asset | null
  onSelect: (asset: Asset | null) => void
  modelStyle?: ModelStyle
  compact?: boolean
  showViewMore?: boolean
}

export function AssetSelector({ title, type, selected, onSelect, modelStyle, compact = false, showViewMore = false }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { userModels, userBackgrounds, userVibes } = useAssetStore()
  const t = useLanguageStore(state => state.t)
  
  // Get user assets based on type
  const getUserAssets = (): Asset[] => {
    switch (type) {
      case "model": return userModels
      case "background": return userBackgrounds
      case "vibe": return userVibes
      default: return []
    }
  }
  
  // Get presets based on type and optional model style filter
  let presets = demoPresets[type] || []
  if (type === "model" && modelStyle && modelStyle !== "auto") {
    presets = presets.filter(p => p.styleCategory === modelStyle)
  }
  
  // Merge user assets (sorted by pinned) with presets
  const userAssets = sortByPinned(getUserAssets())
  const allAssets = [...userAssets, ...presets]
  
  // Display items
  const displayPresets = compact ? allAssets.slice(0, 6) : allAssets.slice(0, 4)
  
  if (compact) {
    // Compact grid view for tabs
    const hasMore = allAssets.length > displayPresets.length
    const typeLabel = type === "model" ? t.common.model : type === "background" ? t.common.background : t.common.vibe
    
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {displayPresets.length === 0 ? (
            <div className="col-span-3 text-center text-zinc-400 text-sm py-8">
              {t.assets.noAssets || `No ${typeLabel} assets`}
            </div>
          ) : (
            displayPresets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onSelect(selected?.id === asset.id ? null : asset)}
                className={cn(
                  "aspect-square rounded-lg overflow-hidden relative border-2 transition-all group",
                  selected?.id === asset.id 
                    ? "border-blue-600 ring-2 ring-blue-200" 
                    : "border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                )}
              >
                <Image
                  src={asset.imageUrl}
                  alt={asset.name || "Asset"}
                  fill
                  className="object-cover"
                />
                {selected?.id === asset.id && (
                  <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-white drop-shadow-md" />
                  </div>
                )}
                {asset.isPinned && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
                    <Pin className="w-2.5 h-2.5" />
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                  <p className="text-[10px] text-white truncate text-center">{asset.name}</p>
                </div>
              </button>
            ))
          )}
        </div>
        
        {/* View More button */}
        {showViewMore && hasMore && (
          <button
            onClick={() => setIsOpen(true)}
            className="w-full py-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            {t.home.viewAll} ({allAssets.length})
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        
        {/* Full sheet modal for viewing all assets */}
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950" onClick={() => setIsOpen(false)}>
            {/* Header */}
            <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b bg-white dark:bg-zinc-900">
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </button>
              <h3 className="text-zinc-900 dark:text-white font-bold">{t.common.select || 'Select'} {typeLabel}</h3>
              <div className="w-10" />
            </div>
            
            {/* Content */}
            <div className="p-4" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-3 gap-3">
                {/* Clear selection option */}
                <button
                  onClick={() => {
                    onSelect(null)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                    !selected 
                      ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-zinc-400"
                  )}
                >
                  <span className="text-xs font-medium">{t.common.random}</span>
                </button>
                
                {allAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      onSelect(asset)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden transition-all border-2",
                      selected?.id === asset.id 
                        ? "border-blue-600 ring-2 ring-blue-200" 
                        : "border-transparent"
                    )}
                  >
                    <Image
                      src={asset.imageUrl}
                      alt={asset.name || "Asset"}
                      fill
                      className="object-cover"
                    />
                    {selected?.id === asset.id && (
                      <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                    {asset.isPinned && (
                      <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <Pin className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {asset.name && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-xs text-white truncate">{asset.name}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-500 text-xs font-semibold uppercase">{title}</h3>
        <button 
          onClick={() => setIsOpen(true)}
          className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors"
        >
          {t.home.viewAll} <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {/* Add button */}
        <button className="w-16 h-16 flex-shrink-0 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
        
        {/* Asset previews */}
        {displayPresets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => onSelect(selected?.id === asset.id ? null : asset)}
            className={cn(
              "relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden transition-all border-2",
              selected?.id === asset.id 
                ? "border-blue-600 ring-2 ring-blue-200" 
                : "border-transparent"
            )}
          >
            <Image
              src={asset.imageUrl}
              alt={asset.name || "Asset"}
              fill
              className="object-cover"
            />
            {selected?.id === asset.id && (
              <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-white drop-shadow-md" />
              </div>
            )}
            {asset.isPinned && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center">
                <Pin className="w-2 h-2" />
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Full sheet modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950" onClick={() => setIsOpen(false)}>
          {/* Header */}
          <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b bg-white dark:bg-zinc-900">
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>
            <h3 className="text-zinc-900 dark:text-white font-bold">{title}</h3>
            <div className="w-10" />
          </div>
          
          {/* Content */}
          <div className="p-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-3">
              {/* Clear selection option */}
              <button
                onClick={() => {
                  onSelect(null)
                  setIsOpen(false)
                }}
                className={cn(
                  "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                  !selected 
                    ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-zinc-400"
                )}
              >
                <span className="text-xs font-medium">Auto</span>
              </button>
              
              {allAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "relative aspect-square rounded-xl overflow-hidden transition-all border-2",
                    selected?.id === asset.id 
                      ? "border-blue-600 ring-2 ring-blue-200" 
                      : "border-transparent"
                  )}
                >
                  <Image
                    src={asset.imageUrl}
                    alt={asset.name || "Asset"}
                    fill
                    className="object-cover"
                  />
                  {selected?.id === asset.id && (
                    <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  )}
                  {asset.isPinned && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
                      <Pin className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {asset.name && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-xs text-white truncate">{asset.name}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
