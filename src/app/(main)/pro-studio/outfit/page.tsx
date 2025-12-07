"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { 
  ArrowLeft, ArrowRight, Plus, X, Upload, Camera, 
  Shirt, HardHat, Footprints, Loader2, AlertCircle, Wand2, SlidersHorizontal,
  Check, ZoomIn
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fileToBase64, generateId, ensureBase64 } from "@/lib/utils"
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
const getInitialSlots = (): OutfitSlot[] => [
  { id: "帽子", label: "帽子", icon: <HardHat className="w-5 h-5" /> },
  { id: "上衣", label: "上衣", icon: <Shirt className="w-5 h-5" /> },
  { id: "内衬", label: "内衬", icon: <Shirt className="w-5 h-5 opacity-60" /> },
  { id: "裤子", label: "裤子", icon: <Shirt className="w-5 h-5 rotate-180" /> },
  { id: "鞋子", label: "鞋子", icon: <Footprints className="w-5 h-5" /> },
]

// Asset Grid Component with Upload Button
function AssetGrid({ 
  items, 
  selectedId, 
  onSelect,
  onUpload,
  onZoom,
  emptyText = "暂无资源",
  uploadLabel = "Upload"
}: { 
  items: Asset[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  emptyText?: string
  uploadLabel?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {onUpload && (
        <button
          onClick={onUpload}
          className="aspect-[3/4] rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50"
        >
          <Plus className="w-10 h-10 text-zinc-400" />
          <span className="text-sm text-zinc-500 mt-2">{uploadLabel || 'Upload'}</span>
        </button>
      )}
      {items.map(item => (
        <div
          key={item.id}
          className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
            selectedId === item.id 
              ? "border-blue-500 ring-2 ring-blue-500/30" 
              : "border-transparent hover:border-blue-300"
          }`}
        >
          <button
            onClick={() => onSelect(item.id)}
            className="absolute inset-0"
          >
            <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
          </button>
          {selectedId === item.id && (
            <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          {onZoom && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onZoom(item.imageUrl)
              }}
              className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-white" />
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
            <p className="text-xs text-white truncate text-center">{item.name}</p>
          </div>
        </div>
      ))}
      {items.length === 0 && !onUpload && (
        <div className="col-span-2 flex flex-col items-center justify-center py-12 text-zinc-400">
          <p className="text-sm">{emptyText}</p>
        </div>
      )}
    </div>
  )
}

// Background Grid with categories and Upload Button
function BackgroundGrid({
  selectedId,
  onSelect,
  onUpload,
  onZoom,
  uploadLabel = "Upload",
  labels,
  bgLight = [],
  bgSolid = [],
  bgPattern = [],
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  uploadLabel?: string
  labels?: { all: string; light: string; solid: string; pattern: string }
  bgLight?: Asset[]
  bgSolid?: Asset[]
  bgPattern?: Asset[]
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'light' | 'solid' | 'pattern'>('all')
  
  const allBgs = [...bgLight, ...bgSolid, ...bgPattern]
  
  const bgMap = {
    all: allBgs,
    light: bgLight,
    solid: bgSolid,
    pattern: bgPattern,
  }
  
  const tabs = [
    { id: 'all', label: labels?.all || 'All', count: allBgs.length },
    { id: 'light', label: labels?.light || 'Light', count: bgLight.length },
    { id: 'solid', label: labels?.solid || 'Solid', count: bgSolid.length },
    { id: 'pattern', label: labels?.pattern || 'Pattern', count: bgPattern.length },
  ]
  
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 border border-zinc-200"
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {onUpload && (
          <button
            onClick={onUpload}
            className="aspect-square rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-blue-50"
          >
            <Plus className="w-8 h-8 text-zinc-400" />
            <span className="text-xs text-zinc-500 mt-1">{uploadLabel || 'Upload'}</span>
          </button>
        )}
        {bgMap[activeTab].map(item => (
          <div
            key={item.id}
            className={`aspect-square rounded-xl overflow-hidden relative border-2 transition-all ${
              selectedId === item.id 
                ? "border-blue-500 ring-2 ring-blue-500/30" 
                : "border-transparent hover:border-blue-300"
            }`}
          >
            <button
              onClick={() => onSelect(item.id)}
              className="absolute inset-0"
            >
              <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
            </button>
            {selectedId === item.id && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            {onZoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onZoom(item.imageUrl)
                }}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProStudioOutfitPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal } = useQuota()
  const { addTask, initImageSlots } = useGenerationTaskStore()
  const { userModels, userBackgrounds, addUserAsset } = useAssetStore()
  const presetStore = usePresetStore()
  
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots())
  const [draggedSlotId, setDraggedSlotId] = useState<ProductCategory | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ProductCategory | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // 模特和背景选择
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'bg'>('model')
  
  // 自定义上传的资产
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customBgs, setCustomBgs] = useState<Asset[]>([])
  
  // 加载预设资源
  useEffect(() => {
    presetStore.loadPresets()
  }, [presetStore])
  
  // 获取所有模特和背景
  const studioModels = presetStore.visibleModels || []
  const studioBackgroundsLight = presetStore.getAllStudioBackgrounds().filter(bg => bg.name?.includes('Light') || bg.name?.includes('light'))
  const studioBackgroundsSolid = presetStore.getAllStudioBackgrounds().filter(bg => bg.name?.includes('Solid') || bg.name?.includes('solid'))
  const studioBackgroundsPattern = presetStore.getAllStudioBackgrounds().filter(bg => bg.name?.includes('Pattern') || bg.name?.includes('pattern'))
  
  // 处理模特上传
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-model-${Date.now()}`,
        type: 'model',
        name: `自定义模特`,
        imageUrl: base64,
      }
      setCustomModels(prev => [newModel, ...prev])
      setSelectedModelId(newModel.id)
      addUserAsset(newModel)
    }
    e.target.value = ''
  }
  
  // 处理背景上传
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newBg: Asset = {
        id: `custom-bg-${Date.now()}`,
        type: 'background',
        name: `自定义背景`,
        imageUrl: base64,
      }
      setCustomBgs(prev => [newBg, ...prev])
      setSelectedBgId(newBg.id)
      addUserAsset(newBg)
    }
    e.target.value = ''
  }
  
  // 从 sessionStorage 读取商品分析结果
  useEffect(() => {
    // 读取第一张商品分析结果
    const product1AnalysisStr = sessionStorage.getItem('product1Analysis')
    if (product1AnalysisStr) {
      try {
        const analysis = JSON.parse(product1AnalysisStr)
        setSlots(prev => prev.map(slot => 
          slot.id === analysis.type
            ? { ...slot, product: { imageUrl: analysis.imageUrl } }
            : slot
        ))
        sessionStorage.removeItem('product1Analysis')
      } catch (e) {
        console.error('Failed to parse product1Analysis:', e)
      }
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
        sessionStorage.removeItem('product2Analysis')
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
  
  // 英文标签映射
  const labelMap: Record<ProductCategory, string> = {
    '帽子': 'HAT',
    '上衣': 'TOP',
    '内衬': 'INNER',
    '裤子': 'BOTTOM',
    '鞋子': 'SHOES'
  }
  
  // 渲染槽位卡片（用于人形图周围）- 参考图片设计
  const renderSlotCard = (slot: OutfitSlot | undefined, size: "hat" | "top" | "tall" | "shoes" = "top") => {
    if (!slot) return null
    
    // 根据类型设置不同尺寸 - 参考图片
    const sizeClasses = {
      hat: "w-24 h-24",      // 帽子 - 小正方形
      top: "w-32 h-40",      // 上衣 - 较大
      tall: "w-24 h-40",     // 内衬/裤子 - 高矩形
      shoes: "w-24 h-24"     // 鞋子 - 小正方形
    }
    
    const isDragging = draggedSlotId === slot.id
    
    return (
      <motion.div
        layout
        draggable={!!slot.product}
        onDragStart={() => handleDragStart(slot.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(slot.id)}
        onClick={() => !slot.product && handleSlotClick(slot.id)}
        className={`
          ${sizeClasses[size]} rounded-2xl relative cursor-pointer
          bg-white shadow-md
          ${isDragging ? 'opacity-50 scale-95' : ''}
          transition-all duration-200
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {slot.product ? (
          <>
            <Image
              src={slot.product.imageUrl}
              alt={slot.label}
              fill
              className="object-cover rounded-2xl"
            />
            <button
              onClick={(e) => handleClearSlot(slot.id, e)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Plus className="w-5 h-5 text-zinc-400" />
            <span className="text-zinc-500 text-xs font-medium tracking-wider">{labelMap[slot.id]}</span>
          </div>
        )}
      </motion.div>
    )
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
    
    // 获取选中的模特和背景
    const selectedModel = selectedModelId 
      ? [...customModels, ...studioModels, ...userModels].find(m => m.id === selectedModelId)
      : null
    const selectedBg = selectedBgId
      ? [...customBgs, ...studioBackgroundsLight, ...studioBackgroundsSolid, ...studioBackgroundsPattern, ...userBackgrounds].find(b => b.id === selectedBgId)
      : null
    
    // 准备模特和背景数据
    const modelImageData = selectedModel ? await ensureBase64(selectedModel.imageUrl) : null
    const bgImageData = selectedBg ? await ensureBase64(selectedBg.imageUrl) : null
    
    // 调用生成API，传入所有商品图片
    try {
      // 简单模式：3张图
      const simplePromises = []
      for (let i = 0; i < 3; i++) {
        simplePromises.push(
          fetch('/api/generate-pro-studio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productImages: products, // 传入所有商品图片
              modelImage: modelImageData,
              backgroundImage: bgImageData,
              mode: 'simple',
              index: i,
              taskId,
              modelIsRandom: !selectedModel,
              bgIsRandom: !selectedBg,
              modelName: selectedModel?.name || '专业模特',
              bgName: selectedBg?.name || '影棚背景',
              modelUrl: selectedModel?.imageUrl,
              bgUrl: selectedBg?.imageUrl,
              modelIsPreset: selectedModel ? !customModels.find(m => m.id === selectedModel.id) : true,
              bgIsPreset: selectedBg ? !customBgs.find(b => b.id === selectedBg.id) : true,
            })
          })
        )
      }
      
      // 扩展模式：3张图
      const extendedPromises = []
      for (let i = 0; i < 3; i++) {
        extendedPromises.push(
          fetch('/api/generate-pro-studio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productImages: products, // 传入所有商品图片
              modelImage: modelImageData,
              backgroundImage: bgImageData,
              mode: 'extended',
              index: i + 3,
              taskId,
              modelIsRandom: !selectedModel,
              bgIsRandom: !selectedBg,
              modelName: selectedModel?.name || '专业模特',
              bgName: selectedBg?.name || '影棚背景',
              modelUrl: selectedModel?.imageUrl,
              bgUrl: selectedBg?.imageUrl,
              modelIsPreset: selectedModel ? !customModels.find(m => m.id === selectedModel.id) : true,
              bgIsPreset: selectedBg ? !customBgs.find(b => b.id === selectedBg.id) : true,
            })
          })
        )
      }
      
      // 等待所有请求完成
      const results = await Promise.allSettled([...simplePromises, ...extendedPromises])
      
      // 检查是否有失败
      const failures = results.filter(r => r.status === 'rejected')
      if (failures.length > 0) {
        console.error('Some generations failed:', failures)
        alert(`有 ${failures.length} 张图片生成失败，请重试`)
        return
      }
      
      // 跳转到pro-studio页面，并设置模式为results
      sessionStorage.setItem('proStudioTaskId', taskId)
      router.push('/pro-studio?mode=results')
    } catch (error) {
      console.error('Generation failed:', error)
      alert('生成失败，请重试')
    }
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
      
      {/* 内容区域 - 参考图片设计 */}
      <div className="p-4 pb-32">
        {/* 主容器 - 浅灰色背景 */}
        <div className="relative w-full max-w-md mx-auto bg-[#f5f5f7] rounded-3xl min-h-[580px] overflow-hidden">
          {/* 人体轮廓 SVG - 居中 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 120 280"
              className="w-24 h-auto"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 头部 */}
              <circle cx="60" cy="20" r="15" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
              {/* 脖子 */}
              <line x1="60" y1="35" x2="60" y2="50" stroke="#d1d5db" strokeWidth="1.5" />
              {/* 肩膀 */}
              <line x1="30" y1="55" x2="90" y2="55" stroke="#d1d5db" strokeWidth="1.5" />
              {/* 身体轮廓 */}
              <path d="M 40 50 L 80 50 L 80 140 L 40 140 Z" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
              {/* 左臂 */}
              <path d="M 30 55 L 20 70 L 15 120" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
              {/* 右臂 */}
              <path d="M 90 55 L 100 70 L 105 120" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
              {/* 左腿 */}
              <path d="M 50 140 L 45 200 L 40 260" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
              {/* 右腿 */}
              <path d="M 70 140 L 75 200 L 80 260" stroke="#d1d5db" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          
          {/* 商品槽位 - 精确定位 */}
          {/* HAT 帽子 - 顶部居中 */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
            {renderSlotCard(slots.find(s => s.id === '帽子')!, 'hat')}
          </div>
          
          {/* INNER 内衬 - 左侧中间 */}
          <div className="absolute top-32 left-3 z-10">
            {renderSlotCard(slots.find(s => s.id === '内衬')!, 'tall')}
          </div>
          
          {/* TOP 上衣 - 右侧偏中 */}
          <div className="absolute top-28 right-3 z-10">
            {renderSlotCard(slots.find(s => s.id === '上衣')!, 'top')}
          </div>
          
          {/* BOTTOM 裤子 - 左下 */}
          <div className="absolute bottom-24 left-3 z-10">
            {renderSlotCard(slots.find(s => s.id === '裤子')!, 'tall')}
          </div>
          
          {/* SHOES 鞋子 - 右下 */}
          <div className="absolute bottom-6 right-3 z-10">
            {renderSlotCard(slots.find(s => s.id === '鞋子')!, 'shoes')}
          </div>
        </div>
        
        {/* 备用网格视图（隐藏） */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-md mx-auto mt-6 hidden">
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
        
        {/* 自定义配置按钮 */}
        <div className="flex justify-center mt-6">
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
      
      {/* 自定义配置面板 */}
      <AnimatePresence>
        {showCustomPanel && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowCustomPanel(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold text-lg">自定义配置</span>
                <button 
                  onClick={() => setShowCustomPanel(false)} 
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                >
                  完成
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                {[
                  { id: "model", label: "专业模特" },
                  { id: "bg", label: "棚拍背景" }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveCustomTab(tab.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeCustomTab === tab.id 
                        ? "bg-black text-white" 
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                {activeCustomTab === "model" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">选择模特（不选则随机）</span>
                      {selectedModelId && (
                        <button 
                          onClick={() => setSelectedModelId(null)}
                          className="text-xs text-blue-600"
                        >
                          清除选择
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={[...customModels, ...userModels, ...studioModels]} 
                      selectedId={selectedModelId} 
                      onSelect={(id) => setSelectedModelId(selectedModelId === id ? null : id)}
                      onUpload={() => modelUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadLabel="上传"
                    />
                  </div>
                )}
                {activeCustomTab === "bg" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">选择背景（不选则随机）</span>
                      {selectedBgId && (
                        <button 
                          onClick={() => setSelectedBgId(null)}
                          className="text-xs text-blue-600"
                        >
                          清除选择
                        </button>
                      )}
                    </div>
                    <BackgroundGrid 
                      selectedId={selectedBgId} 
                      onSelect={(id) => setSelectedBgId(selectedBgId === id ? null : id)}
                      onUpload={() => bgUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadLabel="上传"
                      labels={{ 
                        all: "全部", 
                        light: "Light", 
                        solid: "Solid", 
                        pattern: "Pattern" 
                      }}
                      bgLight={studioBackgroundsLight}
                      bgSolid={studioBackgroundsSolid}
                      bgPattern={studioBackgroundsPattern}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* 全屏图片预览 */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <img src={fullscreenImage} alt="Preview" className="max-w-full max-h-full object-contain" />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 文件上传 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />
      <input 
        type="file" 
        ref={modelUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleModelUpload}
      />
      <input 
        type="file" 
        ref={bgUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleBgUpload}
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

