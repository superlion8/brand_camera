"use client"

import { ReactNode, useRef } from "react"
import Image from "next/image"
import { ArrowLeft, Plus, X, ZoomIn, Check, Sparkles } from "lucide-react"
import { Asset } from "@/types"
import { fileToBase64 } from "@/lib/utils"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"

interface ReviewModeLayoutProps {
  // Header
  title: string
  onBack: () => void
  
  // Main Product
  mainProductImage: string | null
  onMainProductChange: () => void
  onMainProductZoom: (url: string) => void
  
  // Additional Products
  additionalProducts: string[]
  maxAdditionalProducts: number
  onAddProduct: () => void
  onRemoveProduct: (index: number) => void
  onDropProduct?: (base64: string) => void
  additionalProductsTip?: string
  
  // Models
  models: Asset[]
  selectedModelId: string | null
  onSelectModel: (id: string | null) => void
  onModelUpload: () => void
  onModelZoom: (url: string) => void
  onViewMoreModels: () => void
  modelUploadRef?: React.RefObject<HTMLInputElement>
  onModelDrop?: (base64: string) => void
  
  // Backgrounds
  backgrounds: Asset[]
  selectedBgId: string | null
  onSelectBg: (id: string | null) => void
  onBgUpload: () => void
  onBgZoom: (url: string) => void
  onViewMoreBgs: () => void
  bgUploadRef?: React.RefObject<HTMLInputElement>
  onBgDrop?: (base64: string) => void
  
  // Generate
  creditCost: number
  onGenerate: () => void
  generateButtonText?: string
  
  // Translations
  t: any
  
  // Optional: custom left column bottom content
  leftColumnExtra?: ReactNode
  
  // Optional: show model count display
  displayModelCount?: number
  displayBgCount?: number
}

export function ReviewModeLayout({
  title,
  onBack,
  mainProductImage,
  onMainProductChange,
  onMainProductZoom,
  additionalProducts,
  maxAdditionalProducts,
  onAddProduct,
  onRemoveProduct,
  onDropProduct,
  additionalProductsTip,
  models,
  selectedModelId,
  onSelectModel,
  onModelUpload,
  onModelZoom,
  onViewMoreModels,
  modelUploadRef,
  onModelDrop,
  backgrounds,
  selectedBgId,
  onSelectBg,
  onBgUpload,
  onBgZoom,
  onViewMoreBgs,
  bgUploadRef,
  onBgDrop,
  creditCost,
  onGenerate,
  generateButtonText,
  t,
  leftColumnExtra,
  displayModelCount = 8,
  displayBgCount = 8,
}: ReviewModeLayoutProps) {
  const selectedModel = selectedModelId ? models.find(m => m.id === selectedModelId) : null
  const selectedBg = selectedBgId ? backgrounds.find(b => b.id === selectedBgId) : null
  const totalProducts = 1 + additionalProducts.length
  const canAddMore = additionalProducts.length < maxAdditionalProducts

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          </div>
        </div>
      </div>
      
      {/* Three-column content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex gap-6">
          {/* Left: Main Product + Additional Products + Generate Button */}
          <div className="w-[320px] shrink-0 space-y-4">
            {/* Main Product */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">
                  {t.proStudio?.mainProduct || 'Main Product'}
                </span>
                <button onClick={onMainProductChange} className="text-xs text-zinc-500 hover:text-zinc-700">
                  {t.common?.change || 'Change'}
                </button>
              </div>
              <div 
                className="aspect-square relative bg-zinc-50 cursor-pointer group"
                onClick={() => mainProductImage && onMainProductZoom(mainProductImage)}
              >
                {mainProductImage && (
                  <>
                    <img src={mainProductImage} alt="Product" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Additional Products */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-900">
                  {t.proStudio?.additionalProducts || 'Additional Products'} 
                  <span className="text-zinc-400 font-normal ml-1">({t.common?.optional || 'Optional'})</span>
                </span>
                <span className="text-xs text-zinc-400">
                  {t.proStudio?.maxItems?.replace('{count}', String(maxAdditionalProducts + 1)) || `Max ${maxAdditionalProducts + 1} items`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {/* Existing additional products */}
                {additionalProducts.map((product, index) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden relative group border border-zinc-200">
                    <img src={product} alt={`Product ${index + 2}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => onRemoveProduct(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                {canAddMore && (
                  <div
                    onClick={onAddProduct}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                      const file = e.dataTransfer.files?.[0]
                      if (file && file.type.startsWith('image/') && onDropProduct) {
                        const base64 = await fileToBase64(file)
                        onDropProduct(base64)
                      }
                    }}
                    className="aspect-square rounded-lg border-2 border-dashed border-zinc-300 hover:border-amber-400 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-5 h-5 text-zinc-400" />
                    <span className="text-[10px] text-zinc-400">{t.common?.add || 'Add'}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-3">
                {additionalProductsTip || t.proStudio?.maxItemsWarning || 'Max 4 products. Too many may affect quality.'}
              </p>
            </div>
            
            {/* Optional extra content */}
            {leftColumnExtra}
            
            {/* Generate Button */}
            <button
              onClick={onGenerate}
              className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-200/50"
            >
              <Sparkles className="w-5 h-5" />
              {generateButtonText || t.proStudio?.startGenerate || 'Start Generate'}
              <CreditCostBadge cost={creditCost} className="ml-2" />
            </button>
          </div>
          
          {/* Middle: Model Selection */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900">
                  {t.proStudio?.selectModel || 'Select Model'} 
                  <span className="text-zinc-400 font-normal text-sm ml-1">
                    ({t.proStudio?.randomMatch || 'random if not selected'})
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  {selectedModel && (
                    <button onClick={() => onSelectModel(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                      {t.common?.clear || 'Clear'}
                    </button>
                  )}
                  {models.length > displayModelCount && (
                    <button onClick={onViewMoreModels} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                      {t.common?.viewMore || 'View More'} ({models.length})
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">{t.proStudio?.randomMatch || 'Random if not selected'}</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Upload button */}
                <div
                  onClick={onModelUpload}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                    const file = e.dataTransfer.files?.[0]
                    if (file && file.type.startsWith('image/') && onModelDrop) {
                      const base64 = await fileToBase64(file)
                      onModelDrop(base64)
                    }
                  }}
                  className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-amber-400 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-zinc-400" />
                  <span className="text-[10px] text-zinc-400">{t.common?.upload || 'Upload'}</span>
                </div>
                {/* Model list */}
                {models.slice(0, displayModelCount).map(model => (
                  <div
                    key={model.id}
                    className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all group ${
                      selectedModelId === model.id
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : 'border-transparent hover:border-amber-300'
                    }`}
                  >
                    <button
                      onClick={() => onSelectModel(selectedModelId === model.id ? null : model.id)}
                      className="absolute inset-0"
                    >
                      <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" unoptimized />
                    </button>
                    {selectedModelId === model.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onModelZoom(model.imageUrl) }}
                      className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ZoomIn className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Right: Background Selection */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900">
                  {t.proStudio?.selectBg || 'Select Background'}
                  <span className="text-zinc-400 font-normal text-sm ml-1">
                    ({t.proStudio?.randomMatch || 'random if not selected'})
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  {selectedBg && (
                    <button onClick={() => onSelectBg(null)} className="text-xs text-zinc-500 hover:text-zinc-700">
                      {t.common?.clear || 'Clear'}
                    </button>
                  )}
                  {backgrounds.length > displayBgCount && (
                    <button onClick={onViewMoreBgs} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                      {t.common?.viewMore || 'View More'} ({backgrounds.length})
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">{t.proStudio?.randomMatch || 'Random if not selected'}</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Upload button */}
                <div
                  onClick={onBgUpload}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                    const file = e.dataTransfer.files?.[0]
                    if (file && file.type.startsWith('image/') && onBgDrop) {
                      const base64 = await fileToBase64(file)
                      onBgDrop(base64)
                    }
                  }}
                  className="aspect-[3/4] rounded-lg border-2 border-dashed border-zinc-300 hover:border-amber-400 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-zinc-400" />
                  <span className="text-[10px] text-zinc-400">{t.common?.upload || 'Upload'}</span>
                </div>
                {/* Background list */}
                {backgrounds.slice(0, displayBgCount).map(bg => (
                  <div
                    key={bg.id}
                    className={`aspect-[3/4] rounded-lg overflow-hidden relative border-2 transition-all group ${
                      selectedBgId === bg.id 
                        ? 'border-amber-500 ring-2 ring-amber-500/30' 
                        : 'border-transparent hover:border-amber-300'
                    }`}
                  >
                    <button
                      onClick={() => onSelectBg(selectedBgId === bg.id ? null : bg.id)}
                      className="absolute inset-0"
                    >
                      <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" unoptimized />
                    </button>
                    {selectedBgId === bg.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onBgZoom(bg.imageUrl) }}
                      className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ZoomIn className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
