"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Check, Plus, Upload, Wand2, Loader2, X, Camera, ZoomIn, Image as ImageIcon, Download, Share2
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fileToBase64, generateId, compressBase64Image } from "@/lib/utils"
import { useTranslation } from "@/stores/languageStore"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useSettingsStore } from "@/stores/settingsStore"
import { Asset } from "@/types"

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
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, refreshQuota } = useQuota()
  const presetStore = usePresetStore()
  const { userModels } = useAssetStore()
  const { debugMode } = useSettingsStore()
  
  // Step state
  const [step, setStep] = useState<Step>('upload')
  
  // Image states
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [productImage, setProductImage] = useState<string | null>(null)
  const [modelImage, setModelImage] = useState<string | null>(null)
  const [isAutoModel, setIsAutoModel] = useState(true) // Default to auto mode
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  
  // UI states
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  // Result states - now with mode info
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageInfo[]>([])
  
  // Input refs
  const refImageInputRef = useRef<HTMLInputElement>(null)
  const productImageInputRef = useRef<HTMLInputElement>(null)
  const modelImageInputRef = useRef<HTMLInputElement>(null)
  
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
  const canGenerate = referenceImage && productImage && (isAutoModel || modelImage)
  
  // Start generation
  const handleGenerate = async () => {
    if (!canGenerate) return
    
    // Check quota (4 images: 2 simple + 2 extended)
    const hasQuota = await checkQuota(4)
    if (!hasQuota) return
    
    setStep('generating')
    setError(null)
    setGeneratedImages([])
    
    const taskId = generateId()
    const imageCount = 4
    
    // 预扣配额
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount,
          taskType: 'reference_shot',
        }),
      })
    } catch (e) {
      console.warn('[ReferenceShot] Failed to reserve quota:', e)
    }
    
    try {
      // Compress images before sending
      setLoadingMessage(t.referenceShot?.compressing || '压缩图片中...')
      const compressedRefImage = await compressBase64Image(referenceImage!, 1024)
      const compressedProductImage = await compressBase64Image(productImage!, 1024)
      
      let finalModelImage = modelImage
      
      // Step 1: Auto select model if needed
      if (isAutoModel) {
        setLoadingMessage(t.referenceShot?.selectingModel || '智能选择模特...')
        const autoSelectRes = await fetch('/api/reference-shot/auto-select-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productImage: compressedProductImage }),
        })
        
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
      
      // Simple mode: directly use ref_img as reference (2 images)
      const simplePromise = fetch('/api/reference-shot/generate-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: compressedProductImage,
          modelImage: finalModelImage,
          referenceImage: compressedRefImage,
        }),
      }).then(res => res.json())
      
      // Extended mode: caption + remove person + generate (2 images)
      const extendedPromise = (async () => {
        // Caption the reference image
        const captionRes = await fetch('/api/reference-shot/caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: compressedRefImage }),
        })
        const captionData = await captionRes.json()
        if (!captionData.success) {
          throw new Error(captionData.error || '分析参考图失败')
        }
        const captionPrompt = captionData.captionPrompt
        
        // Remove person from reference image
        const removePersonRes = await fetch('/api/reference-shot/remove-person', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: compressedRefImage }),
        })
        const removePersonData = await removePersonRes.json()
        if (!removePersonData.success) {
          throw new Error(removePersonData.error || '提取背景失败')
        }
        const backgroundImage = removePersonData.backgroundImage
        
        // Generate final images
        const generateRes = await fetch('/api/reference-shot/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: compressedProductImage,
            modelImage: finalModelImage,
            backgroundImage,
            captionPrompt,
            referenceImageUrl: referenceImage,
          }),
        })
        return generateRes.json()
      })()
      
      // Wait for both to complete
      const [simpleResult, extendedResult] = await Promise.all([simplePromise, extendedPromise])
      
      // Collect all images with mode info
      const allImages: GeneratedImageInfo[] = []
      
      if (simpleResult.success && simpleResult.images) {
        simpleResult.images.forEach((url: string) => {
          allImages.push({ url, mode: 'simple' })
        })
      }
      
      if (extendedResult.success && extendedResult.images) {
        extendedResult.images.forEach((url: string) => {
          allImages.push({ url, mode: 'extended' })
        })
      }
      
      if (allImages.length === 0) {
        throw new Error('生成图片失败')
      }
      
      console.log('[ReferenceShot] Generated images:', allImages.length, '(simple:', simpleResult.images?.length || 0, ', extended:', extendedResult.images?.length || 0, ')')
      
      // 根据实际生成数量调整配额
      if (allImages.length < imageCount) {
        const refundCount = imageCount - allImages.length
        console.log('[ReferenceShot] Refunding', refundCount, 'failed images')
        try {
          await fetch('/api/quota/reserve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              actualImageCount: allImages.length,
            }),
          })
        } catch (e) {
          console.warn('[ReferenceShot] Failed to refund quota:', e)
        }
      }
      
      // 保存到成片库
      try {
        await fetch('/api/reference-shot/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            imageUrls: allImages.map(img => img.url),
            referenceImageUrl: referenceImage,
            inputParams: {
              hasSimple: simpleResult.images?.length > 0,
              hasExtended: extendedResult.images?.length > 0,
              isAutoModel,
            },
          }),
        })
        console.log('[ReferenceShot] Saved to gallery')
      } catch (e) {
        console.warn('[ReferenceShot] Failed to save to gallery:', e)
      }
      
      setGeneratedImages(allImages)
      setStep('result')
      refreshQuota()
      
    } catch (err: any) {
      console.error('[ReferenceShot] Error:', err)
      setError(err.message || '生成失败')
      setStep('upload')
      
      // 生成失败，全额退还配额
      console.log('[ReferenceShot] Generation failed, refunding quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        refreshQuota()
      } catch (e) {
        console.warn('[ReferenceShot] Failed to refund quota:', e)
      }
    }
  }
  
  // Download image
  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const filename = `reference-shot-${index + 1}.png`
      const file = new File([blob], filename, { type: blob.type })
      
      // Check if iOS and can share
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        // Standard download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Download failed:', err)
    }
  }
  
  // Reset and start over
  const handleReset = () => {
    setStep('upload')
    setReferenceImage(null)
    setProductImage(null)
    setModelImage(null)
    setIsAutoModel(true)
    setSelectedModelId(null)
    setGeneratedImages([])
    setError(null)
  }
  
  // Check if iOS for share button
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
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
      
      {/* Content */}
      <div className="p-4 pb-32">
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Reference Image + Product Image - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Reference Image */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-800 mb-1">
                  {t.referenceShot?.referenceImage || '参考图'}
                </h3>
                <p className="text-[10px] text-zinc-500 mb-2 line-clamp-2">
                  {t.referenceShot?.referenceImageDesc || '上传参考图，AI学习风格'}
                </p>
                
                {referenceImage ? (
                  <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                    <Image src={referenceImage} alt="Reference" fill className="object-cover" />
                    <button
                      onClick={() => setReferenceImage(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => refImageInputRef.current?.click()}
                    className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Plus className="w-8 h-8 text-zinc-400" />
                    <span className="text-xs text-zinc-500">{t.common?.upload || '上传'}</span>
                  </button>
                )}
              </div>
              
              {/* Product Image */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-800 mb-1">
                  {t.referenceShot?.productImage || '商品图'}
                </h3>
                <p className="text-[10px] text-zinc-500 mb-2 line-clamp-2">
                  {t.referenceShot?.productImageDesc || '上传商品图'}
                </p>
                
                {productImage ? (
                  <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                    <Image src={productImage} alt="Product" fill className="object-cover" />
                    <button
                      onClick={() => setProductImage(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => productImageInputRef.current?.click()}
                    className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Plus className="w-8 h-8 text-zinc-400" />
                    <span className="text-xs text-zinc-500">{t.common?.upload || '上传'}</span>
                  </button>
                )}
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
                <button
                  onClick={() => setShowModelPicker(true)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    !isAutoModel && modelImage
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 bg-white hover:border-blue-300'
                  }`}
                >
                  {modelImage && !isAutoModel ? (
                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden">
                      <Image src={modelImage} alt="Model" fill className="object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <ImageIcon className="w-5 h-5 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-600">
                        {t.referenceShot?.selectModel || '选择模特'}
                      </span>
                    </div>
                  )}
                </button>
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}
        
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 animate-pulse" />
              <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-white animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-800">{loadingMessage}</p>
              <p className="text-sm text-zinc-500 mt-1">{t.common?.pleaseWait || '请稍候'}</p>
            </div>
          </div>
        )}
        
        {step === 'result' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-zinc-800">
                {t.referenceShot?.resultTitle || '生成完成'}
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {t.referenceShot?.resultDesc || '点击图片可放大查看'}
              </p>
            </div>
            
            {/* Generated Images */}
            <div className="flex flex-col gap-4">
              {generatedImages.map((img, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 shadow-lg"
                >
                  <Image
                    src={img.url}
                    alt={`Generated ${index + 1}`}
                    fill
                    className="object-cover cursor-pointer z-10"
                    onClick={() => setZoomImage(img.url)}
                  />
                  
                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex gap-2 z-20">
                    <button
                      onClick={() => handleDownload(img.url, index)}
                      className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                    >
                      {isIOS ? (
                        <Share2 className="w-5 h-5 text-zinc-700" />
                      ) : (
                        <Download className="w-5 h-5 text-zinc-700" />
                      )}
                    </button>
                    <button
                      onClick={() => setZoomImage(img.url)}
                      className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                    >
                      <ZoomIn className="w-5 h-5 text-zinc-700" />
                    </button>
                  </div>
                  
                  {/* Number badge */}
                  <div className="absolute top-3 left-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-sm font-bold z-20">
                    #{index + 1}
                  </div>
                  
                  {/* Mode badge - only visible for debug users */}
                  {debugMode && (
                    <div className={`absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs font-semibold z-20 ${
                      img.mode === 'simple' 
                        ? 'bg-green-500/80 text-white' 
                        : 'bg-purple-500/80 text-white'
                    }`}>
                      {img.mode === 'simple' ? 'Simple' : 'Extended'}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 h-12 rounded-full bg-zinc-100 text-zinc-700 font-semibold hover:bg-zinc-200 transition-colors"
              >
                {t.referenceShot?.newGeneration || '重新生成'}
              </button>
              <button
                onClick={() => router.push('/gallery')}
                className="flex-1 h-12 rounded-full bg-black text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                {t.referenceShot?.viewGallery || '查看成片'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Fixed Generate Button at Bottom - Only show in upload step */}
      {step === 'upload' && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/95 backdrop-blur-lg border-t border-zinc-100 z-30">
          <motion.button
            onClick={handleGenerate}
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
          </motion.button>
        </div>
      )}
      
      {/* Model Picker Modal */}
      <AnimatePresence>
        {showModelPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowModelPicker(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold text-lg">{t.referenceShot?.selectModel || '选择模特'}</span>
                <button
                  onClick={() => setShowModelPicker(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {/* Upload custom model button */}
                <div className="mb-4">
                  <button
                    onClick={() => modelImageInputRef.current?.click()}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-600">
                      {t.referenceShot?.uploadCustomModel || '上传自定义模特'}
                    </span>
                  </button>
                </div>
                
                {/* Model grid */}
                <div className="grid grid-cols-2 gap-3">
                  {allModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model)}
                      className={`aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all ${
                        selectedModelId === model.id
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-transparent hover:border-blue-300'
                      }`}
                    >
                      <Image src={model.imageUrl} alt={model.name || ''} fill className="object-cover" />
                      {selectedModelId === model.id && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                        <p className="text-xs text-white truncate text-center">{model.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
                
                {allModels.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                    <p className="text-sm">{t.referenceShot?.noModels || '暂无模特'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
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
        onChange={(e) => handleFileUpload(e, setProductImage)}
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
      
      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
      />
    </div>
  )
}

