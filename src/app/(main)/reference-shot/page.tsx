"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Check, Plus, Upload, Wand2, Loader2, X, Camera, ZoomIn, Image as ImageIcon, Download, Share2, Home, FolderHeart, Heart, Smartphone
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fileToBase64, generateId, compressBase64Image } from "@/lib/utils"
import { useTranslation } from "@/stores/languageStore"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { useImageDownload } from "@/hooks/useImageDownload"
import { useSettingsStore } from "@/stores/settingsStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { Asset } from "@/types"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { ModelPickerPanel } from "@/components/shared/ModelPickerPanel"
import { GalleryPickerPanel } from "@/components/shared/GalleryPickerPanel"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { ResultsView } from "@/components/shared/ResultsView"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { TASK_CREDIT_COSTS, TaskTypes } from "@/lib/taskTypes"
import { useFavorite } from "@/hooks/useFavorite"
import { navigateToEdit } from "@/lib/navigation"
import { useLoginGuard } from "@/hooks/useLoginGuard"
import { LoginModal } from "@/components/shared/LoginModal"

const CREDIT_COST = TASK_CREDIT_COSTS[TaskTypes.REFERENCE_SHOT]

// Steps
type Step = 'upload' | 'generating' | 'result'

// Generated image with mode info
interface GeneratedImageInfo {
  url: string
  mode: 'simple' | 'extended'
}

// Storage base URL for all_models
const ALL_MODELS_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'

export default function ReferenceShotPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { checkQuota } = useQuota()
  const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
  const presetStore = usePresetStore()
  const { userModels } = useAssetStore()
  const { debugMode } = useSettingsStore()
  const { addTask, initImageSlots, updateImageSlot, updateTaskStatus, removeTask, tasks } = useGenerationTaskStore()
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Step state
  const [step, setStep] = useState<Step>('upload')
  
  // Image states
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [productImages, setProductImages] = useState<string[]>([]) // Support up to 4 products
  const [modelImage, setModelImage] = useState<string | null>(null)
  
  const MAX_PRODUCT_IMAGES = 4
  const [isAutoModel, setIsAutoModel] = useState(true) // Default to auto mode
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  
  // UI states
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showRefGalleryPicker, setShowRefGalleryPicker] = useState(false)
  const [showRefAssetPicker, setShowRefAssetPicker] = useState(false)
  const [showProductGalleryPicker, setShowProductGalleryPicker] = useState(false)
  const [showProductAssetPicker, setShowProductAssetPicker] = useState(false)
  const [showProductSourcePanel, setShowProductSourcePanel] = useState(false) // 商品图来源选择面板
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  
  // Result states - now with mode info
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageInfo[]>([])
  
  // Input refs
  const refImageInputRef = useRef<HTMLInputElement>(null)
  const productImageInputRef = useRef<HTMLInputElement>(null)
  const modelImageInputRef = useRef<HTMLInputElement>(null)

  // Login guard
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard()

  // 触发上传前检查登录
  const triggerRefImageUpload = () => {
    if (!requireLogin()) return
    refImageInputRef.current?.click()
  }

  const triggerProductImageUpload = () => {
    if (!requireLogin()) return
    productImageInputRef.current?.click()
  }

  // Load presets
  useEffect(() => {
    presetStore.loadPresets()
  }, [presetStore])
  
  // Get all available models
  const allModels = [...(presetStore.studioModels || []), ...(userModels || [])]
  
  // Handle file upload
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (img: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setImage(base64)
    }
    e.target.value = ''
  }
  
  // Handle model selection
  const handleModelSelect = (model: Asset) => {
    setSelectedModelId(model.id)
    setModelImage(model.imageUrl)
    setIsAutoModel(false)
    setShowModelPicker(false)
  }
  
  // Handle auto model selection
  const handleAutoModelSelect = () => {
    setIsAutoModel(true)
    setSelectedModelId(null)
    setModelImage(null)
    setShowModelPicker(false)
  }
  
  // Check if ready to generate
  const canGenerate = referenceImage && productImages.length > 0 && (isAutoModel || modelImage)
  
  // Start generation
  const handleGenerate = async () => {
    if (!canGenerate) return
    
    // Check quota
    const hasQuota = await checkQuota(CREDIT_COST)
    if (!hasQuota) return
    
    setStep('generating')
    setError(null)
    setGeneratedImages([])
    
    const imageCount = 2
    
    // 创建任务到 generationTaskStore（Photos tab 会显示 loading）
    const taskId = addTask('reference_shot', productImages[0], {}, imageCount)
    initImageSlots(taskId, imageCount)
    setCurrentGenerationId(taskId) // 设置当前任务 ID 以便 recovery effect 使用

    // 预扣配额（使用统一 hook）
    await reserveQuota({ taskId, imageCount, taskType: 'reference_shot' })
    
    try {
      // Compress images before sending
      setLoadingMessage(t.referenceShot?.compressing || '压缩图片中...')
      const compressedRefImage = await compressBase64Image(referenceImage!, 1024)
      // Compress all product images
      const compressedProductImages = await Promise.all(
        productImages.map(img => compressBase64Image(img, 1024))
      )
      const compressedProductImage = compressedProductImages[0] // Primary product for model selection
      
      let finalModelImage = modelImage
      
      // Step 1: Auto select model if needed
      if (isAutoModel) {
        setLoadingMessage(t.referenceShot?.selectingModel || '智能选择模特...')
        const autoSelectRes = await fetch('/api/reference-shot/auto-select-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productImage: compressedProductImage }),
        })
        
        // Handle non-JSON responses (e.g., Cloudflare timeout errors)
        const contentType = autoSelectRes.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await autoSelectRes.text()
          console.error('[ReferenceShot] Non-JSON response from auto-select:', text.substring(0, 200))
          if (autoSelectRes.status === 504 || text.includes('gateway') || text.includes('timeout')) {
            throw new Error('服务器响应超时，请稍后重试')
          }
          throw new Error(`服务器错误 (${autoSelectRes.status})`)
        }
        
        const autoSelectData = await autoSelectRes.json()
        if (!autoSelectData.success) {
          throw new Error(autoSelectData.error || '自动选择模特失败')
        }
        
        finalModelImage = autoSelectData.modelImageUrl
        console.log('[ReferenceShot] Auto selected model:', autoSelectData.modelId)
      } else {
        // Compress custom model image
        finalModelImage = await compressBase64Image(modelImage!, 1024)
      }
      
      // Step 2: Generate images in parallel (Simple + Extended)
      setLoadingMessage(t.referenceShot?.generating || '生成图片中...')
      
      // 更新所有 imageSlot 为 generating 状态
      for (let i = 0; i < imageCount; i++) {
        updateImageSlot(taskId, i, { status: 'generating' })
      }
      
      // Helper function to safely parse JSON response
      const safeJsonParse = async (res: Response, apiName: string) => {
        const contentType = res.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text()
          console.error(`[ReferenceShot] Non-JSON response from ${apiName}:`, text.substring(0, 200))
          if (res.status === 504 || text.includes('gateway') || text.includes('timeout')) {
            return { success: false, error: '服务器响应超时' }
          }
          return { success: false, error: `服务器错误 (${res.status})` }
        }
        return res.json()
      }
      
      // Track results
      const allImages: GeneratedImageInfo[] = []
      let firstImageSwitched = false
      let simpleCompleted = false
      let extendedCompleted = false
      
      // Helper to add image and switch to results on first
      const addImageResult = (url: string, mode: 'simple' | 'extended', index: number) => {
        allImages.push({ url, mode })
        
        // Update image slot
        updateImageSlot(taskId, index, {
          status: 'completed',
          imageUrl: url,
          genMode: mode,
        })
        
        // Update UI immediately
        setGeneratedImages(prev => [...prev, { url, mode }])
        
        // Switch to results on first image
        if (!firstImageSwitched && step === 'generating') {
          firstImageSwitched = true
          console.log('[ReferenceShot] First image ready, switching to results')
          setCurrentGenerationId(taskId)
          setStep('result')
        }
      }
      
      // Simple mode: directly use ref_img as reference
      const runSimple = async () => {
        try {
          const res = await fetch('/api/reference-shot/generate-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: compressedProductImage,
              productImages: compressedProductImages,
          modelImage: finalModelImage,
          referenceImage: compressedRefImage,
        }),
          })
          const result = await safeJsonParse(res, 'generate-simple')
          if (result.success && result.images) {
            result.images.forEach((url: string, i: number) => {
              addImageResult(url, 'simple', allImages.length)
            })
          }
          simpleCompleted = true
        } catch (e) {
          console.warn('[ReferenceShot] Simple mode failed:', e)
          simpleCompleted = true
        }
      }
      
      // Extended mode: caption + remove person + generate
      const runExtended = async () => {
        try {
        // Caption the reference image
        const captionRes = await fetch('/api/reference-shot/caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: compressedRefImage }),
        })
        const captionData = await safeJsonParse(captionRes, 'caption')
        if (!captionData.success) {
          console.warn('[ReferenceShot] Caption failed:', captionData.error)
            extendedCompleted = true
            return
        }
        const captionPrompt = captionData.captionPrompt
        
        // Remove person from reference image
        const removePersonRes = await fetch('/api/reference-shot/remove-person', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: compressedRefImage }),
        })
        const removePersonData = await safeJsonParse(removePersonRes, 'remove-person')
        if (!removePersonData.success) {
          console.warn('[ReferenceShot] Remove person failed:', removePersonData.error)
            extendedCompleted = true
            return
        }
        const backgroundImage = removePersonData.backgroundImage
        
        // Generate final images
        const generateRes = await fetch('/api/reference-shot/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: compressedProductImage,
              productImages: compressedProductImages,
            modelImage: finalModelImage,
            backgroundImage,
            captionPrompt,
            referenceImageUrl: referenceImage,
          }),
        })
          const result = await safeJsonParse(generateRes, 'generate')
          if (result.success && result.images) {
            result.images.forEach((url: string) => {
              addImageResult(url, 'extended', allImages.length)
            })
          }
          extendedCompleted = true
        } catch (e) {
          console.warn('[ReferenceShot] Extended mode failed:', e)
          extendedCompleted = true
        }
      }
      
      // Run both modes in parallel (don't await together)
      const simpleTask = runSimple()
      const extendedTask = runExtended()
      
      // Wait for both to finish for final processing
      await Promise.all([simpleTask, extendedTask])
      
      if (allImages.length === 0) {
        throw new Error('生成图片失败')
      }
      
      console.log('[ReferenceShot] Generated images:', allImages.length)
      
      // 部分退款（使用统一 hook）
      if (allImages.length > 0 && allImages.length < imageCount) {
        await partialRefund(taskId, allImages.length)
      }
      
      // 保存到成片库
      try {
        await fetch('/api/reference-shot/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            imageUrls: allImages.map(img => img.url),
            productImageUrl: productImages[0],
            productImageUrls: productImages,
            referenceImageUrl: referenceImage,
            inputParams: {
              hasSimple: allImages.some(img => img.mode === 'simple'),
              hasExtended: allImages.some(img => img.mode === 'extended'),
              isAutoModel,
            },
          }),
        })
        console.log('[ReferenceShot] Saved to gallery')
      } catch (e) {
        console.warn('[ReferenceShot] Failed to save to gallery:', e)
      }
      
      // 更新整体任务状态
      updateTaskStatus(taskId, 'completed', allImages.map(img => img.url))
      confirmQuota()
      
    } catch (err: any) {
      console.error('[ReferenceShot] Error:', err)
      setError(err.message || '生成失败')
      setStep('upload')
      
      // 更新任务状态为失败
      updateTaskStatus(taskId, 'failed', undefined, err.message || '生成失败')
      
      // 生成失败，全额退还配额（使用统一 hook）
      await refundQuota(taskId)
    }
  }
  
  // Download image - using shared hook
  const { downloadImage } = useImageDownload({ filenamePrefix: 'reference-shot' })
  const handleDownload = (imageUrl: string, index: number) =>
    downloadImage(imageUrl, { filename: `reference-shot-${index + 1}.png` })

  // Current generation ID for favorites
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)

  // Favorite - using shared hook
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)

  // Recovery effect: 当任务已完成但界面还在 generating 时，自动切换到 result
  useEffect(() => {
    if (step !== 'generating' || !currentGenerationId) return

    const currentTask = tasks.find(t => t.id === currentGenerationId)
    
    // 如果任务在 store 中不存在
    if (!currentTask) {
      if (generatedImages.length > 0) {
        console.log('[ReferenceShot] Task not found but has images, switching to result')
        setStep('result')
      } else {
        console.log('[ReferenceShot] Task not found and no images, returning to upload')
        setStep('upload')
      }
      return
    }

    // 如果任务状态已经是 completed 或 failed，直接切换
    if (currentTask.status === 'completed' || currentTask.status === 'failed') {
      console.log(`[ReferenceShot] Task status is ${currentTask.status}, switching to result`)
      if (currentTask.imageSlots) {
        const images = currentTask.imageSlots
          .filter(s => s.imageUrl)
          .map(s => ({ url: s.imageUrl!, mode: (s.genMode || 'simple') as 'simple' | 'extended' }))
        if (images.length > 0) {
          setGeneratedImages(images)
        }
      }
      setStep('result')
      return
    }

    if (!currentTask.imageSlots) return

    // 检查是否有任何一张图片完成
    const hasAnyCompleted = currentTask.imageSlots.some(s => s.status === 'completed')
    // 检查是否所有图片都已处理完毕
    const allProcessed = currentTask.imageSlots.every(s => s.status === 'completed' || s.status === 'failed')

    if (hasAnyCompleted) {
      console.log('[ReferenceShot] Task has completed images, switching to result')
      const images = currentTask.imageSlots
        .filter(s => s.imageUrl)
        .map(s => ({ url: s.imageUrl!, mode: (s.genMode || 'simple') as 'simple' | 'extended' }))
      setGeneratedImages(images)
      setStep('result')
    } else if (allProcessed) {
      console.log('[ReferenceShot] All images failed, switching to result')
      setGeneratedImages([])
      setStep('result')
    }
  }, [step, currentGenerationId, tasks, generatedImages.length])
  
  // Reset and start over
  const handleReset = () => {
    setStep('upload')
    setReferenceImage(null)
    setProductImages([])
    setModelImage(null)
    setIsAutoModel(true)
    setSelectedModelId(null)
    setGeneratedImages([])
    setError(null)
  }
  
  // Check if iOS for share button
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className={`min-h-screen ${step === 'upload' ? 'bg-zinc-50' : 'bg-zinc-50 flex flex-col'}`}>
      {/* Header - only show on upload step */}
      {step === 'upload' && (
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-zinc-100">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-700" />
          </button>
          <span className="text-zinc-900 font-medium text-sm">
            {t.referenceShot?.title || 'Reference Shot'}
          </span>
          <div className="w-9" />
        </div>
      </div>
      )}
      
      {/* Content */}
      <div className={step === 'upload' ? `p-4 pb-32 ${isDesktop ? 'max-w-4xl mx-auto py-8' : ''}` : 'flex-1 flex flex-col'}>
        {step === 'upload' && (
          <div className={`space-y-4 ${isDesktop ? 'bg-white rounded-2xl shadow-sm border border-zinc-100 p-6' : ''}`}>
            {/* Reference Image + Product Image - Side by Side */}
            <div className={`grid grid-cols-2 gap-3 ${isDesktop ? 'gap-6' : ''}`}>
              {/* Reference Image */}
              <div>
                <h3 className={`font-semibold text-zinc-800 mb-1 ${isDesktop ? 'text-sm' : 'text-xs'}`}>
                  {t.referenceShot?.referenceImage || '参考图'}
                </h3>
                <p className={`text-zinc-500 mb-2 line-clamp-2 ${isDesktop ? 'text-xs' : 'text-[10px]'}`}>
                  {t.referenceShot?.referenceImageDesc || '上传参考图，AI学习风格'}
                </p>
                
                {referenceImage ? (
                  <div className="relative w-full rounded-xl overflow-hidden bg-zinc-100">
                    <img src={referenceImage} alt="Reference" className="w-full h-auto max-h-[300px] object-contain" />
                    <button
                      onClick={() => setReferenceImage(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Drag & Drop Area */}
                    <div
                    onClick={triggerRefImageUpload}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/')) {
                          const base64 = await fileToBase64(file)
                          setReferenceImage(base64)
                        }
                      }}
                      className={`w-full rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${isDesktop ? 'aspect-square max-h-[200px]' : 'aspect-[4/3]'}`}
                    >
                      <Plus className="w-6 h-6 text-zinc-400" />
                      <span className="text-xs text-zinc-500">{t.common?.upload || 'Upload'}</span>
                      <span className="text-[10px] text-zinc-400">{t.common?.clickToUploadOrDrag || 'Click or drag & drop'}</span>
                    </div>
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setShowRefGalleryPicker(true)}
                        className="h-8 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-600">{t.common?.fromGallery || 'Photos'}</span>
                  </button>
                      <button
                        onClick={() => setShowRefAssetPicker(true)}
                        className="h-8 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FolderHeart className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-600">{t.common?.fromAssets || 'Assets'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Product Images - Support up to 4 */}
              <div>
                <h3 className={`font-semibold text-zinc-800 mb-1 ${isDesktop ? 'text-sm' : 'text-xs'}`}>
                  {t.referenceShot?.productImage || '商品图'} ({productImages.length}/{MAX_PRODUCT_IMAGES})
                </h3>
                <p className={`text-zinc-500 mb-2 line-clamp-2 ${isDesktop ? 'text-xs' : 'text-[10px]'}`}>
                  {t.referenceShot?.productImageDesc || '上传商品图'}{productImages.length >= 2 && ` (多图可能影响质量)`}
                </p>

                {/* Product Image Grid */}
                <div className={`grid gap-2 ${isDesktop ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {/* Existing Images */}
                  {productImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 group">
                      <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                        onClick={() => setProductImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                      {idx === 0 && (
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-blue-500 rounded text-[10px] text-white font-medium">
                          #1
                  </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Add More Button */}
                  {productImages.length < MAX_PRODUCT_IMAGES && (
                    <div
                      onClick={() => setShowProductSourcePanel(true)}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/') && productImages.length < MAX_PRODUCT_IMAGES) {
                          const base64 = await fileToBase64(file)
                          setProductImages(prev => [...prev, base64])
                        }
                      }}
                      className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-6 h-6 text-zinc-400" />
                      <span className="text-[10px] text-zinc-500">+</span>
                    </div>
                  )}
                </div>
                
                {/* Quick Actions - Always show for easy access */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  <button
                    onClick={triggerProductImageUpload}
                    className="h-8 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-600">{t.camera?.album || '相册'}</span>
                  </button>
                  <button
                    onClick={() => setShowProductGalleryPicker(true)}
                    className="h-8 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-600">{t.common?.fromGallery || '成片'}</span>
                  </button>
                  <button
                    onClick={() => setShowProductAssetPicker(true)}
                    className="h-8 rounded-lg border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderHeart className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-600">{t.common?.fromAssets || '资产'}</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Model Selection */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 mb-2">
                {t.referenceShot?.modelImage || '模特'}
              </h3>
              <p className="text-xs text-zinc-500 mb-3">
                {t.referenceShot?.modelImageDesc || '选择模特或让AI自动匹配'}
              </p>
              
              <div className="flex gap-3">
                {/* Auto Mode Button */}
                <button
                  onClick={handleAutoModelSelect}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    isAutoModel
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Wand2 className={`w-5 h-5 ${isAutoModel ? 'text-blue-600' : 'text-zinc-400'}`} />
                    <span className={`text-sm font-medium ${isAutoModel ? 'text-blue-700' : 'text-zinc-600'}`}>
                      {t.referenceShot?.autoMode || '智能匹配'}
                    </span>
                    {isAutoModel && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </button>
                
                {/* Custom Model Button */}
                <div className={`flex-1 p-4 rounded-xl border-2 transition-all relative ${
                    !isAutoModel && modelImage
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 bg-white hover:border-blue-300'
                }`}>
                  {modelImage && !isAutoModel ? (
                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden group">
                      <Image src={modelImage} alt="Model" fill className="object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                      {/* Clear button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setModelImage(null)
                          setSelectedModelId(null)
                          setIsAutoModel(true)
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      {/* Click to change */}
                      <button
                        onClick={() => setShowModelPicker(true)}
                        className="absolute inset-0 z-0"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowModelPicker(true)}
                      className="w-full flex items-center justify-center gap-2 py-4"
                    >
                      <ImageIcon className="w-5 h-5 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-600">
                        {t.referenceShot?.selectModel || '选择模特'}
                      </span>
                </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            
            {/* Generate Button - PC only, inside content area */}
            {isDesktop && (
              <motion.button
                onClick={(e) => {
                  triggerFlyToGallery(e)
                  handleGenerate()
                }}
                disabled={!canGenerate}
                whileTap={{ scale: 0.98 }}
                className={`w-full h-14 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg ${
                  canGenerate
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Wand2 className="w-5 h-5" />
                {t.referenceShot?.generate || '开始生成'}
                <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
              </motion.button>
            )}
          </div>
        )}
        
        {step === 'generating' && (
          <ProcessingView
            numImages={2}
            generatedImages={generatedImages.map(img => img.url)}
            themeColor="blue"
            title={t.referenceShot?.generating || 'Creating reference shot'}
            mobileStatusLines={[loadingMessage]}
            aspectRatio="3/4"
            gridCols={2}
            onShootMore={handleReset}
            onReturnHome={() => router.push('/')}
            onGoToGallery={() => router.push('/gallery')}
            onDownload={handleDownload}
            shootMoreText={t.camera?.shootNextSet || '拍摄下一组'}
            returnHomeText={t.camera?.returnHome || 'Return Home'}
          />
        )}
        
        {step === 'result' && (
          <ResultsView
            title={t.referenceShot?.resultTitle || 'Generation Complete'}
            onBack={handleReset}
            images={Array.from({ length: 2 }).map((_, i) => ({
              url: generatedImages[i]?.url,
              status: generatedImages[i]?.url ? 'completed' as const : 'generating' as const,
            }))}
            getBadge={(i) => ({
              text: debugMode && generatedImages[i]?.mode === 'simple' 
                ? (t.gallery?.simpleMode || 'Simple') 
                : (debugMode && generatedImages[i]?.mode === 'extended' 
                  ? (t.gallery?.extendedMode || 'Extended') 
                  : (t.gallery?.referenceShot || 'Reference')),
              className: debugMode && generatedImages[i]?.mode === 'simple' ? 'bg-green-500' : (debugMode && generatedImages[i]?.mode === 'extended' ? 'bg-purple-500' : 'bg-blue-500'),
            })}
            themeColor="blue"
            aspectRatio="3/4"
            gridCols={{ mobile: 2, desktop: 2 }}
            onFavorite={(i) => toggleFavorite(i)}
            isFavorited={(i) => isFavorited(i)}
            onDownload={(url, i) => handleDownload(url, i)}
            onShootNext={handleReset}
            onGoEdit={(imageUrl) => navigateToEdit(router, imageUrl)}
            onRegenerate={handleReset}
            onImageClick={(i) => setSelectedResultIndex(i)}
            showBottomNav={!isDesktop}
          >
            {/* Photo Detail Dialog */}
            <PhotoDetailDialog
              open={selectedResultIndex !== null && !!generatedImages[selectedResultIndex!]?.url}
              onClose={() => setSelectedResultIndex(null)}
              imageUrl={selectedResultIndex !== null ? generatedImages[selectedResultIndex]?.url || '' : ''}
              badges={[{ 
                text: debugMode && selectedResultIndex !== null && generatedImages[selectedResultIndex]?.mode === 'simple' 
                  ? (t.gallery?.simpleMode || 'Simple')
                  : (debugMode && selectedResultIndex !== null && generatedImages[selectedResultIndex]?.mode === 'extended' 
                    ? (t.gallery?.extendedMode || 'Extended')
                    : (t.gallery?.referenceShot || 'Reference')),
                className: debugMode && selectedResultIndex !== null && generatedImages[selectedResultIndex]?.mode === 'simple'
                  ? 'bg-green-500 text-white'
                  : (debugMode && selectedResultIndex !== null && generatedImages[selectedResultIndex]?.mode === 'extended'
                    ? 'bg-purple-500 text-white'
                    : 'bg-blue-500 text-white'),
              }]}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={() => {
                if (selectedResultIndex !== null && generatedImages[selectedResultIndex]?.url) {
                  handleDownload(generatedImages[selectedResultIndex].url, selectedResultIndex)
                }
              }}
              onFullscreen={() => {
                if (selectedResultIndex !== null && generatedImages[selectedResultIndex]?.url) {
                  setZoomImage(generatedImages[selectedResultIndex].url)
                }
              }}
              inputImages={productImages.length > 0 ? productImages.map((url, i) => ({
                url,
                label: `${t.common?.product || 'Product'} ${i + 1}`,
              })) : []}
              onInputImageClick={(url) => setZoomImage(url)}
              quickActions={selectedResultIndex !== null ? [
                createQuickActions.tryOn(() => {
                  const selectedImageUrl = generatedImages[selectedResultIndex]?.url
                  if (selectedImageUrl) {
                    sessionStorage.setItem('tryOnImage', selectedImageUrl)
                    router.push('/try-on')
                  }
                }),
                createQuickActions.edit(() => {
                  const selectedImageUrl = generatedImages[selectedResultIndex]?.url
                  if (selectedImageUrl) {
                    setSelectedResultIndex(null)
                    navigateToEdit(router, selectedImageUrl)
                  }
                }),
                createQuickActions.groupShoot(() => {
                  const selectedImageUrl = generatedImages[selectedResultIndex]?.url
                  if (selectedImageUrl) {
                    sessionStorage.setItem('groupShootImage', selectedImageUrl)
                    setSelectedResultIndex(null)
                    router.push('/group-shot')
                  }
                }),
                createQuickActions.material(() => {
                  const selectedImageUrl = generatedImages[selectedResultIndex]?.url
                  if (selectedImageUrl) {
                    sessionStorage.setItem('modifyMaterial_outputImage', selectedImageUrl)
                    sessionStorage.setItem('modifyMaterial_inputImages', JSON.stringify(productImages.filter(Boolean)))
                    router.push('/gallery/modify-material')
                  }
                }),
              ] : []}
            />
          </ResultsView>
        )}
      </div>
      
      {/* Generate Button - Mobile only, fixed at bottom */}
      {step === 'upload' && !isDesktop && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-zinc-100 z-30">
          <motion.button
            onClick={(e) => {
              triggerFlyToGallery(e)
              handleGenerate()
            }}
            disabled={!canGenerate}
            whileTap={{ scale: 0.98 }}
            className={`w-full h-12 rounded-full text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg ${
              canGenerate
                ? 'bg-black text-white hover:bg-zinc-800'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            <Wand2 className="w-5 h-5" />
            {t.referenceShot?.generate || '开始生成'}
            <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
          </motion.button>
        </div>
      )}
      
      {/* Model Picker */}
      <ModelPickerPanel
        open={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        title={t.referenceShot?.selectModel || 'Select Model'}
        selectedId={selectedModelId}
        customModels={userModels}
        onSelect={handleModelSelect}
        onCustomUpload={(model) => {
          useAssetStore.getState().addUserAsset(model)
        }}
        themeColor="blue"
        allowUpload
      />
      
      {/* Zoom Image Modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setZoomImage(null)}
          >
            <img
              src={zoomImage}
              alt="Zoomed"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hidden inputs */}
      <input
        type="file"
        ref={refImageInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileUpload(e, setReferenceImage)}
      />
      <input
        type="file"
        ref={productImageInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileUpload(e, (img) => {
          if (productImages.length < MAX_PRODUCT_IMAGES) {
            setProductImages(prev => [...prev, img])
          }
        })}
      />
      <input
        type="file"
        ref={modelImageInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          handleFileUpload(e, (img) => {
            setModelImage(img)
            setIsAutoModel(false)
            setSelectedModelId(null)
            setShowModelPicker(false)
          })
        }}
      />

      {/* Reference Image - Gallery Picker */}
      <GalleryPickerPanel
        open={showRefGalleryPicker}
        onClose={() => setShowRefGalleryPicker(false)}
        onSelect={(imageUrl) => {
          setReferenceImage(imageUrl)
          setShowRefGalleryPicker(false)
        }}
        themeColor="blue"
        title={t.referenceShot?.selectReference || 'Select Reference'}
      />

      {/* Reference Image - Asset Picker */}
      <AssetPickerPanel
        open={showRefAssetPicker}
        onClose={() => setShowRefAssetPicker(false)}
        onSelect={(imageUrl) => {
          setReferenceImage(imageUrl)
          setShowRefAssetPicker(false)
        }}
        onUploadClick={() => {
          setShowRefAssetPicker(false)
          triggerRefImageUpload()
        }}
        themeColor="blue"
        title={t.referenceShot?.selectReference || 'Select Reference'}
      />

      {/* Product Image - Gallery Picker */}
      <GalleryPickerPanel
        open={showProductGalleryPicker}
        onClose={() => setShowProductGalleryPicker(false)}
        onSelect={(imageUrl) => {
          if (productImages.length < MAX_PRODUCT_IMAGES) {
            setProductImages(prev => [...prev, imageUrl])
          }
          setShowProductGalleryPicker(false)
        }}
        themeColor="blue"
        title={t.referenceShot?.selectProduct || 'Select Product'}
      />

      {/* Product Image - Asset Picker */}
      <AssetPickerPanel
        open={showProductAssetPicker}
        onClose={() => setShowProductAssetPicker(false)}
        onSelect={(imageUrl) => {
          if (productImages.length < MAX_PRODUCT_IMAGES) {
            setProductImages(prev => [...prev, imageUrl])
          }
          setShowProductAssetPicker(false)
        }}
        onUploadClick={() => {
          setShowProductAssetPicker(false)
          triggerProductImageUpload()
        }}
        themeColor="blue"
        title={t.referenceShot?.selectProduct || 'Select Product'}
      />

      {/* Product Source Panel - Mobile slide up panel */}
      {showProductSourcePanel && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowProductSourcePanel(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-50 p-4 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {t.camera?.selectProduct || '选择商品图'}
              </span>
              <button
                onClick={() => setShowProductSourcePanel(false)}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setShowProductSourcePanel(false)
                  triggerProductImageUpload()
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <Smartphone className="w-6 h-6 text-blue-500" />
                <span className="text-sm text-zinc-700">{t.camera?.album || '相册'}</span>
              </button>
              <button
                onClick={() => {
                  setShowProductSourcePanel(false)
                  setShowProductGalleryPicker(true)
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <ImageIcon className="w-6 h-6 text-blue-500" />
                <span className="text-sm text-zinc-700">{t.common?.fromGallery || '成片'}</span>
              </button>
              <button
                onClick={() => {
                  setShowProductSourcePanel(false)
                  setShowProductAssetPicker(true)
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <FolderHeart className="w-6 h-6 text-blue-500" />
                <span className="text-sm text-zinc-700">{t.common?.fromAssets || '资产库'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Login Modal */}
      <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
      
    </div>
  )
}

