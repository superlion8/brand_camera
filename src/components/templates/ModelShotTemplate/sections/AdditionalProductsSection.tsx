"use client"

import { useRef } from "react"
import Image from "next/image"
import { Plus, X, ZoomIn } from "lucide-react"
import { fileToBase64 } from "@/lib/utils"

interface AdditionalProductsSectionProps {
  // State
  products: string[]
  maxProducts: number
  mode: 'single' | 'array'
  isDesktop: boolean
  // Actions
  onAddProduct: (image: string, fromPhone: boolean) => void
  onRemoveProduct: (index: number) => void
  onZoom: (imageUrl: string) => void
  onSelectFromAssets: () => void
  // Translations
  t: any
  // Optional styling
  className?: string
}

export function AdditionalProductsSection({
  products,
  maxProducts,
  mode,
  isDesktop,
  onAddProduct,
  onRemoveProduct,
  onZoom,
  onSelectFromAssets,
  t,
  className = "",
}: AdditionalProductsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      onAddProduct(base64, true)
    }
    e.target.value = ""
  }

  const totalAllowed = maxProducts + 1 // Main product + additional
  const canAddMore = products.length < maxProducts

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-zinc-100 p-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-900">
          {t.proStudio?.additionalProducts || "Additional Products"} 
          <span className="text-zinc-400 font-normal ml-1">
            ({t.common?.optional || "Optional"})
          </span>
        </h3>
        <span className="text-xs text-zinc-400">
          {mode === 'array' 
            ? `Max ${totalAllowed} ${t.common?.items || 'items'}`
            : ''
          }
        </span>
      </div>
      
      {/* Product Grid */}
      <div className="flex gap-2 flex-wrap">
        {/* Existing Products */}
        {products.map((product, index) => (
          <div 
            key={index} 
            className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 group cursor-pointer"
            onClick={() => onZoom(product)}
          >
            <Image
              src={product}
              alt={`Product ${index + 2}`}
              fill
              className="object-cover"
              unoptimized
            />
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveProduct(index)
              }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Zoom hint */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
        
        {/* Add Button */}
        {canAddMore && (
          <button
            onClick={onSelectFromAssets}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-colors flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50/50"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const file = e.dataTransfer.files?.[0]
              if (file && file.type.startsWith('image/')) {
                const base64 = await fileToBase64(file)
                onAddProduct(base64, true)
              }
            }}
          >
            <Plus className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </div>
      
      {/* Warning message */}
      <p className="text-xs text-zinc-400 mt-3">
        {t.proStudio?.maxItemsWarning || `Max ${totalAllowed} products total. Too many items may affect quality.`}
      </p>
    </div>
  )
}
