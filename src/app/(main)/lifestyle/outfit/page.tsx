"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, ArrowRight, Plus, X, Upload, Camera, 
  Shirt, HardHat, Footprints, Loader2, Wand2, SlidersHorizontal,
  Check, ZoomIn, FolderHeart, ImageIcon, Home
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { fileToBase64, generateId } from "@/lib/utils"
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
import { BottomNav } from "@/components/shared/BottomNav"

// Product slot type
const VALID_CATEGORIES: ProductCategory[] = ["内衬", "上衣", "裤子", "帽子", "鞋子"]

// Slot definition
interface OutfitSlot {
  id: ProductCategory
  label: string
  icon: React.ReactNode
  product?: {
    imageUrl: string
  }
}

// Initial slots
const getInitialSlots = (): OutfitSlot[] => [
  { id: "帽子", label: "帽子", icon: <HardHat className="w-5 h-5" /> },
  { id: "上衣", label: "上衣", icon: <Shirt className="w-5 h-5" /> },
  { id: "内衬", label: "内衬", icon: <Shirt className="w-5 h-5 opacity-60" /> },
  { id: "裤子", label: "裤子", icon: <Shirt className="w-5 h-5 rotate-180" /> },
  { id: "鞋子", label: "鞋子", icon: <Footprints className="w-5 h-5" /> },
]

const labelMap: Record<ProductCategory, string> = {
  '帽子': 'HAT',
  '上衣': 'TOP',
  '内衬': 'INNER',
  '裤子': 'BOTTOM',
  '鞋子': 'SHOES',
  '配饰': 'ACCESSORY'
}

function LifestyleOutfitContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, refreshQuota, quota } = useQuota()
  const { addTask, initImageSlots, updateImageSlot, updateTaskStatus, tasks } = useGenerationTaskStore()
  const { userModels, userProducts, addUserAsset, addGeneration } = useAssetStore()
  const presetStore = usePresetStore()
  
  const [slots, setSlots] = useState<OutfitSlot[]>(() => getInitialSlots())
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const modelUploadRef = useRef<HTMLInputElement>(null)
  const sceneUploadRef = useRef<HTMLInputElement>(null)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ProductCategory | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [showSlotOptions, setShowSlotOptions] = useState(false)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [assetPickerSource, setAssetPickerSource] = useState<"user" | "preset">("preset")
  
  // Model and scene selection
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState<'model' | 'scene'>('model')
  const [customModels, setCustomModels] = useState<Asset[]>([])
  const [customScenes, setCustomScenes] = useState<Asset[]>([])
  
  // Results
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [mode, setMode] = useState<'edit' | 'processing' | 'results'>('edit')
  
  // Load presets
  useEffect(() => {
    presetStore.loadPresets()
  }, [presetStore])
  
  // Combined assets
  const allModels = [...customModels, ...(presetStore.lifestyleModels || [])]
  const allScenes = [...customScenes, ...(presetStore.lifestyleScenes || [])]
  
  // Load product from sessionStorage
  useEffect(() => {
    const product1Image = sessionStorage.getItem('lifestyleProduct1Image')
    if (product1Image) {
      setSlots(prev => prev.map(slot => 
        slot.id === '上衣'
          ? { ...slot, product: { imageUrl: product1Image } }
          : slot
      ))
      sessionStorage.removeItem('lifestyleProduct1Image')
    }
  }, [])
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    try {
      const base64 = await fileToBase64(file)
      setSlots(prev => prev.map(slot => 
        slot.id === uploadTargetSlot
          ? { ...slot, product: { imageUrl: base64 } }
          : slot
      ))
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploadTargetSlot(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  
  // Handle camera capture
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetSlot) return
    
    try {
      const base64 = await fileToBase64(file)
      setSlots(prev => prev.map(slot => 
        slot.id === uploadTargetSlot
          ? { ...slot, product: { imageUrl: base64 } }
          : slot
      ))
    } catch (error) {
      console.error('Capture failed:', error)
    } finally {
      setUploadTargetSlot(null)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }
  
  // Handle model upload
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newModel: Asset = {
        id: `custom-lifestyle-model-${Date.now()}`,
        type: 'model',
        name: t.lifestyle?.streetModel || '街拍模特',
        imageUrl: base64,
      }
      setCustomModels(prev => [newModel, ...prev])
      setSelectedModelId(newModel.id)
    }
    e.target.value = ''
  }
  
  // Handle scene upload
  const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newScene: Asset = {
        id: `custom-lifestyle-scene-${Date.now()}`,
        type: 'background',
        name: t.lifestyle?.streetScene || '街拍场景',
        imageUrl: base64,
      }
      setCustomScenes(prev => [newScene, ...prev])
      setSelectedSceneId(newScene.id)
    }
    e.target.value = ''
  }
  
  // Click empty slot
  const handleSlotClick = (slotId: ProductCategory) => {
    setUploadTargetSlot(slotId)
    setShowSlotOptions(true)
  }
  
  // Clear slot
  const handleClearSlot = (slotId: ProductCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, product: undefined } : slot
    ))
  }
  
  // Generate
  const handleShootIt = async () => {
    // Collect outfit items
    const outfitItems: {
      inner?: string
      top?: string
      pants?: string
      hat?: string
      shoes?: string
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
    
    const products = slots.filter(slot => slot.product).map(slot => slot.product!.imageUrl)
    
    if (products.length === 0) {
      alert(t.outfit?.atLeastOneProduct || '请至少添加一个商品')
      return
    }
    
    const numImages = 4
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return
    
    triggerFlyToGallery()
    
    const taskId = addTask('lifestyle', products[0], {}, numImages)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, numImages)
    
    setMode('processing')
    setIsGenerating(true)
    
    // Reserve quota
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: numImages,
          taskType: 'lifestyle',
        }),
      })
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve:', e)
    }
    
    // Get selected model/scene URLs
    const selectedModel = selectedModelId ? allModels.find(m => m.id === selectedModelId) : null
    const selectedScene = selectedSceneId ? allScenes.find(s => s.id === selectedSceneId) : null
    
    // Start generation in background
    runLifestyleGeneration(taskId, outfitItems, selectedModel?.imageUrl, selectedScene?.imageUrl)
  }
  
  const runLifestyleGeneration = async (
    taskId: string,
    outfitItems: Record<string, string>,
    userModelUrl?: string | null,
    userSceneUrl?: string | null
  ) => {
    let firstDbId: string | null = null
    
    try {
      setGenerationStatus(t.common?.loading || '正在连接服务器...')
      
      const response = await fetch('/api/generate-lifestyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outfitItems,
          taskId,
          modelImage: userModelUrl || 'auto',
          sceneImage: userSceneUrl || 'auto',
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          
          try {
            const event = JSON.parse(jsonStr)
            
            switch (event.type) {
              case 'status':
                setGenerationStatus(event.message)
                break
              case 'analysis_complete':
                setGenerationStatus(t.lifestyle?.matchingModel || '分析完成，正在匹配...')
                break
              case 'materials_ready':
                setGenerationStatus(t.lifestyle?.generatingPhoto || '素材准备完成，开始生成...')
                break
              case 'progress':
                setGenerationStatus(`${t.common?.generating || '正在生成'} ${event.index + 1}/4...`)
                break
              case 'image':
                updateImageSlot(taskId, event.index, {
                  imageUrl: event.image,
                  status: 'completed',
                  modelType: event.modelType,
                  genMode: 'simple',
                  dbId: event.dbId,
                })
                
                if (event.dbId && !firstDbId) {
                  firstDbId = event.dbId
                }
                
                setGeneratedImages(prev => {
                  const newImages = [...prev]
                  newImages[event.index] = event.image
                  return newImages
                })
                break
              case 'image_error':
                updateImageSlot(taskId, event.index, {
                  status: 'failed',
                  error: event.error,
                })
                break
              case 'error':
                setGenerationStatus(`错误: ${event.error}`)
                updateTaskStatus(taskId, 'failed')
                break
              case 'complete':
                setGenerationStatus('')
                updateTaskStatus(taskId, 'completed')
                setMode('results')
                setIsGenerating(false)
                
                const completedTask = tasks.find(t => t.id === taskId)
                if (completedTask?.imageSlots) {
                  const completedSlots = completedTask.imageSlots.filter(s => s.status === 'completed' && s.imageUrl)
                  const outputUrls = completedSlots.map(s => s.imageUrl!)
                  
                  if (outputUrls.length > 0) {
                    const primaryProduct = Object.values(outfitItems)[0]
                    addGeneration({
                      id: firstDbId || taskId,
                      type: 'lifestyle',
                      inputImageUrl: primaryProduct,
                      outputImageUrls: outputUrls,
                      outputModelTypes: completedSlots.map(s => s.modelType || 'pro'),
                      outputGenModes: completedSlots.map(s => s.genMode || 'simple'),
                      createdAt: new Date().toISOString(),
                      params: { type: 'lifestyle', outfit: true },
                    })
                  }
                }
                refreshQuota()
                break
            }
          } catch (e) {
            console.warn('[LifestyleOutfit] Failed to parse event:', jsonStr)
          }
        }
      }
    } catch (error: any) {
      setGenerationStatus(`生成失败: ${error.message}`)
      updateTaskStatus(taskId, 'failed')
      setIsGenerating(false)
    }
  }
  
  const handleRetake = () => {
    setMode('edit')
    setGeneratedImages([])
    setCurrentTaskId(null)
    setSlots(getInitialSlots())
  }
  
  // Render slot card
  const renderSlotCard = (slot: OutfitSlot | undefined, size: "small" | "medium" | "large" = "medium") => {
    if (!slot) return null
    
    const sizeClasses = {
      small: "w-[100px] h-[100px]",
      medium: "w-[130px] h-[170px]",
      large: "w-[150px] h-[190px]"
    }
    
    return (
      <motion.div
        layout
        data-slot-id={slot.id}
        onClick={() => !slot.product && handleSlotClick(slot.id)}
        className={`
          ${sizeClasses[size]} rounded-xl relative cursor-pointer
          bg-white select-none shadow-md
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
              className="object-cover rounded-xl"
            />
            <button
              onClick={(e) => handleClearSlot(slot.id, e)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Plus className="w-5 h-5 text-zinc-400" />
            <span className="text-[10px] font-medium text-zinc-500">
              {labelMap[slot.id]}
            </span>
          </div>
        )}
      </motion.div>
    )
  }
  
  // Edit mode
  if (mode === 'edit') {
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
            <span className="text-white font-medium text-sm">{t.lifestyle?.outfitMode || '搭配商品'}</span>
            <div className="w-9" />
          </div>
        </div>
        
        {/* Outfit area */}
        <div className="flex-1 relative bg-[#e8eef3] overflow-hidden">
          {/* Body silhouette */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
          
          {/* Slots */}
          <div className="absolute inset-x-0 top-4 bottom-0 flex flex-col items-center pt-2 px-4">
            <div className="mb-3">
              {renderSlotCard(slots.find(s => s.id === '帽子')!, 'small')}
            </div>
            <div className="flex gap-3 mb-3">
              {renderSlotCard(slots.find(s => s.id === '内衬')!, 'medium')}
              {renderSlotCard(slots.find(s => s.id === '上衣')!, 'large')}
            </div>
            <div className="flex gap-3">
              {renderSlotCard(slots.find(s => s.id === '裤子')!, 'medium')}
              {renderSlotCard(slots.find(s => s.id === '鞋子')!, 'small')}
            </div>
            <p className="text-zinc-500 text-xs mt-4 text-center">
              {t.outfit?.dragHint || '💡 点击空白框添加商品'}
            </p>
          </div>
        </div>
        
        {/* Selection badges */}
        <div className="flex justify-center gap-2 py-3 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            selectedModelId ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {selectedModelId ? (t.outfit?.modelSelected || '模特: 已选择') : (t.outfit?.modelRandom || '模特: AI匹配')}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            selectedSceneId ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {selectedSceneId ? (t.outfit?.bgSelected || '场景: 已选择') : (t.outfit?.bgAI || '场景: AI匹配')}
          </span>
        </div>
        
        {/* Bottom buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg p-3 pb-safe border-t border-zinc-800">
          <div className="flex justify-center mb-3">
            <button 
              onClick={() => setShowCustomPanel(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm font-medium">{t.lifestyle?.customizeModelScene || '自定义模特/场景'}</span>
            </button>
          </div>
          
          <motion.button
            onClick={handleShootIt}
            className="w-full h-12 rounded-full text-base font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Wand2 className="w-5 h-5" />
            {t.lifestyle?.startGenerate || '开始生成'}
          </motion.button>
        </div>
        
        {/* Slot options panel */}
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
                    onClick={() => {
                      setShowSlotOptions(false)
                      cameraInputRef.current?.click()
                    }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Camera className="w-7 h-7 text-blue-500" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.outfit?.capture || '拍摄'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSlotOptions(false)
                      fileInputRef.current?.click()
                    }}
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
        
        {/* Asset picker panel */}
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
                <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {t.outfit?.selectProduct || '选择商品'} - {uploadTargetSlot ? labelMap[uploadTargetSlot] : ''}
                  </span>
                  <button onClick={() => setShowAssetPicker(false)} className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="px-4 py-2 border-b shrink-0">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
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
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {(() => {
                    const displayProducts = assetPickerSource === "preset" ? PRESET_PRODUCTS : userProducts
                    
                    if (displayProducts.length > 0) {
                      return (
                        <div className="grid grid-cols-3 gap-3">
                          {displayProducts.map(product => (
                            <div
                              key={product.id}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-purple-500 active:border-purple-600 transition-all group cursor-pointer"
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
                        </div>
                      )
                    }
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* Custom panel */}
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
                  <span className="font-semibold text-lg">{t.lifestyle?.customConfig || '自定义配置'}</span>
                  <button 
                    onClick={() => setShowCustomPanel(false)} 
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors"
                  >
                    {t.lifestyle?.nextStep || '完成'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                  {[
                    { id: "model", label: t.lifestyle?.streetModel || "街拍模特" },
                    { id: "scene", label: t.lifestyle?.streetScene || "街拍场景" }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveCustomTab(tab.id as 'model' | 'scene')}
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
                        <span className="text-sm text-zinc-600">{t.lifestyle?.selectModel || '选择模特（不选则AI匹配）'}</span>
                        {selectedModelId && (
                          <button onClick={() => setSelectedModelId(null)} className="text-xs text-purple-600">
                            {t.lifestyle?.clearSelection || '清除选择'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => modelUploadRef.current?.click()}
                          className="aspect-[3/4] rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-purple-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-purple-50"
                        >
                          <Plus className="w-10 h-10 text-zinc-400" />
                          <span className="text-sm text-zinc-500 mt-2">{t.common?.upload || '上传'}</span>
                        </button>
                        {allModels.map(item => (
                          <div
                            key={item.id}
                            className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all cursor-pointer ${
                              selectedModelId === item.id 
                                ? "border-purple-500 ring-2 ring-purple-500/30" 
                                : "border-transparent hover:border-purple-300"
                            }`}
                            onClick={() => setSelectedModelId(selectedModelId === item.id ? null : item.id)}
                          >
                            <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" />
                            {selectedModelId === item.id && (
                              <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
                              <p className="text-xs text-white truncate text-center">{item.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeCustomTab === "scene" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600">{t.lifestyle?.selectScene || '选择场景（不选则AI匹配）'}</span>
                        {selectedSceneId && (
                          <button onClick={() => setSelectedSceneId(null)} className="text-xs text-purple-600">
                            {t.lifestyle?.clearSelection || '清除选择'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => sceneUploadRef.current?.click()}
                          className="aspect-square rounded-xl overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-purple-400 transition-all flex flex-col items-center justify-center bg-zinc-50 hover:bg-purple-50"
                        >
                          <Plus className="w-8 h-8 text-zinc-400" />
                          <span className="text-xs text-zinc-500 mt-1">{t.common?.upload || '上传'}</span>
                        </button>
                        {allScenes.map(item => (
                          <div
                            key={item.id}
                            className={`aspect-square rounded-xl overflow-hidden relative border-2 transition-all cursor-pointer ${
                              selectedSceneId === item.id 
                                ? "border-purple-500 ring-2 ring-purple-500/30" 
                                : "border-transparent hover:border-purple-300"
                            }`}
                            onClick={() => setSelectedSceneId(selectedSceneId === item.id ? null : item.id)}
                          >
                            <Image src={item.imageUrl} alt={item.name || ""} fill className="object-cover" unoptimized />
                            {selectedSceneId === item.id && (
                              <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* File inputs */}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleCameraCapture} />
        <input type="file" ref={modelUploadRef} className="hidden" accept="image/*" onChange={handleModelUpload} />
        <input type="file" ref={sceneUploadRef} className="hidden" accept="image/*" onChange={handleSceneUpload} />
        
        <QuotaExceededModal
          isOpen={showExceededModal}
          onClose={closeExceededModal}
          requiredCount={requiredCount}
          usedCount={quota?.usedCount || 0}
          totalQuota={quota?.totalQuota || 0}
        />
      </div>
    )
  }
  
  // Processing mode
  if (mode === 'processing') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 mb-8 relative">
          <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full animate-pulse" />
          <Loader2 className="w-full h-full text-purple-500 animate-spin" />
        </div>
        <h3 className="text-white text-2xl font-bold mb-4">{t.lifestyle?.creating || '正在创作街拍大片'}</h3>
        <p className="text-zinc-400 text-sm mb-8">{generationStatus}</p>
        
        <div className="space-y-3 w-full max-w-xs">
          <p className="text-zinc-500 text-xs mb-4">{t.lifestyle?.continueInBackground || '生成将在后台继续，您可以：'}</p>
          <button
            onClick={handleRetake}
            className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <Camera className="w-5 h-5" />
            {t.lifestyle?.shootMore || '拍摄新一组'}
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
          >
            <Home className="w-5 h-5" />
            {t.lifestyle?.returnHome || '返回首页'}
          </button>
        </div>
        
        <BottomNav forceShow />
      </div>
    )
  }
  
  // Results mode
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 overflow-hidden">
      <div className="h-14 flex items-center justify-between px-4 border-b bg-white">
        <button onClick={handleRetake} className="flex items-center gap-2 font-medium">
          <ArrowLeft className="w-5 h-5" />
          <span>{t.lifestyle?.retake || '重拍'}</span>
        </button>
        <span className="font-bold">{t.lifestyle?.results || 'LifeStyle 成片'}</span>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => {
            const url = generatedImages[i]
            const currentTask = tasks.find(t => t.id === currentTaskId)
            const slot = currentTask?.imageSlots?.[i]
            const status = slot?.status || (url ? 'completed' : 'generating')
            
            return (
              <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-200 overflow-hidden relative">
                {url ? (
                  <Image src={url} alt="Result" fill className="object-cover" />
                ) : status === 'failed' ? (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                    <span className="text-xs">{t.camera?.generationFailed || '生成失败'}</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="p-4 pb-20 bg-white border-t shadow-up">
        <button onClick={handleRetake} className="w-full h-12 rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors">
          {t.lifestyle?.shootNextSet || '拍摄下一组'}
        </button>
      </div>
      <BottomNav forceShow />
    </div>
  )
}

export default function LifestyleOutfitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <LifestyleOutfitContent />
    </Suspense>
  )
}

