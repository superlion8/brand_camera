"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Check, ChevronRight, Search, X, Plus, Sparkles } from "lucide-react"
import { useModelCreateStore, BrandInfo } from "@/stores/modelCreateStore"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/stores/languageStore"

// Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/brand_logos'

interface BrandLogo {
  name: string
  displayName: string
  logoUrl: string
}

export default function ModelCreateBrands() {
  const router = useRouter()
  const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  
  const {
    productImages,
    selectedBrands,
    addBrand,
    removeBrand,
    setCurrentStep,
  } = useModelCreateStore()
  const { t } = useTranslation()
  
  // 如果没有商品图，返回上一步
  useEffect(() => {
    if (productImages.length === 0) {
      router.push('/model-create')
    }
  }, [productImages, router])
  
  // 从 Storage 加载品牌 logo
  useEffect(() => {
    const loadBrandLogos = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.storage
          .from('presets')
          .list('brand_logos')
        
        if (error) throw error
        
        const logos: BrandLogo[] = (data || [])
          .filter(file => file.name.endsWith('.png') || file.name.endsWith('.jpg'))
          .map(file => {
            // 从文件名提取品牌名：acne_studios_logo.png -> Acne Studios
            const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg)$/i, '')
            const nameWithoutLogo = nameWithoutExt.replace(/_logo$/i, '')
            const displayName = nameWithoutLogo
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
            
            return {
              name: nameWithoutLogo,
              displayName,
              logoUrl: `${STORAGE_URL}/${file.name}`,
            }
          })
        
        setBrandLogos(logos)
      } catch (error) {
        console.error('Failed to load brand logos:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadBrandLogos()
  }, [])
  
  // 搜索过滤
  const filteredBrands = brandLogos.filter(brand =>
    brand.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // 检查品牌是否已选中 - 使用 displayName 匹配（因为添加时用的是 displayName）
  const isBrandSelected = (displayName: string) => {
    return selectedBrands.some(b => b.name.toLowerCase() === displayName.toLowerCase())
  }
  
  // 选择品牌
  const handleSelectBrand = (brand: BrandLogo) => {
    if (isBrandSelected(brand.displayName)) {
      const index = selectedBrands.findIndex(
        b => b.name.toLowerCase() === brand.displayName.toLowerCase()
      )
      if (index !== -1) removeBrand(index)
    } else if (selectedBrands.length < 4) {
      addBrand({
        name: brand.displayName,
        logoUrl: brand.logoUrl,
        isCustom: false,
      })
    }
  }
  
  // 添加自定义品牌
  const handleAddCustomBrand = () => {
    if (customBrand.trim() && selectedBrands.length < 4) {
      addBrand({
        name: customBrand.trim(),
        isCustom: true,
      })
      setCustomBrand('')
      setShowCustomInput(false)
    }
  }
  
  // 下一步
  const handleNext = () => {
    if (selectedBrands.length >= 1) {
      setCurrentStep(3)
      router.push('/model-create/select')
    }
  }
  
  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50 via-white to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-violet-100/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push('/model-create')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-zinc-900">{t.modelCreate.selectBrandTitle}</span>
          </div>
          <div className="w-10" />
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  step <= 2 ? 'bg-violet-600' : 'bg-zinc-200'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span className="text-violet-600">✓ {t.modelCreate.stepProduct}</span>
            <span className="text-violet-600 font-medium">{t.modelCreate.stepBrand}</span>
            <span>{t.modelCreate.stepModel}</span>
            <span>{t.modelCreate.stepGenerate}</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate.selectBrandHeading}</h1>
          <p className="text-sm text-zinc-500">
            {t.modelCreate.selectBrandDesc}
          </p>
        </div>
        
        {/* Selected Brands */}
        {selectedBrands.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-700 mb-3">{t.modelCreate.selected} ({selectedBrands.length}/4)</h3>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {selectedBrands.map((brand, index) => (
                  <motion.div
                    key={brand.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 pl-3 pr-2 py-2 bg-violet-100 rounded-full"
                  >
                    {brand.logoUrl && (
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white">
                        <Image
                          src={brand.logoUrl}
                          alt={brand.name}
                          width={20}
                          height={20}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium text-violet-900">{brand.name}</span>
                    {brand.isCustom && (
                      <span className="text-xs text-violet-600 bg-violet-200 px-1.5 py-0.5 rounded">{t.modelCreate.custom}</span>
                    )}
                    <button
                      onClick={() => removeBrand(index)}
                      className="w-5 h-5 rounded-full bg-violet-200 hover:bg-violet-300 flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3 text-violet-700" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder={t.modelCreate.searchBrand}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>
        
        {/* Custom Brand Input */}
        {showCustomInput ? (
          <div className="mb-4 p-4 bg-violet-50 rounded-xl">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t.modelCreate.enterBrandName}
                value={customBrand}
                onChange={(e) => setCustomBrand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomBrand()}
                className="flex-1 px-4 py-2 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                autoFocus
              />
              <button
                onClick={handleAddCustomBrand}
                disabled={!customBrand.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t.modelCreate.add}
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="px-3 py-2 bg-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4 text-zinc-600" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={selectedBrands.length >= 4}
            className="w-full mb-4 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{t.modelCreate.enterCustomBrand}</span>
          </button>
        )}
        
        {/* Brand Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-square bg-zinc-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredBrands.map((brand) => {
              const isSelected = isBrandSelected(brand.displayName)
              return (
                <motion.button
                  key={brand.name}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectBrand(brand)}
                  disabled={!isSelected && selectedBrands.length >= 4}
                  className={`relative aspect-square rounded-xl border-2 transition-all overflow-hidden ${
                    isSelected
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-zinc-100 bg-white hover:border-violet-200 disabled:opacity-50'
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <Image
                      src={brand.logoUrl}
                      alt={brand.displayName}
                      width={80}
                      height={80}
                      className="object-contain max-h-full"
                    />
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white text-center font-medium truncate px-2">
                      {brand.displayName}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
        
        {filteredBrands.length === 0 && !isLoading && (
          <div className="text-center py-12 text-zinc-400">
            <p>{t.modelCreate.noMatchingBrand}</p>
            <p className="text-sm mt-1">{t.modelCreate.tryCustomBrand}</p>
          </div>
        )}
      </div>
      
      {/* Bottom Action - Above bottom nav */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto">
        <button
          onClick={handleNext}
          disabled={selectedBrands.length === 0}
          className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
            selectedBrands.length > 0
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200'
              : 'bg-zinc-300 cursor-not-allowed'
          }`}
        >
          <span>{t.modelCreate.nextAnalysis}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

