"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { 
  ArrowLeft, ArrowRight, Plus, X, Upload, Camera, 
  Shirt, HardHat, Footprints, Loader2, AlertCircle, Wand2, SlidersHorizontal,
  Check, ZoomIn, FolderHeart, ImageIcon
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { fileToBase64, generateId, ensureBase64 } from "@/lib/utils"
import { useLanguageStore } from "@/stores/languageStore"
import { ProductCategory } from "@/types/outfit"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useGenerationTaskStore, base64ToBlobUrl } from "@/stores/generationTaskStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { Asset } from "@/types"
import { PRESET_PRODUCTS } from "@/data/presets"

// 商品分类
type ProductSubTab = "all" | "top" | "pants" | "inner" | "shoes" | "hat"
const PRODUCT_SUB_TABS: ProductSubTab[] = ["all", "top", "pants", "inner", "shoes", "hat"]

// 商品分类翻译映射
const getProductCategoryLabel = (cat: ProductSubTab, t: any): string => {
  switch (cat) {
    case "all": return t.common?.all || "全部"
    case "top": return t.assets?.productTop || "上衣"
    case "pants": return t.assets?.productPants || "裤子"
    case "inner": return t.assets?.productInner || "内衬"
    case "shoes": return t.assets?.productShoes || "鞋子"
    case "hat": return t.assets?.productHat || "帽子"
    default: return cat
  }
}

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

function OutfitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, refreshQuota } = useQuota()
  const { addTask, initImageSlots, updateImageSlot } = useGenerationTaskStore()
  const { userModels, userBackgrounds, userProducts, addUserAsset } = useAssetStore()
  const presetStore = usePresetStore()
  
  // 从 URL 参数获取模式：camera (买家秀) 或 pro_studio (模特棚拍)
  const shootMode = searchParams.get('mode') === 'camera' ? 'camera' : 'pro_studio'
  const isCameraMode = shootMode === 'camera'
  
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots())
  const [draggedSlotId, setDraggedSlotId] = useState<ProductCategory | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null) // 拍摄用
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const bgUploadRef = useRef<HTMLInputElement>(null)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ProductCategory | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [showSlotOptions, setShowSlotOptions] = useState(false) // 空白框点击选项面板
  const [showAssetPicker, setShowAssetPicker] = useState(false) // 资产库选择面板
  const [assetPickerSource, setAssetPickerSource] = useState<"user" | "preset">("user") // 资产来源
  const [assetPickerSubTab, setAssetPickerSubTab] = useState<ProductSubTab>("all") // 商品二级分类
  const [touchDragSlotId, setTouchDragSlotId] = useState<ProductCategory | null>(null) // 触摸拖拽
  const touchDragSlotIdRef = useRef<ProductCategory | null>(null) // 用ref避免闭包问题
  const [dropTargetSlotId, setDropTargetSlotId] = useState<ProductCategory | null>(null) // 当前悬停的目标槽位
  
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
  
  // 拖动时锁定页面滚动
  useEffect(() => {
    if (touchDragSlotId) {
      // 保存原始样式
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY
      
      // 锁定页面
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      
      // 阻止所有触摸移动事件的默认行为
      const preventTouchMove = (e: TouchEvent) => {
        e.preventDefault()
      }
      document.addEventListener('touchmove', preventTouchMove, { passive: false })
      
      return () => {
        // 恢复原始样式
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        window.scrollTo(0, scrollY)
        document.removeEventListener('touchmove', preventTouchMove)
      }
    }
  }, [touchDragSlotId])
  
  // 获取所有模特和背景
  // studioModels 是专业棚拍模特（用于随机选择）
  const studioModels = presetStore.studioModels || []
  // 直接从 presetStore 获取分类背景
  const studioBackgroundsLight = presetStore.studioBackgroundsLight || []
  const studioBackgroundsSolid = presetStore.studioBackgroundsSolid || []
  const studioBackgroundsPattern = presetStore.studioBackgroundsPattern || []
  const allStudioBackgrounds = [...studioBackgroundsLight, ...studioBackgroundsSolid, ...studioBackgroundsPattern]
  
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
  
  // 用于确保 sessionStorage 只读取一次（避免 React Strict Mode 双重执行问题）
  const hasLoadedFromSession = useRef(false)
  
  // 清理 sessionStorage 的函数（只在 Shoot It 后调用）
  const clearSessionStorage = () => {
    sessionStorage.removeItem('product1Image')
    sessionStorage.removeItem('product1Type')
    sessionStorage.removeItem('product2Image')
    sessionStorage.removeItem('product2Type')
    console.log('[Outfit] Cleaned sessionStorage')
  }
  
  // 从 sessionStorage 读取商品图片（直接放到上衣和裤子槽位）
  useEffect(() => {
    // 防止 React Strict Mode 下重复执行
    if (hasLoadedFromSession.current) return
    
    // 读取第一张商品图片和类型
    const product1Image = sessionStorage.getItem('product1Image')
    const product1Type = sessionStorage.getItem('product1Type') as ProductCategory | null
    if (product1Image) {
      // 使用分析得到的类型，如果没有则默认放到"上衣"槽位
      const targetSlot = product1Type || '上衣'
      console.log('[Outfit] Loading product1 from sessionStorage, type:', targetSlot)
      setSlots(prev => prev.map(slot => 
        slot.id === targetSlot
          ? { ...slot, product: { imageUrl: product1Image } }
          : slot
      ))
    }
    
    // 读取第二张商品图片和类型
    const product2Image = sessionStorage.getItem('product2Image')
    const product2Type = sessionStorage.getItem('product2Type') as ProductCategory | null
    if (product2Image) {
      // 使用分析得到的类型，如果没有则默认放到"裤子"槽位
      const targetSlot = product2Type || '裤子'
      console.log('[Outfit] Loading product2 from sessionStorage, type:', targetSlot)
      setSlots(prev => prev.map(slot => 
        slot.id === targetSlot
          ? { ...slot, product: { imageUrl: product2Image } }
          : slot
      ))
    }
    
    // 标记为已加载（但不立即清理 sessionStorage，防止刷新后图片丢失）
    if (product1Image || product2Image) {
      hasLoadedFromSession.current = true
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
  
  // 处理文件上传（直接放到目标槽位，不分析）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    try {
      const base64 = await fileToBase64(file)
      // 直接放到目标槽位
      setSlots(prev => prev.map(slot => 
        slot.id === uploadTargetSlot
          ? { ...slot, product: { imageUrl: base64 } }
          : slot
      ))
    } catch (error: any) {
      console.error('Upload failed:', error)
    } finally {
      setUploadTargetSlot(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  // 点击空槽位显示选项面板
  const handleSlotClick = (slotId: ProductCategory) => {
    setUploadTargetSlot(slotId)
    setShowSlotOptions(true)
  }
  
  // 选择拍摄
  const handleCaptureOption = () => {
    setShowSlotOptions(false)
    cameraInputRef.current?.click()
  }
  
  // 选择从资产库上传
  const handleAssetOption = () => {
    setShowSlotOptions(false)
    fileInputRef.current?.click()
  }
  
  // 处理拍摄上传
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    try {
      const base64 = await fileToBase64(file)
      // 直接放到目标槽位
      setSlots(prev => prev.map(slot => 
        slot.id === uploadTargetSlot
          ? { ...slot, product: { imageUrl: base64 } }
          : slot
      ))
    } catch (error) {
      console.error('Capture failed:', error)
    } finally {
      setUploadTargetSlot(null)
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
      }
    }
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
  
  // 拖拽放置 - 支持桌面拖拽和触摸拖拽
  const handleDrop = (targetSlotId: ProductCategory) => {
    // 获取源槽位ID（桌面拖拽用draggedSlotId，触摸拖拽用touchDragSlotId）
    const sourceSlotId = draggedSlotId || touchDragSlotId
    if (!sourceSlotId || sourceSlotId === targetSlotId) return
    
    const sourceSlot = slots.find(s => s.id === sourceSlotId)
    const targetSlot = slots.find(s => s.id === targetSlotId)
    
    if (sourceSlot?.product) {
      // 交换两个槽位的商品
      setSlots(prev => prev.map(slot => {
        if (slot.id === sourceSlotId) {
          return { ...slot, product: targetSlot?.product }
        }
        if (slot.id === targetSlotId) {
          return { ...slot, product: sourceSlot.product }
        }
        return slot
      }))
    }
    
    setDraggedSlotId(null)
    setTouchDragSlotId(null)
  }
  
  // 英文标签映射
  const labelMap: Record<ProductCategory, string> = {
    '帽子': 'HAT',
    '上衣': 'TOP',
    '内衬': 'INNER',
    '裤子': 'BOTTOM',
    '鞋子': 'SHOES',
    '配饰': 'ACCESSORY'
  }
  
  // 渲染槽位卡片 - 更大的尺寸填满空间
  const renderSlotCard = (slot: OutfitSlot | undefined, size: "small" | "medium" | "large" = "medium") => {
    if (!slot) return null
    
    // 放大的尺寸
    const sizeClasses = {
      small: "w-[100px] h-[100px]",   // 帽子/鞋子 - 正方形
      medium: "w-[130px] h-[170px]",  // 内衬/裤子 - 竖长
      large: "w-[150px] h-[190px]"    // 上衣 - 最大
    }
    
    const isDragging = draggedSlotId === slot.id || touchDragSlotId === slot.id
    const isDropTarget = dropTargetSlotId === slot.id && !isDragging
    
    // 长按计时器
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)
    
    // 触摸拖拽事件 - 支持Safari
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!slot.product) return
      
      // 长按300ms后开始拖拽
      longPressTimer.current = setTimeout(() => {
        touchDragSlotIdRef.current = slot.id
        setTouchDragSlotId(slot.id)
        // 震动反馈（如果支持）
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, 300)
    }
    
    const handleTouchMove = (e: React.TouchEvent) => {
      // 如果还没开始拖拽，取消长按计时
      if (!touchDragSlotIdRef.current && longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      
      // 如果正在拖拽
      if (touchDragSlotIdRef.current) {
        e.preventDefault()
        
        // 检测当前触摸位置下的目标槽位
        const touch = e.touches[0]
        const element = document.elementFromPoint(touch.clientX, touch.clientY)
        const targetSlotElement = element?.closest('[data-slot-id]')
        
        if (targetSlotElement) {
          const targetId = targetSlotElement.getAttribute('data-slot-id') as ProductCategory
          if (targetId && targetId !== touchDragSlotIdRef.current) {
            setDropTargetSlotId(targetId)
          } else {
            setDropTargetSlotId(null)
          }
        } else {
          setDropTargetSlotId(null)
        }
      }
    }
    
    const handleTouchEnd = (e: React.TouchEvent) => {
      // 清除长按计时器
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      
      const currentDragSlotId = touchDragSlotIdRef.current
      if (!currentDragSlotId) return
      
      // 获取触摸结束位置
      const touch = e.changedTouches[0]
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      
      // 查找目标槽位
      const targetSlotElement = element?.closest('[data-slot-id]')
      if (targetSlotElement) {
        const targetSlotId = targetSlotElement.getAttribute('data-slot-id') as ProductCategory
        if (targetSlotId && targetSlotId !== currentDragSlotId) {
          // 直接交换，不调用handleDrop避免闭包问题
          const sourceSlot = slots.find(s => s.id === currentDragSlotId)
          const targetSlot = slots.find(s => s.id === targetSlotId)
          
          if (sourceSlot?.product) {
            setSlots(prev => prev.map(s => {
              if (s.id === currentDragSlotId) {
                return { ...s, product: targetSlot?.product }
              }
              if (s.id === targetSlotId) {
                return { ...s, product: sourceSlot.product }
              }
              return s
            }))
          }
        }
      }
      
      touchDragSlotIdRef.current = null
      setTouchDragSlotId(null)
      setDropTargetSlotId(null)
    }
    
    const handleTouchCancel = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      touchDragSlotIdRef.current = null
      setTouchDragSlotId(null)
      setDropTargetSlotId(null)
    }
    
    // 是否有任何卡片正在被拖动
    const isAnyDragging = !!touchDragSlotId || !!draggedSlotId
    
    return (
      <motion.div
        layout={!isAnyDragging} // 拖动时禁用layout动画，防止其他卡片移动
        data-slot-id={slot.id}
        draggable={!!slot.product}
        onDragStart={() => handleDragStart(slot.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(slot.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={() => !slot.product && handleSlotClick(slot.id)}
        style={{ 
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          // 拖动时禁止触摸操作
          touchAction: isAnyDragging ? 'none' : 'manipulation',
        }}
        className={`
          ${sizeClasses[size]} rounded-xl relative cursor-pointer
          bg-white select-none
          ${isDragging 
            ? 'z-50 shadow-2xl ring-4 ring-blue-500 ring-opacity-80' 
            : isDropTarget 
              ? 'ring-4 ring-green-500 ring-opacity-80 shadow-lg bg-green-50' 
              : 'shadow-md'
          }
        `}
        animate={
          isDragging 
            ? { 
                scale: 1.15, 
                rotate: [0, -2, 2, -2, 0],
                opacity: 0.9,
              }
            : isDropTarget
              ? { 
                  scale: 1.08,
                }
              : { scale: 1, rotate: 0, opacity: 1 }
        }
        transition={
          isDragging 
            ? { rotate: { repeat: Infinity, duration: 0.5 }, scale: { duration: 0.15 } } 
            : { duration: 0.15, type: "tween" }
        }
        whileHover={!isDragging && !isDropTarget && !isAnyDragging ? { scale: 1.02 } : {}}
        whileTap={!isDragging && !isAnyDragging ? { scale: 0.98 } : {}}
      >
        {slot.product ? (
          <>
            <Image
              src={slot.product.imageUrl}
              alt={slot.label}
              fill
              className="object-cover rounded-xl"
            />
            {/* 拖拽提示图标 - 只在非拖拽状态下显示 */}
            {!isDragging && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded-full flex items-center gap-1">
                <svg className="w-3 h-3 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <span className="text-[8px] text-white/80">{isDragging ? 'DROP' : 'DRAG'}</span>
              </div>
            )}
            {/* 删除按钮 */}
            <button
              onClick={(e) => handleClearSlot(slot.id, e)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Plus className={`w-5 h-5 ${isDropTarget ? 'text-green-500' : 'text-zinc-400'}`} />
            <span className={`text-[10px] font-medium ${isDropTarget ? 'text-green-600' : 'text-zinc-500'}`}>
              {isDropTarget ? 'DROP' : labelMap[slot.id]}
            </span>
          </div>
        )}
        
        {/* Drop 目标覆盖层 */}
        {isDropTarget && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-xl bg-green-500/10 border-2 border-dashed border-green-500 flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-green-600 text-xs font-bold"
            >
              ↓ DROP HERE ↓
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    )
  }
  
  // 开始生成
  const handleShootIt = async () => {
    // 收集服装项（按槽位 ID 分类）
    const outfitItems: {
      inner?: string   // 内衬
      top?: string     // 上衣
      pants?: string   // 裤子
      hat?: string     // 帽子
      shoes?: string   // 鞋子
    } = {}
    
    slots.forEach(slot => {
      if (slot.product) {
        switch (slot.id) {
          case '内衬': outfitItems.inner = slot.product.imageUrl; break
          case '上衣': outfitItems.top = slot.product.imageUrl; break
          case '裤子': outfitItems.pants = slot.product.imageUrl; break
          case '帽子': outfitItems.hat = slot.product.imageUrl; break
          case '鞋子': outfitItems.shoes = slot.product.imageUrl; break
        }
      }
    })
    
    // 向后兼容：同时收集所有商品图片用于显示
    const products = slots
      .filter(slot => slot.product)
      .map(slot => slot.product!.imageUrl)
    
    if (products.length === 0) {
      alert(t.outfit?.atLeastOneProduct || '请至少添加一个商品')
      return
    }
    
    const numImages = 6
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return
    
    triggerFlyToGallery()
    
    // 根据模式创建任务
    const taskType = isCameraMode ? 'camera' : 'pro_studio'
    const taskId = addTask(taskType, products[0], {}, numImages)
    initImageSlots(taskId, numImages)
    
    // 获取选中的模特和背景信息（只获取ID和URL，不加载图片）
    const allModels = [...customModels, ...studioModels, ...userModels]
    const allBgs = [...customBgs, ...allStudioBackgrounds, ...userBackgrounds]
    
    const selectedModel = selectedModelId 
      ? allModels.find(m => m.id === selectedModelId)
      : null
    const selectedBg = selectedBgId
      ? allBgs.find(b => b.id === selectedBgId)
      : null
    
    // 立即跳转到 processing 页面（不等待任何其他操作）
    clearSessionStorage()
    
    if (isCameraMode) {
      sessionStorage.setItem('cameraTaskId', taskId)
      router.push('/camera?mode=processing')
    } else {
      sessionStorage.setItem('proStudioTaskId', taskId)
      router.push('/pro-studio?mode=processing')
    }
    
    // 在后台创建 pending 记录（不阻塞跳转）
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: numImages,
        taskType,
      }),
    }).then(() => {
      console.log('[Outfit] Reserved', numImages, 'images for task', taskId)
      refreshQuota()
    }).catch(e => {
      console.warn('[Outfit] Failed to reserve quota:', e)
    })
    
    // 在后台加载图片并发起生成请求
    const generateInBackground = async () => {
      try {
        // 如果没有选择模特，标记为随机
        const isModelRandom = !selectedModel
        const isBgRandom = !selectedBg
        
        // 准备模特数据：直接使用 URL，后端会转换为 base64
        // 这样可以大幅减少请求体大小，避免 Cloudflare 超时
        let modelImageUrl: string | null
        if (selectedModel) {
          console.log('[Outfit] Using selected model:', selectedModel.name)
          modelImageUrl = selectedModel.imageUrl
        } else {
          console.log('[Outfit] No model selected, trying random model. studioModels count:', studioModels.length)
          // 如果没有预设模特，尝试使用用户上传的模特
          if (studioModels.length === 0 && userModels.length > 0) {
            console.log('[Outfit] No studio models, using user model instead')
            const randomUserModel = userModels[Math.floor(Math.random() * userModels.length)]
            modelImageUrl = randomUserModel.imageUrl
          } else if (studioModels.length > 0) {
            // 随机选择一个预设模特
            const randomIndex = Math.floor(Math.random() * studioModels.length)
            const randomModel = studioModels[randomIndex]
            console.log('[Outfit] Using random model:', randomModel?.name)
            modelImageUrl = randomModel?.imageUrl || null
          } else {
            modelImageUrl = null
          }
        }
        
        // 准备背景数据：直接使用 URL
        const bgImageUrl = selectedBg ? selectedBg.imageUrl : null
        
        if (!modelImageUrl) {
          console.error('[Outfit] Failed to get model URL - no models available')
          alert('无法获取模特图片，请手动选择一个模特')
          return
        }
        
        console.log('[Outfit] Model URL ready, starting generation...')
        
        // 根据模式选择不同的 API 和参数格式
        console.log('[Outfit] Mode:', isCameraMode ? 'camera' : 'pro_studio')
        console.log('[Outfit] Products count:', products.length)
        
        if (isCameraMode) {
          // 买家秀模式：使用 /api/generate-single，productImage/productImage2 格式
          // 直接发送 URL/base64，后端会处理转换
          const productImage = products[0] || null
          const productImage2 = products[1] || null
          
          // 简单模式：3张图
          // Helper function to create a single camera request with response handling
          const createCameraRequest = async (index: number, simpleMode: boolean) => {
            const mode = simpleMode ? 'simple' : 'extended'
            console.log(`[Outfit-Camera] Starting image ${index + 1} (${mode})`)
            updateImageSlot(taskId, index, { status: 'generating' })
            
            try {
              const response = await fetch('/api/generate-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'model',
                  productImage,
                  productImage2,
                  modelImage: modelImageUrl,
                  backgroundImage: bgImageUrl,
                  simpleMode,
                  index,
                  taskId,
                  modelIsRandom: isModelRandom,
                  bgIsRandom: isBgRandom,
                  modelName: selectedModel?.name || '模特',
                  bgName: selectedBg?.name || '背景',
                  modelUrl: selectedModel?.imageUrl,
                  bgUrl: selectedBg?.imageUrl,
                  modelIsPreset: selectedModel ? !customModels.find(m => m.id === selectedModel.id) : true,
                  bgIsPreset: selectedBg ? !customBgs.find(b => b.id === selectedBg.id) : true,
                })
              })
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
                console.log(`[Outfit-Camera] Image ${index + 1}: ✗ HTTP ${response.status}`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorData.error || `HTTP ${response.status}` 
                })
                return
              }
              
              const result = await response.json()
              if (result.success && result.image) {
                const imageUrl = result.image.startsWith('data:') 
                  ? base64ToBlobUrl(result.image) 
                  : result.image
                console.log(`[Outfit-Camera] Image ${index + 1}: ✓ (${result.modelType}, ${mode})`)
                updateImageSlot(taskId, index, {
                  status: 'completed',
                  imageUrl: imageUrl,
                  modelType: result.modelType,
                  genMode: mode,
                })
              } else {
                console.log(`[Outfit-Camera] Image ${index + 1}: ✗ (${result.error})`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: result.error || '生成失败' 
                })
              }
            } catch (e: any) {
              console.log(`[Outfit-Camera] Image ${index + 1}: ✗ (${e.message})`)
              updateImageSlot(taskId, index, { 
                status: 'failed', 
                error: e.message || '网络错误' 
              })
            }
          }
          
          // 简单模式：3张图（index 0, 1, 2）
          const simplePromises = [0, 1, 2].map(i => createCameraRequest(i, true))
          
          // 扩展模式：3张图（index 3, 4, 5）
          const extendedPromises = [3, 4, 5].map(i => createCameraRequest(i, false))
          
          // 等待所有请求完成
          console.log('[Outfit-Camera] Sending 6 requests (3 simple + 3 extended)...')
          const allResults = await Promise.allSettled([...simplePromises, ...extendedPromises])
          console.log('[Outfit-Camera] All requests completed')
          
          // 检查是否全部失败，退还额度
          const allFailed = allResults.every(r => r.status === 'rejected')
          if (allFailed) {
            console.log('[Outfit] All camera tasks failed, refunding quota')
            try {
              await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
              refreshQuota()
            } catch (e) {
              console.warn('[Outfit] Failed to refund quota:', e)
            }
          }
        } else {
          // 模特棚拍模式：使用 /api/generate-pro-studio，outfitItems 格式
          // Helper function to create a single request with response handling
          const createProStudioRequest = async (index: number, mode: 'simple' | 'extended') => {
            console.log(`[Outfit-ProStudio] Starting image ${index + 1} (${mode})`)
            updateImageSlot(taskId, index, { status: 'generating' })
            
            try {
              const response = await fetch('/api/generate-pro-studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  outfitItems, // 新格式：独立的服装项 { inner?, top?, pants?, hat?, shoes? }
                  productImages: products, // 向后兼容
                  modelImage: modelImageUrl,  // 发送 URL，后端转换 base64
                  backgroundImage: bgImageUrl,  // 发送 URL，后端转换 base64
                  mode,
                  index,
                  taskId,
                  modelIsRandom: isModelRandom,
                  bgIsRandom: isBgRandom,
                  modelName: selectedModel?.name || '专业模特',
                  bgName: selectedBg?.name || '影棚背景',
                  modelUrl: selectedModel?.imageUrl,
                  bgUrl: selectedBg?.imageUrl,
                  modelIsPreset: selectedModel ? !customModels.find(m => m.id === selectedModel.id) : true,
                  bgIsPreset: selectedBg ? !customBgs.find(b => b.id === selectedBg.id) : true,
                })
              })
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
                console.log(`[Outfit-ProStudio] Image ${index + 1}: ✗ HTTP ${response.status}`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorData.error || `HTTP ${response.status}` 
                })
                return
              }
              
              const result = await response.json()
              if (result.success && result.image) {
                const imageUrl = result.image.startsWith('data:') 
                  ? base64ToBlobUrl(result.image) 
                  : result.image
                console.log(`[Outfit-ProStudio] Image ${index + 1}: ✓ (${result.modelType}, ${mode})`)
                updateImageSlot(taskId, index, {
                  status: 'completed',
                  imageUrl: imageUrl,
                  modelType: result.modelType,
                  genMode: mode,
                })
              } else {
                console.log(`[Outfit-ProStudio] Image ${index + 1}: ✗ (${result.error})`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: result.error || '生成失败' 
                })
              }
            } catch (e: any) {
              console.log(`[Outfit-ProStudio] Image ${index + 1}: ✗ (${e.message})`)
              updateImageSlot(taskId, index, { 
                status: 'failed', 
                error: e.message || '网络错误' 
              })
            }
          }
          
          // 简单模式：3张图（index 0, 1, 2）
          const simplePromises = [0, 1, 2].map(i => createProStudioRequest(i, 'simple'))
          
          // 扩展模式：3张图（index 3, 4, 5）
          const extendedPromises = [3, 4, 5].map(i => createProStudioRequest(i, 'extended'))
          
          // 等待所有请求完成
          console.log('[Outfit-ProStudio] Sending 6 requests (3 simple + 3 extended)...')
          const allResults = await Promise.allSettled([...simplePromises, ...extendedPromises])
          console.log('[Outfit-ProStudio] All requests completed')
          
          // 检查是否全部失败，退还额度
          const allFailed = allResults.every(r => r.status === 'rejected')
          if (allFailed) {
            console.log('[Outfit] All pro-studio tasks failed, refunding quota')
            try {
              await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
              refreshQuota()
            } catch (e) {
              console.warn('[Outfit] Failed to refund quota:', e)
            }
          }
        }
      } catch (error) {
        console.error('Generation failed:', error)
        // 发生异常，退还额度
        console.log('[Outfit] Generation error, refunding quota')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
          refreshQuota()
        } catch (e) {
          console.warn('[Outfit] Failed to refund quota:', e)
        }
      }
    }
    
    // 启动后台生成
    generateInBackground()
  }
  
  // 获取选中的模特和背景
  const selectedModel = selectedModelId 
    ? [...presetStore.visibleModels, ...userModels].find(m => m.id === selectedModelId)
    : null
  const selectedBg = selectedBgId
    ? [...presetStore.visibleBackgrounds, ...userBackgrounds].find(b => b.id === selectedBgId)
    : null
  
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-white font-medium text-sm">{t.outfit?.title || '搭配商品'}</span>
          <div className="w-9" />
        </div>
      </div>
      
      {/* 全屏搭配区域 - 拖动时锁定 */}
      <div 
        className="flex-1 relative bg-[#e8eef3] overflow-hidden"
        style={{ 
          // 拖动时禁止触摸滚动
          touchAction: touchDragSlotId ? 'none' : 'auto',
        }}
      >
        {/* 人体轮廓 SVG - 居中，作为背景参考 - 拖动时固定 */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ 
            // 确保SVG在拖动时不会移动
            transform: 'translateZ(0)',
            willChange: touchDragSlotId ? 'auto' : 'transform',
          }}
        >
          <svg
            viewBox="0 0 200 380"
            className="w-28 h-auto opacity-15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse cx="100" cy="30" rx="18" ry="22" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <line x1="100" y1="52" x2="100" y2="65" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M 60 70 Q 100 62 140 70" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <path d="M 75 70 L 75 160 M 125 70 L 125 160" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M 75 160 Q 100 168 125 160" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <path d="M 60 70 Q 42 100 38 145" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <path d="M 140 70 Q 158 100 162 145" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <path d="M 82 160 L 78 260 Q 74 320 70 340" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
            <path d="M 118 160 L 122 260 Q 126 320 130 340" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        
        {/* 商品槽位 - 人形对称布局，靠上放置 */}
        <div 
          className="absolute inset-x-0 top-4 bottom-0 flex flex-col items-center pt-2 px-4"
          style={{
            // 固定布局，防止拖动时整体移动
            transform: 'translateZ(0)',
          }}
        >
          {/* 第一行：帽子 */}
          <div className="mb-3">
            {renderSlotCard(slots.find(s => s.id === '帽子')!, 'small')}
          </div>
          
          {/* 第二行：内衬 + 上衣 */}
          <div className="flex gap-3 mb-3">
            {renderSlotCard(slots.find(s => s.id === '内衬')!, 'medium')}
            {renderSlotCard(slots.find(s => s.id === '上衣')!, 'large')}
          </div>
          
          {/* 第三行：裤子 + 鞋子 */}
          <div className="flex gap-3">
            {renderSlotCard(slots.find(s => s.id === '裤子')!, 'medium')}
            {renderSlotCard(slots.find(s => s.id === '鞋子')!, 'small')}
          </div>
          
          {/* 提示文字 */}
          <p className="text-zinc-500 text-xs mt-4 text-center">
            {t.outfit?.dragHint || '💡 长按拖动可移动服饰位置'}
          </p>
        </div>
      </div>
      
      {/* 空白框点击选项面板 */}
      <AnimatePresence>
        {showSlotOptions && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowSlotOptions(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-50 p-4 pb-safe"
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              </div>
              <h3 className="text-center font-semibold mb-4 text-zinc-900 dark:text-white">
                {t.outfit?.add || '添加'} {uploadTargetSlot ? labelMap[uploadTargetSlot] : ''}
              </h3>
              <div className="grid grid-cols-3 gap-3 px-4">
                <button
                  onClick={handleCaptureOption}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Camera className="w-7 h-7 text-blue-500" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.outfit?.capture || '拍摄'}</span>
                </button>
                <button
                  onClick={handleAssetOption}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <ImageIcon className="w-7 h-7 text-green-500" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.outfit?.album || '相册'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowSlotOptions(false)
                    setShowAssetPicker(true)
                  }}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <FolderHeart className="w-7 h-7 text-purple-500" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.outfit?.assetLibrary || '资产库'}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* 资产库选择面板 */}
      <AnimatePresence>
        {showAssetPicker && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowAssetPicker(false)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* 标题栏 */}
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {t.outfit?.selectProduct || '选择商品'} - {uploadTargetSlot ? labelMap[uploadTargetSlot] : ''}
                </span>
                <button 
                  onClick={() => setShowAssetPicker(false)} 
                  className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* 来源切换：我的资产 | 官方预设 */}
              <div className="px-4 py-2 border-b shrink-0">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setAssetPickerSource("user")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      assetPickerSource === "user"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {t.common?.my || '我的'}{t.nav?.assets || '资产'}
                    <span className="ml-1 text-xs opacity-60">({userProducts.length})</span>
                  </button>
                  <button
                    onClick={() => setAssetPickerSource("preset")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      assetPickerSource === "preset"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {t.common?.official || '官方'}{t.common?.preset || '预设'}
                    <span className="ml-1 text-xs opacity-60">({PRESET_PRODUCTS.length})</span>
                  </button>
                </div>
                
                {/* 二级分类（仅我的资产） */}
                {assetPickerSource === "user" && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {PRODUCT_SUB_TABS.map(cat => {
                      const count = cat === "all" 
                        ? userProducts.length 
                        : userProducts.filter(p => p.category === cat).length
                      return (
                        <button
                          key={cat}
                          onClick={() => setAssetPickerSubTab(cat)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                            assetPickerSubTab === cat
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                          }`}
                        >
                          {getProductCategoryLabel(cat, t)}
                          <span className="ml-1 opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              
              {/* 商品列表 */}
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  // 根据来源和分类筛选商品
                  let displayProducts: Asset[] = []
                  if (assetPickerSource === "preset") {
                    displayProducts = PRESET_PRODUCTS
                  } else {
                    displayProducts = assetPickerSubTab === "all" 
                      ? userProducts 
                      : userProducts.filter(p => p.category === assetPickerSubTab)
                  }
                  
                  if (displayProducts.length > 0) {
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        {displayProducts.map(product => (
                          <div
                            key={product.id}
                            className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 active:border-blue-600 transition-all group cursor-pointer"
                            style={{ touchAction: 'manipulation' }}
                            onClick={() => {
                              if (uploadTargetSlot) {
                                setSlots(prev => prev.map(slot => 
                                  slot.id === uploadTargetSlot
                                    ? { ...slot, product: { imageUrl: product.imageUrl } }
                                    : slot
                                ))
                              }
                              setShowAssetPicker(false)
                              setUploadTargetSlot(null)
                            }}
                          >
                            <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover pointer-events-none" />
                            {/* 商品名称悬浮显示 */}
                            {product.name && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <p className="text-white text-xs truncate">{product.name}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  } else {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">{t.outfit?.noProducts || '暂无商品'}</p>
                        <p className="text-xs mt-1">{t.outfit?.uploadProductFirst || '请先在资源库上传商品'}</p>
                      </div>
                    )
                  }
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* 选择状态显示 */}
      <div className="flex justify-center gap-2 py-3 flex-wrap">
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
          selectedModelId ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'
        }`}>
          {selectedModelId ? (t.outfit?.modelSelected || '模特: 已选择') : (t.outfit?.modelRandom || '模特: 随机')}
        </span>
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
          selectedBgId ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'
        }`}>
          {selectedBgId ? (t.outfit?.bgSelected || '背景: 已选择') : (t.outfit?.bgAI || '背景: AI生成')}
        </span>
      </div>
      
      {/* 底部按钮区域 */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg p-3 pb-safe border-t border-zinc-800">
        {/* 自定义模特/背景按钮 */}
        <div className="flex justify-center mb-3">
          <button 
            onClick={() => setShowCustomPanel(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm font-medium">{t.outfit?.customModelBg || '自定义模特/背景'}</span>
          </button>
        </div>
        
        {/* Shoot It 按钮 */}
        <motion.button
          onClick={handleShootIt}
          className="w-full h-12 rounded-full text-base font-semibold bg-white text-zinc-900 shadow-lg flex items-center justify-center gap-2 transition-colors hover:bg-zinc-100"
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
                <span className="font-semibold text-lg">{t.outfit?.customConfig || '自定义配置'}</span>
                <button 
                  onClick={() => setShowCustomPanel(false)} 
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                >
                  {t.outfit?.done || '完成'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                {[
                  { id: "model", label: t.outfit?.proModel || "专业模特" },
                  { id: "bg", label: t.outfit?.studioBg || "棚拍背景" }
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
                      <span className="text-sm text-zinc-600">{t.outfit?.selectModel || '选择模特（不选则随机）'}</span>
                      {selectedModelId && (
                        <button 
                          onClick={() => setSelectedModelId(null)}
                          className="text-xs text-blue-600"
                        >
                          {t.outfit?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={[...customModels, ...studioModels, ...userModels]} 
                      selectedId={selectedModelId} 
                      onSelect={(id) => setSelectedModelId(selectedModelId === id ? null : id)}
                      onUpload={() => modelUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadLabel={t.outfit?.upload || "上传"}
                    />
                  </div>
                )}
                {activeCustomTab === "bg" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">{t.outfit?.selectBg || '选择背景（不选则随机）'}</span>
                      {selectedBgId && (
                        <button 
                          onClick={() => setSelectedBgId(null)}
                          className="text-xs text-blue-600"
                        >
                          {t.outfit?.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <BackgroundGrid 
                      selectedId={selectedBgId} 
                      onSelect={(id) => setSelectedBgId(selectedBgId === id ? null : id)}
                      onUpload={() => bgUploadRef.current?.click()}
                      onZoom={(url) => setFullscreenImage(url)}
                      uploadLabel={t.outfit?.upload || "上传"}
                      labels={{ 
                        all: t.outfit?.all || "全部", 
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
      {/* 拍摄上传 */}
      <input 
        type="file" 
        ref={cameraInputRef} 
        className="hidden" 
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
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

// Default export with Suspense wrapper for useSearchParams
export default function ProStudioOutfitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <OutfitPageContent />
    </Suspense>
  )
}
