"use client"

import { useState } from "react"
import Image from "next/image"
import { Plus, ChevronRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Asset, AssetType, ModelStyle } from "@/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAssetStore } from "@/stores/assetStore"

// Demo preset assets
const demoPresets: Record<AssetType, Asset[]> = {
  model: [
    { id: "m1", type: "model", name: "Model 1", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", styleCategory: "western" },
    { id: "m2", type: "model", name: "Model 2", imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", styleCategory: "korean" },
    { id: "m3", type: "model", name: "Model 3", imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", styleCategory: "japanese" },
    { id: "m4", type: "model", name: "Model 4", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", styleCategory: "chinese" },
  ],
  background: [
    { id: "b1", type: "background", name: "Studio White", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
    { id: "b2", type: "background", name: "Urban Street", imageUrl: "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?w=400" },
    { id: "b3", type: "background", name: "Nature", imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400" },
    { id: "b4", type: "background", name: "Minimalist", imageUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=400" },
  ],
  vibe: [
    { id: "v1", type: "vibe", name: "Luxury", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
    { id: "v2", type: "vibe", name: "Casual", imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400" },
    { id: "v3", type: "vibe", name: "Sporty", imageUrl: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400" },
    { id: "v4", type: "vibe", name: "Vintage", imageUrl: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400" },
  ],
  product: [],
}

interface AssetSelectorProps {
  title: string
  type: AssetType
  selected: Asset | null
  onSelect: (asset: Asset | null) => void
  modelStyle?: ModelStyle
}

export function AssetSelector({ title, type, selected, onSelect, modelStyle }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get presets based on type and optional model style filter
  let presets = demoPresets[type] || []
  if (type === "model" && modelStyle && modelStyle !== "auto") {
    presets = presets.filter(p => p.styleCategory === modelStyle)
  }
  
  // Display max 5 items in the preview
  const displayPresets = presets.slice(0, 4)
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="text-xs text-accent flex items-center gap-1 hover:text-accent-light transition-colors">
              查看更多 <ChevronRight className="w-3 h-3" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 py-4 overflow-y-auto max-h-[50vh]">
              {/* Clear selection option */}
              <button
                onClick={() => {
                  onSelect(null)
                  setIsOpen(false)
                }}
                className={cn(
                  "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-colors",
                  !selected ? "border-accent text-accent" : "border-border text-gray-500 hover:border-border-light"
                )}
              >
                <span className="text-xs">Auto</span>
              </button>
              {presets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selected?.id === asset.id}
                  onClick={() => {
                    onSelect(asset)
                    setIsOpen(false)
                  }}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {/* Add button */}
        <button className="w-16 h-16 flex-shrink-0 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-gray-500 hover:border-border-light hover:text-gray-400 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
        
        {/* Asset previews */}
        {displayPresets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => onSelect(selected?.id === asset.id ? null : asset)}
            className={cn(
              "relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden",
              selected?.id === asset.id && "ring-2 ring-accent ring-offset-2 ring-offset-primary"
            )}
          >
            <Image
              src={asset.imageUrl}
              alt={asset.name || "Asset"}
              fill
              className="object-cover"
            />
            {selected?.id === asset.id && (
              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-accent" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function AssetCard({
  asset,
  isSelected,
  onClick
}: {
  asset: Asset
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden transition-all",
        isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-[#1A1A1A]"
      )}
    >
      <Image
        src={asset.imageUrl}
        alt={asset.name || "Asset"}
        fill
        className="object-cover"
      />
      {isSelected && (
        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-accent" />
        </div>
      )}
      {asset.name && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-xs text-white truncate">{asset.name}</p>
        </div>
      )}
    </button>
  )
}

