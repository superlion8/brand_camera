"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { 
  ArrowLeft, ArrowRight, Plus, X, Upload, Camera, 
  Shirt, HardHat, Footprints, Loader2, AlertCircle, Wand2, SlidersHorizontal
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fileToBase64 } from "@/lib/utils"
import { useLanguageStore } from "@/stores/languageStore"
import { ProductCategory } from "@/types/outfit"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { Asset } from "@/types"

// 只使用5个类型（去掉配饰）
const VALID_CATEGORIES: ProductCategory[] = ["内衬", "上衣", "裤子", "帽子", "鞋子"]

// 部位定义
interface OutfitSlot {
  id: ProductCategory
  label: string
  icon: React.ReactNode
  product?: {
    imageUrl: string
  }
}

// 初始部位配置
const getInitialSlots = (t: any): OutfitSlot[] => [
  { id: "帽子", label: "帽子", icon: <HardHat className="w-5 h-5" /> },
  { id: "上衣", label: "上衣", icon: <Shirt className="w-5 h-5" /> },
  { id: "内衬", label: "内衬", icon: <Shirt className="w-5 h-5 opacity-60" /> },
  { id: "裤子", label: "裤子", icon: <Shirt className="w-5 h-5 rotate-180" /> },
  { id: "鞋子", label: "鞋子", icon: <Footprints className="w-5 h-5" /> },
]

export default function ProStudioOutfitPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal } = useQuota()
  const { addTask, initImageSlots } = useGenerationTaskStore()
  const { userModels, userBackgrounds } = useAssetStore()
  const presetStore = usePresetStore()
  
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots())
  const [draggedSlotId, setDraggedSlotId] = useState<ProductCategory | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ProductCategory | null>(null)
  
  // 模特和背景选择
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'bg'>('model')
  
  // 从 sessionStorage 读取第一张和第二张商品
  useEffect(() => {
    // 读取第一张商品
    const product1Image = sessionStorage.getItem('product1Image')
    if (product1Image) {
      // 第一张商品需要分析类型（调用API）
      analyzeProduct(product1Image, (type) => {
        setSlots(prev => prev.map(slot => 
          slot.id === type
            ? { ...slot, product: { imageUrl: product1Image } }
            : slot
        ))
      })
    }
    
    // 读取第二张商品分析结果
    const product2AnalysisStr = sessionStorage.getItem('product2Analysis')
    if (product2AnalysisStr) {
      try {
        const analysis = JSON.parse(product2AnalysisStr)
        setSlots(prev => prev.map(slot => 
          slot.id === analysis.type
            ? { ...slot, product: { imageUrl: analysis.imageUrl } }
            : slot
        ))
      } catch (e) {
        console.error('Failed to parse product2Analysis:', e)
      }
    }
  }, [])
  
  // 分析商品类型
  const analyzeProduct = async (imageBase64: string, callback: (type: ProductCategory) => void) => {
    try {
      const response = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })
      const result = await response.json()
      if (result.success) {
        callback(result.data.type as ProductCategory)
      }
    } catch (error) {
      console.error('Failed to analyze product:', error)
    }
  }
  
  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    setIsAnalyzing(true)
    setAnalyzeError(null)
    
    try {
      const base64 = await fileToBase64(file)
      
      // 分析商品类型
      await analyzeProduct(base64, (type) => {
        // 如果分析出的类型和目标槽位不同，放到分析出的类型对应的槽位
        setSlots(prev => prev.map(slot => 
          slot.id === type
            ? { ...slot, product: { imageUrl: base64 } }
            : slot
        ))
      })
      
    } catch (error: any) {
      console.error('Upload failed:', error)
      setAnalyzeError(error.message || '上传失败')
    } finally {
      setIsAnalyzing(false)
      setUploadTargetSlot(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  // 点击空槽位触发上传
  const handleSlotClick = (slotId: ProductCategory) => {
    setUploadTargetSlot(slotId)
    fileInputRef.current?.click()
  }
  
  // 清除槽位
  const handleClearSlot = (slotId: ProductCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, product: undefined } : slot
    ))
  }
  
  // 拖拽开始
  const handleDragStart = (slotId: ProductCategory) => {
    setDraggedSlotId(slotId)
  }
  
  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedSlotId(null)
  }
  
  // 拖拽放置
  const handleDrop = (targetSlotId: ProductCategory) => {
    if (!draggedSlotId || draggedSlotId === targetSlotId) return
    
    const sourceSlot = slots.find(s => s.id === draggedSlotId)
    const targetSlot = slots.find(s => s.id === targetSlotId)
    
    if (sourceSlot?.product) {
      // 交换两个槽位的商品
      setSlots(prev => prev.map(slot => {
        if (slot.id === draggedSlotId) {
          return { ...slot, product: targetSlot?.product }
        }
        if (slot.id === targetSlotId) {
          return { ...slot, product: sourceSlot.product }
        }
        return slot
      }))
    }
    
    setDraggedSlotId(null)
  }
  
  // 开始生成
  const handleShootIt = async () => {
    // 收集所有商品图片
    const products = slots
      .filter(slot => slot.product)
      .map(slot => slot.product!.imageUrl)
    
    if (products.length === 0) {
      alert('请至少添加一个商品')
      return
    }
    
    const hasQuota = await checkQuota(6) // Pro Studio 生成6张图
    if (!hasQuota) return
    
    triggerFlyToGallery()
    
    // 创建任务
    const taskId = addTask('pro_studio', products[0], {}, 6)
    initImageSlots(taskId, 6)
    
    // TODO: 调用生成API，传入所有商品图片
    // 这里需要修改生成API支持多商品
    router.push('/pro-studio')
  }
  
  // 获取选中的模特和背景
  const selectedModel = selectedModelId 
    ? [...presetStore.visibleModels, ...userModels].find(m => m.id === selectedModelId)
    : null
  const selectedBg = selectedBgId
    ? [...presetStore.visibleBackgrounds, ...userBackgrounds].find(b => b.id === selectedBgId)
    : null
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-medium">搭配商品</span>
          <div className="w-10" />
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="p-4 pb-32">
        {/* 人体模型和槽位 */}
        <div className="flex flex-col items-center gap-6 mb-6">
          {/* 这里可以放一个人体模型图 */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {slots.map(slot => {
              const isDragging = draggedSlotId === slot.id
              return (
                <motion.div
                  key={slot.id}
                  layout
                  draggable={!!slot.product}
                  onDragStart={() => handleDragStart(slot.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(slot.id)}
                  onClick={() => !slot.product && handleSlotClick(slot.id)}
                  className={`
                    aspect-[3/4] rounded-xl relative cursor-pointer
                    ${slot.product 
                      ? 'bg-zinc-800 ring-2 ring-white/20' 
                      : 'bg-zinc-800/50 border-2 border-dashed border-zinc-600 hover:border-zinc-400'}
                    ${isDragging ? 'opacity-50 scale-95' : ''}
                    transition-all duration-200
                  `}
                  whileHover={{ scale: slot.product ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {slot.product ? (
                    <>
                      <Image
                        src={slot.product.imageUrl}
                        alt={slot.label}
                        fill
                        className="object-cover rounded-xl"
                      />
                      <button
                        onClick={(e) => handleClearSlot(slot.id, e)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-xl">
                        <p className="text-white text-xs font-medium truncate">{slot.label}</p>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      {slot.icon}
                      <span className="text-zinc-500 text-xs">{slot.label}</span>
                      <Plus className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
        
        {/* 自定义配置按钮 */}
        <div className="flex justify-center mb-4">
          <button 
            onClick={() => setShowCustomPanel(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm font-medium">自定义模特/背景</span>
          </button>
        </div>
      </div>
      
      {/* 底部 Shoot It 按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-zinc-800 p-4 pb-safe">
        <motion.button
          onClick={handleShootIt}
          className="w-full h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
        >
          <Wand2 className="w-5 h-5" />
          Shoot It
        </motion.button>
      </div>
      
      {/* 文件上传 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />
      
      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
      />
    </div>
  )
}

