"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { 
  ArrowLeft, ArrowRight, Plus, X, Upload, Camera, 
  Shirt, HardHat, Footprints, Watch, Loader2, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fileToBase64, compressBase64Image } from "@/lib/utils"
import { useLanguageStore } from "@/stores/languageStore"
import { ProductAnalysis, ProductCategory } from "@/types/outfit"

// 部位定义
interface OutfitSlot {
  id: ProductCategory
  label: string
  icon: React.ReactNode
  product?: {
    imageUrl: string
    material?: string
    fit?: string
  }
}

// 初始部位配置
const getInitialSlots = (t: any): OutfitSlot[] => [
  { id: "帽子", label: t.outfit?.hat || "帽子", icon: <HardHat className="w-5 h-5" /> },
  { id: "上衣", label: t.outfit?.top || "上衣", icon: <Shirt className="w-5 h-5" /> },
  { id: "内衬", label: t.outfit?.inner || "内衬", icon: <Shirt className="w-5 h-5 opacity-60" /> },
  { id: "裤子", label: t.outfit?.pants || "裤子", icon: <Shirt className="w-5 h-5 rotate-180" /> },
  { id: "鞋子", label: t.outfit?.shoes || "鞋子", icon: <Footprints className="w-5 h-5" /> },
  { id: "配饰", label: t.outfit?.accessory || "配饰", icon: <Watch className="w-5 h-5" /> },
]

export default function OutfitPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots(t))
  const [draggedSlotId, setDraggedSlotId] = useState<ProductCategory | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ProductCategory | null>(null)
  
  // 从 sessionStorage 读取分析结果
  useEffect(() => {
    const analysisStr = sessionStorage.getItem('productAnalysis')
    if (analysisStr) {
      try {
        const analysis: ProductAnalysis = JSON.parse(analysisStr)
        // 找到对应的槽位并填入
        setSlots(prev => prev.map(slot => 
          slot.id === analysis.type 
            ? {
                ...slot,
                product: {
                  imageUrl: analysis.imageUrl,
                  material: analysis.material,
                  fit: analysis.fit
                }
              }
            : slot
        ))
        // 清除 sessionStorage
        sessionStorage.removeItem('productAnalysis')
      } catch (e) {
        console.error('Failed to parse analysis:', e)
      }
    }
  }, [])
  
  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    setIsAnalyzing(true)
    setAnalyzeError(null)
    
    try {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1024, 0.85)
      
      // 调用分析 API
      const response = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '分析失败')
      }
      
      // 更新槽位
      const analysisType = result.data.type as ProductCategory
      
      // 如果分析出的类型和目标槽位不同，问用户要放哪里
      // 这里简化处理：直接放到分析出的类型对应的槽位
      setSlots(prev => prev.map(slot => 
        slot.id === analysisType
          ? {
              ...slot,
              product: {
                imageUrl: compressed,
                material: result.data.material,
                fit: result.data.fit
              }
            }
          : slot
      ))
      
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
  
  // 统计已填充的槽位数量
  const filledCount = slots.filter(s => s.product).length
  
  // 下一步
  const handleNext = () => {
    // 保存当前搭配到 sessionStorage
    const outfitData = slots.reduce((acc, slot) => {
      if (slot.product) {
        acc[slot.id] = slot.product
      }
      return acc
    }, {} as Record<ProductCategory, { imageUrl: string; material?: string; fit?: string }>)
    
    sessionStorage.setItem('outfitData', JSON.stringify(outfitData))
    router.push('/camera/outfit/select')
  }
  
  // 渲染槽位卡片
  const renderSlotCard = (slot: OutfitSlot, size: "large" | "medium" | "small" = "medium") => {
    const sizeClasses = {
      large: "w-28 h-36",
      medium: "w-24 h-32",
      small: "w-20 h-28"
    }
    
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
          ${sizeClasses[size]} rounded-xl relative cursor-pointer
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
            {/* 清除按钮 */}
            <button
              onClick={(e) => handleClearSlot(slot.id, e)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            {/* 标签 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-xl">
              <p className="text-white text-xs font-medium truncate">{slot.label}</p>
              {slot.product.material && (
                <p className="text-white/60 text-[10px] truncate">{slot.product.material}</p>
              )}
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
  }
  
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
          <span className="text-white font-medium">{t.outfit?.title || '搭配商品'}</span>
          <div className="w-10" />
        </div>
      </div>
      
      {/* 分析中遮罩 */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center"
          >
            <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
            <p className="text-white font-medium">{t.outfit?.analyzing || '分析中...'}</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 错误提示 */}
      <AnimatePresence>
        {analyzeError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-50 bg-red-500/90 backdrop-blur p-4 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            <p className="text-white text-sm flex-1">{analyzeError}</p>
            <button onClick={() => setAnalyzeError(null)}>
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 主内容区 - 人形布局 */}
      <div className="px-4 py-6">
        {/* 提示文案 */}
        <div className="text-center mb-6">
          <p className="text-zinc-400 text-sm">
            {t.outfit?.hint || '点击空位添加商品，拖拽可调整位置'}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            {t.outfit?.hintSub || '已添加'} {filledCount} {t.outfit?.items || '件商品'}
          </p>
        </div>
        
        {/* 人形布局 */}
        <div className="flex flex-col items-center gap-4">
          {/* 顶部: 帽子 */}
          <div className="flex justify-center">
            {renderSlotCard(slots.find(s => s.id === "帽子")!, "medium")}
          </div>
          
          {/* 中间: 上衣 + 配饰 */}
          <div className="flex items-center gap-4">
            {renderSlotCard(slots.find(s => s.id === "配饰")!, "small")}
            {renderSlotCard(slots.find(s => s.id === "上衣")!, "large")}
            {renderSlotCard(slots.find(s => s.id === "内衬")!, "small")}
          </div>
          
          {/* 下面: 裤子 */}
          <div className="flex justify-center">
            {renderSlotCard(slots.find(s => s.id === "裤子")!, "large")}
          </div>
          
          {/* 底部: 鞋子 */}
          <div className="flex justify-center">
            {renderSlotCard(slots.find(s => s.id === "鞋子")!, "medium")}
          </div>
        </div>
        
        {/* 拍照添加更多按钮 */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push('/camera/shoot')}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
          >
            <Camera className="w-5 h-5 text-white" />
            <span className="text-white font-medium">{t.outfit?.addMore || '拍摄更多商品'}</span>
          </button>
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
        <button
          onClick={handleNext}
          disabled={filledCount === 0}
          className="w-full py-4 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{t.outfit?.next || '下一步：选择风格'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  )
}

