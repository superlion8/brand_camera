"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus, ChevronRight, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Asset, AssetType, ModelStyle } from "@/types"

// Demo preset assets
const demoPresets: Record<AssetType, Asset[]> = {
  model: [
    { id: "m1", type: "model", name: "Japanese Style", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", styleCategory: "japanese" },
    { id: "m2", type: "model", name: "Korean Clean", imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", styleCategory: "korean" },
    { id: "m3", type: "model", name: "Chinese Modern", imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", styleCategory: "chinese" },
    { id: "m4", type: "model", name: "Western Casual", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", styleCategory: "western" },
  ],
  background: [
    { id: "b1", type: "background", name: "Minimal Studio", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
    { id: "b2", type: "background", name: "Urban Street", imageUrl: "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?w=400" },
    { id: "b3", type: "background", name: "Nature Soft", imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400" },
    { id: "b4", type: "background", name: "Minimalist", imageUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=400" },
  ],
  vibe: [
    { id: "v1", type: "vibe", name: "Warm & Cozy", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
    { id: "v2", type: "vibe", name: "Cool & Edgy", imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400" },
    { id: "v3", type: "vibe", name: "Sporty", imageUrl: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400" },
    { id: "v4", type: "vibe", name: "Vintage", imageUrl: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400" },
  ],
  product: [],
}

interface AssetSelectorProps {
  title?: string
  type: AssetType
  selected: Asset | null
  onSelect: (asset: Asset | null) => void
  modelStyle?: ModelStyle
  compact?: boolean
}

export function AssetSelector({ title, type, selected, onSelect, modelStyle, compact = false }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get presets based on type and optional model style filter
  let presets = demoPresets[type] || []
  if (type === "model" && modelStyle && modelStyle !== "auto") {
    presets = presets.filter(p => p.styleCategory === modelStyle)
  }
  
  // Display items
  const displayPresets = compact ? presets.slice(0, 6) : presets.slice(0, 4)
  
  if (compact) {
    // Compact grid view for tabs
    return (
      <div className="grid grid-cols-3 gap-3">
        {displayPresets.length === 0 ? (
          <div className="col-span-3 text-center text-zinc-400 text-sm py-8">
            暂无{type === "model" ? "模特" : type === "background" ? "背景" : "氛围"}资产
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
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                <p className="text-[10px] text-white truncate text-center">{asset.name}</p>
              </div>
            </button>
          ))
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
          查看更多 <ChevronRight className="w-3 h-3" />
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
              
              {presets.map((asset) => (
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
