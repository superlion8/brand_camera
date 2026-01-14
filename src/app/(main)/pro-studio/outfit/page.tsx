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
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { useLanguageStore } from "@/stores/languageStore"
import { ProductCategory } from "@/types/outfit"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { useGenerationTaskStore, base64ToBlobUrl } from "@/stores/generationTaskStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { Asset } from "@/types"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { AssetGrid } from "@/components/shared/AssetGrid"

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
const getInitialSlots = (t: any): OutfitSlot[] => [
  { id: "帽子", label: t?.outfit?.hat || "Hat", icon: <HardHat className="w-5 h-5" /> },
  { id: "上衣", label: t?.outfit?.top || "Top", icon: <Shirt className="w-5 h-5" /> },
  { id: "内衬", label: t?.outfit?.inner || "Inner", icon: <Shirt className="w-5 h-5 opacity-60" /> },
  { id: "裤子", label: t?.outfit?.pants || "Pants", icon: <Shirt className="w-5 h-5 rotate-180" /> },
  { id: "鞋子", label: t?.outfit?.shoes || "Shoes", icon: <Footprints className="w-5 h-5" /> },
]

// Background Grid with categories and Upload Button
function BackgroundGrid({
  selectedId,
  onSelect,
  onUpload,
  onZoom,
  uploadLabel = "Upload",
  backgrounds = [],
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload?: () => void
  onZoom?: (url: string) => void
  uploadLabel?: string
  backgrounds?: Asset[]
}) {
  return (
    <div className="space-y-3">
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
        {backgrounds.map(item => (
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
              <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" unoptimized />
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
  const { checkQuota } = useQuota()
  const { reserveQuota, refundQuota } = useQuotaReservation()
  const { addTask, initImageSlots, updateImageSlot } = useGenerationTaskStore()
  const { userModels, userBackgrounds, userProducts, addUserAsset } = useAssetStore()
  const presetStore = usePresetStore()
  
  // 从 URL 参数获取模式：camera (买家秀) 或 pro_studio (模特棚拍)
  const shootMode = searchParams.get('mode') === 'camera' ? 'camera' : 'pro_studio'
  const isCameraMode = shootMode === 'camera'
  
  const MAX_OUTFIT_ITEMS = 4 // Maximum products for quality
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots(null))
  
  // Count filled slots
  const filledSlotsCount = slots.filter(s => s.product).length
  
  // Update slots labels when language changes
  useEffect(() => {
    setSlots(prev => prev.map(slot => ({
      ...slot,
      label: slot.id === "帽子" ? (t?.outfit?.hat || "Hat") :
             slot.id === "上衣" ? (t?.outfit?.top || "Top") :
             slot.id === "内衬" ? (t?.outfit?.inner || "Inner") :
             slot.id === "裤子" ? (t?.outfit?.pants || "Pants") :
             slot.id === "鞋子" ? (t?.outfit?.shoes || "Shoes") : slot.label
    })))
  }, [t])
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
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null) // 长按计时器
  
  // 模特和背景选择
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'bg'>('model')
  
  // 自定义上传的资产
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customBgs, setCustomBgs] = useState<Asset[]>([])
  
  // Desktop detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // 数据库 UUID，用于收藏功能
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  
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
  // 直接从 presetStore 获取背景
  const studioBackgrounds = presetStore.studioBackgrounds || []
  
  // 处理模特上传
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-model-${Date.now()}`,
        type: 'model',
        name: t.outfit?.customModel || 'Custom Model',
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
        name: t.outfit?.customBg || 'Custom Background',
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
    
    // Check limit before adding
    const targetSlot = slots.find(s => s.id === uploadTargetSlot)
    const isReplacement = !!targetSlot?.product
    if (!isReplacement && filledSlotsCount >= MAX_OUTFIT_ITEMS) {
      console.log('[Outfit] Max items reached, cannot add more')
      setUploadTargetSlot(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    
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
    // Check if can add more (slot is empty and we're at limit)
    const targetSlot = slots.find(s => s.id === slotId)
    if (!targetSlot?.product && filledSlotsCount >= MAX_OUTFIT_ITEMS) {
      console.log('[Outfit] Max items reached, cannot open add panel')
      return
    }
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
    
    // Check limit before adding
    const targetSlot = slots.find(s => s.id === uploadTargetSlot)
    const isReplacement = !!targetSlot?.product
    if (!isReplacement && filledSlotsCount >= MAX_OUTFIT_ITEMS) {
      console.log('[Outfit] Max items reached, cannot add more')
      setUploadTargetSlot(null)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      return
    }
    
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
    
    // 触摸拖拽事件 - 支持Safari
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!slot.product) return
      
      // 长按300ms后开始拖拽
      longPressTimerRef.current = setTimeout(() => {
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
      if (!touchDragSlotIdRef.current && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
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
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
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
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
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
    
    const numImages = 4  // 4张图 (2简单 + 2扩展)
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return
    
    triggerFlyToGallery()
    
    // 根据模式创建任务
    const taskType = isCameraMode ? 'camera' : 'pro_studio'
    const taskId = addTask(taskType, products[0], {}, numImages)
    initImageSlots(taskId, numImages)
    
    // 获取选中的模特和背景信息（只获取ID和URL，不加载图片）
    const allModels = [...customModels, ...studioModels, ...userModels]
    const allBgs = [...customBgs, ...studioBackgrounds, ...userBackgrounds]
    
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
    
    // 预扣配额（使用统一 hook）
    const reserveResult = await reserveQuota({
          taskId,
          imageCount: numImages,
          taskType,
    })
    
    if (!reserveResult.success) {
      console.error('[Outfit] Failed to reserve quota:', reserveResult.error)
      router.replace('/pro-studio/outfit')
      return
    }
    
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
          // 买家秀模式：使用 /api/generate-single，传递 outfitItems
          // 直接发送 URL，后端会处理转换
          
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
                  // 传递 outfitItems 而不是 productImage/productImage2
                  outfitItems,
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
              
              // 先获取响应文本，处理非 JSON 响应
              const responseText = await response.text()
              let result: any
              
              try {
                result = JSON.parse(responseText)
              } catch (parseError) {
                console.error(`[Outfit-Camera] Image ${index + 1}: Non-JSON response:`, responseText.substring(0, 100))
                let errorMsg = '服务器返回格式错误'
                if (response.status === 413) {
                  errorMsg = '图片太大，请使用较小的图片'
                } else if (response.status >= 500) {
                  errorMsg = '服务器繁忙，请稍后重试'
                }
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: errorMsg 
                })
                return
              }
              
              if (!response.ok) {
                console.log(`[Outfit-Camera] Image ${index + 1}: ✗ HTTP ${response.status}`)
                updateImageSlot(taskId, index, { 
                  status: 'failed', 
                  error: result.error || `HTTP ${response.status}` 
                })
                return
              }
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
          
          // 简单模式：2张图（index 0, 1）
          const simplePromises = [0, 1].map(i => createCameraRequest(i, true))
          
          // 扩展模式：2张图（index 2, 3）
          const extendedPromises = [2, 3].map(i => createCameraRequest(i, false))
          
          // 等待所有请求完成
          console.log('[Outfit-Camera] Sending 4 requests (2 simple + 2 extended)...')
          const allResults = await Promise.allSettled([...simplePromises, ...extendedPromises])
          console.log('[Outfit-Camera] All requests completed')
          
          // 检查是否全部失败，退还额度
          const allFailed = allResults.every(r => r.status === 'rejected')
          if (allFailed) {
            // 全部失败，全额退款（使用统一 hook）
            await refundQuota(taskId)
          }
        } else {
          // 模特棚拍模式：使用 /api/generate-pro-studio，返回 SSE 流
          // API 一次性生成 4 张图片（4 种机位），通过 SSE 流返回
          console.log('[Outfit-ProStudio] Starting SSE request for 4 images...')
          
          try {
            const response = await fetch('/api/generate-pro-studio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                outfitItems, // 新格式：独立的服装项 { inner?, top?, pants?, hat?, shoes? }
                productImages: products, // 向后兼容
                modelImage: modelImageUrl,  // 发送 URL，后端转换 base64
                backgroundImage: bgImageUrl,  // 发送 URL，后端转换 base64
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
              const errorText = await response.text()
              console.log(`[Outfit-ProStudio] HTTP ${response.status}: ${errorText}`)
              // 标记所有图片为失败
              for (let i = 0; i < numImages; i++) {
                updateImageSlot(taskId, i, { 
                  status: 'failed', 
                  error: `HTTP ${response.status}` 
                })
              }
              // 退还额度（使用统一 hook）
              await refundQuota(taskId)
              return
            }
            
            // 处理 SSE 流
            const reader = response.body?.getReader()
            if (!reader) {
              throw new Error('无法读取响应流')
            }
            
            const decoder = new TextDecoder()
            let buffer = ''
            let successCount = 0
            let firstDbId: string | null = null
            
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6))
                    
                    switch (data.type) {
                      case 'progress':
                        console.log('[Outfit-ProStudio] Progress:', data.message)
                        break
                        
                      case 'analysis_complete':
                        console.log('[Outfit-ProStudio] Analysis:', data.productStyle, data.modelId, data.sceneId)
                        break
                        
                      case 'outfit_ready':
                        console.log('[Outfit-ProStudio] Outfit ready')
                        break
                        
                      case 'image':
                        // 图片生成完成
                        const imageUrl = data.image.startsWith('data:') 
                          ? base64ToBlobUrl(data.image) 
                          : data.image
                        console.log(`[Outfit-ProStudio] Image ${data.index + 1}: ✓ (dbId: ${data.dbId})`)
                        updateImageSlot(taskId, data.index, {
                          status: 'completed',
                          imageUrl: imageUrl,
                          modelType: 'pro',
                          genMode: 'simple',
                          dbId: data.dbId,
                        })
                        successCount++
                        
                        // 捕获第一个有效的 dbId，设置 currentGenerationId 用于收藏功能
                        if (data.dbId && !firstDbId) {
                          firstDbId = data.dbId
                          setCurrentGenerationId(data.dbId)
                          console.log(`[Outfit-ProStudio] Set currentGenerationId to: ${data.dbId}`)
                        }
                        break
                        
                      case 'image_error':
                        console.log(`[Outfit-ProStudio] Image ${data.index + 1}: ✗ (${data.error})`)
                        updateImageSlot(taskId, data.index, {
                          status: 'failed',
                          error: data.error || '生成失败',
                        })
                        break
                        
                      case 'error':
                        console.error('[Outfit-ProStudio] Error:', data.error)
                        // 标记所有未完成的图片为失败
                        for (let i = 0; i < numImages; i++) {
                          const task = useGenerationTaskStore.getState().tasks.find(t => t.id === taskId)
                          const slot = task?.imageSlots?.[i]
                          if (slot?.status !== 'completed') {
                            updateImageSlot(taskId, i, { 
                              status: 'failed', 
                              error: data.error || '生成失败' 
                            })
                          }
                        }
                        break
                        
                      case 'complete':
                        console.log(`[Outfit-ProStudio] Complete: ${data.totalSuccess}/${numImages} images`)
                        break
                    }
                  } catch (e) {
                    console.warn('[Outfit-ProStudio] Failed to parse SSE data:', line)
                  }
                }
              }
            }
            
            // 检查是否全部失败，退还额度（使用统一 hook）
            if (successCount === 0) {
              await refundQuota(taskId)
            } else if (!firstDbId) {
              // 有成功的图片但没有收到 dbId（后端保存都失败），使用 taskId 作为 fallback
              setCurrentGenerationId(taskId)
              console.log(`[Outfit-ProStudio] No dbId received, using taskId as fallback: ${taskId}`)
            }
            
          } catch (e: any) {
            console.error('[Outfit-ProStudio] Request failed:', e.message)
            // 标记所有图片为失败
            for (let i = 0; i < numImages; i++) {
              updateImageSlot(taskId, i, { 
                status: 'failed', 
                error: e.message || '网络错误' 
              })
            }
            // 退还额度（使用统一 hook）
            await refundQuota(taskId)
          }
        }
      } catch (error) {
        console.error('Generation failed:', error)
        // 发生异常，退还额度（使用统一 hook）
        await refundQuota(taskId)
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
  
  // All models and backgrounds for selection
  const allModels = [...customModels, ...studioModels, ...userModels]
  const allBgs = [...customBgs, ...studioBackgrounds, ...userBackgrounds]
  
  // Add product to a slot (with limit check)
  const handleAddProduct = (imageUrl: string, slotId: ProductCategory) => {
    // Check if slot is already filled (replacement) or if we're under the limit
    const targetSlot = slots.find(s => s.id === slotId)
    const isReplacement = !!targetSlot?.product
    if (!isReplacement && filledSlotsCount >= MAX_OUTFIT_ITEMS) {
      console.log('[Outfit] Max items reached, cannot add more')
      return false
    }
    setSlots(prev => prev.map(slot => 
      slot.id === slotId
        ? { ...slot, product: { imageUrl } }
        : slot
    ))
    return true
  }
  
  // Remove product from a slot
  const handleRemoveProduct = (slotId: ProductCategory) => {
    setSlots(prev => prev.map(slot => 
      slot.id === slotId
        ? { ...slot, product: undefined }
        : slot
    ))
  }

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="h-full bg-zinc-50 flex flex-col overflow-hidden">
        {/* PC Header */}
        <div className="bg-white border-b border-zinc-200 shrink-0">
          <div className="max-w-6xl mx-auto px-8 py-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.back()}
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <h1 className="text-lg font-semibold text-zinc-900">{t.outfit?.title || '搭配商品'}</h1>
            </div>
          </div>
        </div>
        
        {/* Main Content - Two Column Layout */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-6">
            <div className="flex gap-8">
              {/* Left: Outfit Slots */}
              <div className="w-[420px] shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <h3 className="font-semibold text-zinc-900 mb-4">{t?.outfit?.outfitStyling || 'Outfit Styling'}</h3>
                  <p className="text-sm text-zinc-500 mb-6">{t?.outfit?.clickToAddProduct || 'Click empty slots to add products for outfit combination'}</p>
                  
                  {/* Outfit Slots Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Hat - top center */}
                    {renderDesktopSlot(slots.find(s => s.id === '帽子')!, 'HAT')}
                    <div /> {/* Empty spacer */}
                    <div /> {/* Empty spacer */}
                    
                    {/* Inner - left */}
                    {renderDesktopSlot(slots.find(s => s.id === '内衬')!, 'INNER')}
                    {/* Top - center */}
                    {renderDesktopSlot(slots.find(s => s.id === '上衣')!, 'TOP')}
                    {/* Empty or Accessory */}
                    <div />
                    
                    {/* Bottom - center */}
                    <div /> {/* Empty spacer */}
                    {renderDesktopSlot(slots.find(s => s.id === '裤子')!, 'BOTTOM')}
                    {/* Shoes - right */}
                    {renderDesktopSlot(slots.find(s => s.id === '鞋子')!, 'SHOES')}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">
                        {t?.outfit?.itemsCount || 'Items'}: {filledSlotsCount}/{MAX_OUTFIT_ITEMS}
                      </span>
                      {filledSlotsCount >= MAX_OUTFIT_ITEMS && (
                        <span className="text-xs text-amber-600 font-medium">{t?.outfit?.maxReached || 'Max reached'}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 text-center">
                      {t.proStudio?.maxItemsWarning || 'Max 4 products. Too many may affect quality.'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Right: Model & Background Selection */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* Model Selection */}
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-zinc-900">{t.outfit?.selectModel || '选择模特'}</h3>
                    {selectedModel && (
                      <button 
                        onClick={() => setSelectedModelId(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        清除选择
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mb-4">{t?.proStudio?.randomMatch || 'Random if not selected'}</p>
                  <div className="grid grid-cols-5 gap-3">
                    {/* Upload button */}
                    <div
                      onClick={() => modelUploadRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/')) {
                          const base64 = await fileToBase64(file)
                          const newModel: Asset = {
                            id: `custom-model-${Date.now()}`,
                            type: 'model',
                            name: t.outfit?.customModel || 'Custom Model',
                            imageUrl: base64,
                          }
                          setCustomModels(prev => [newModel, ...prev])
                          setSelectedModelId(newModel.id)
                          addUserAsset(newModel)
                        }
                      }}
                      className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-amber-400 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400">{t?.proStudio?.upload || 'Upload'}</span>
                    </div>
                    {/* Model list */}
                    {allModels.slice(0, 9).map(model => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModelId(selectedModelId === model.id ? null : model.id)}
                        className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                          selectedModelId === model.id 
                            ? 'border-amber-500 ring-2 ring-amber-500/30' 
                            : 'border-transparent hover:border-amber-300'
                        }`}
                      >
                        <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                        {selectedModelId === model.id && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Background Selection */}
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-zinc-900">{t.outfit?.selectBg || '选择背景'}</h3>
                    {selectedBg && (
                      <button 
                        onClick={() => setSelectedBgId(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        清除选择
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mb-4">{t?.proStudio?.randomMatch || 'Random if not selected'}</p>
                  <div className="grid grid-cols-5 gap-3">
                    {/* Upload button */}
                    <div
                      onClick={() => bgUploadRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/')) {
                          const base64 = await fileToBase64(file)
                          const newBg: Asset = {
                            id: `custom-bg-${Date.now()}`,
                            type: 'background',
                            name: t.outfit?.customBg || 'Custom Background',
                            imageUrl: base64,
                          }
                          setCustomBgs(prev => [newBg, ...prev])
                          setSelectedBgId(newBg.id)
                          addUserAsset(newBg)
                        }
                      }}
                      className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-amber-400 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400">{t?.proStudio?.upload || 'Upload'}</span>
                    </div>
                    {/* Background list */}
                    {allBgs.slice(0, 9).map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => setSelectedBgId(selectedBgId === bg.id ? null : bg.id)}
                        className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                          selectedBgId === bg.id 
                            ? 'border-amber-500 ring-2 ring-amber-500/30' 
                            : 'border-transparent hover:border-amber-300'
                        }`}
                      >
                        <Image src={bg.imageUrl} alt={bg.name || ''} fill className="object-cover" />
                        {selectedBgId === bg.id && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Generate Button */}
                <button
                  onClick={handleShootIt}
                  className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-200/50"
                >
                  <Wand2 className="w-5 h-5" />
                  开始生成
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* File inputs */}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleCameraCapture} />
        <input type="file" ref={modelUploadRef} className="hidden" accept="image/*" onChange={handleModelUpload} />
        <input type="file" ref={bgUploadRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
        
        {/* Asset Picker Panel */}
        <AssetPickerPanel
          open={showAssetPicker}
          onClose={() => setShowAssetPicker(false)}
          onSelect={(imageUrl) => {
                          if (uploadTargetSlot) {
              handleAddProduct(imageUrl, uploadTargetSlot)
            }
          }}
          onUploadClick={() => fileInputRef.current?.click()}
          themeColor="amber"
          title={t?.proStudio?.selectProduct || 'Select Product'}
        />
        
        {/* Fullscreen Image Preview - Using shared component */}
        <FullscreenImageViewer
          open={!!fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          imageUrl={fullscreenImage || ''}
        />
        
      </div>
    )
  }
  
  // Helper function for desktop slot rendering
  function renderDesktopSlot(slot: OutfitSlot | undefined, label: string) {
    if (!slot) return <div />
    return (
      <button
        onClick={() => {
          setUploadTargetSlot(slot.id)
          setShowAssetPicker(true)
        }}
        className={`aspect-square rounded-xl overflow-hidden relative transition-all ${
          slot.product 
            ? 'border-2 border-amber-500 bg-white shadow-sm' 
            : 'border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-white'
        }`}
      >
        {slot.product ? (
          <>
            <Image src={slot.product.imageUrl} alt={slot.label} fill className="object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveProduct(slot.id)
              }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <Plus className="w-5 h-5 text-zinc-400" />
            <span className="text-[10px] text-zinc-400 font-medium">{label}</span>
          </div>
        )}
      </button>
    )
  }

  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  // Mobile Layout (original)
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
      
      {/* 资产库选择面板 - Mobile 版使用统一组件 */}
      <AssetPickerPanel
        open={showAssetPicker}
        onClose={() => {
                              setShowAssetPicker(false)
                              setUploadTargetSlot(null)
                            }}
        onSelect={(imageUrl) => {
          if (uploadTargetSlot) {
            handleAddProduct(imageUrl, uploadTargetSlot)
          }
          setUploadTargetSlot(null)
        }}
        onUploadClick={() => fileInputRef.current?.click()}
        themeColor="amber"
        title={`${t.outfit?.selectProduct || '选择商品'}${uploadTargetSlot ? ` - ${labelMap[uploadTargetSlot]}` : ''}`}
      />
      
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
                      uploadIcon="plus"
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
                      backgrounds={studioBackgrounds}
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
