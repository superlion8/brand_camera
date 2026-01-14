"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home, Upload, X, Plus, Loader2, Camera,
  Sparkles, Check, ArrowLeft, FolderHeart, Download, Wand2, ZoomIn, Grid3X3, Palette, Heart
} from "lucide-react"
import { fileToBase64, compressBase64Image } from "@/lib/utils"
import { useQuota } from "@/hooks/useQuota"
import { useQuotaReservation } from "@/hooks/useQuotaReservation"
import { navigateToEdit } from "@/lib/navigation"
import { ProcessingView } from "@/components/shared/ProcessingView"
import { ResultsView } from "@/components/shared/ResultsView"
import { useFavorite } from "@/hooks/useFavorite"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { TASK_CREDIT_COSTS, TaskTypes } from "@/lib/taskTypes"
import { GalleryPickerPanel } from "@/components/shared/GalleryPickerPanel"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { PhotoDetailDialog, createQuickActions } from "@/components/shared/PhotoDetailDialog"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"

const CREDIT_COST = TASK_CREDIT_COSTS[TaskTypes.TRY_ON]

// 直接导入 Webcam（类型问题无法用 dynamic 解决）
import Webcam from "react-webcam"
// 动态导入 zoom-pan-pinch 组件，减少初始加载时间

const MAX_CLOTHING_IMAGES = 4 // Maximum 4 items for quality

type TryOnMode = 'main' | 'camera' | 'processing' | 'results'

export default function TryOnPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { addGeneration, generations } = useAssetStore()
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Mode
  const [mode, setMode] = useState<TryOnMode>('main')
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])
  
  // Input states
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [clothingImages, setClothingImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  
  // Result states
  const [resultImages, setResultImages] = useState<string[]>([])
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  
  // Favorite hook
  const { toggleFavorite, isFavorited } = useFavorite(currentGenerationId)
  
  // Camera states
  const [cameraTarget, setCameraTarget] = useState<'person' | 'clothing'>('person')
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const webcamRef = useRef<Webcam>(null)
  
  // Gallery panel states
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [galleryTarget, setGalleryTarget] = useState<'person' | 'clothing'>('person')
  
  // Asset panel states (for selecting from user's product assets)
  const [showAssetPanel, setShowAssetPanel] = useState(false)
  
  // Clothing upload panel
  const [showClothingPanel, setShowClothingPanel] = useState(false)
  
  // File input refs
  const personFileInputRef = useRef<HTMLInputElement>(null)
  const clothingFileInputRef = useRef<HTMLInputElement>(null)
  
  // Quota management
  const { quota, checkQuota } = useQuota()
  const { reserveQuota, refundQuota, confirmQuota } = useQuotaReservation()
  
  // Check for image passed from gallery page
  useEffect(() => {
    const tryOnImage = sessionStorage.getItem('tryOnImage')
    if (tryOnImage) {
      setPersonImage(tryOnImage)
      sessionStorage.removeItem('tryOnImage')
    }
  }, [])
  
  // Handle single file upload (for person image)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'person' | 'clothing'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1200)
      
      if (target === 'person') {
        setPersonImage(compressed)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, compressed])
        }
      }
    } catch (error) {
      console.error('[TryOn] Failed to process file:', error)
    }
    
    e.target.value = ''
  }
  
  // Handle multiple file upload (for clothing images)
  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const remainingSlots = MAX_CLOTHING_IMAGES - clothingImages.length
    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    
    try {
      const newImages: string[] = []
      for (const file of filesToProcess) {
        const base64 = await fileToBase64(file)
        const compressed = await compressBase64Image(base64, 1200)
        newImages.push(compressed)
      }
      setClothingImages(prev => [...prev, ...newImages])
      setShowClothingPanel(false)
    } catch (error) {
      console.error('[TryOn] Failed to process files:', error)
    }
    
    e.target.value = ''
  }
  
  // Handle camera capture
  const handleCameraCapture = useCallback(async () => {
    if (!webcamRef.current) return
    
    const video = webcamRef.current.video
    const videoWidth = video?.videoWidth || 1920
    const videoHeight = video?.videoHeight || 1080
    
    const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
    if (!imageSrc) return
    
    try {
      const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, '')
      const compressed = await compressBase64Image(base64, 1200)
      
      if (cameraTarget === 'person') {
        setPersonImage(compressed)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, compressed])
        }
      }
      
      setMode('main')
      setCameraReady(false)
    } catch (error) {
      console.error('[TryOn] Failed to capture:', error)
    }
  }, [cameraTarget, clothingImages.length])
  
  // Handle gallery selection
  const handleGallerySelect = (imageUrl: string) => {
      if (galleryTarget === 'person') {
        setPersonImage(imageUrl)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, imageUrl])
        }
      }
      setShowGalleryPanel(false)
  }
  
  // Remove clothing image
  const removeClothingImage = (index: number) => {
    setClothingImages(prev => prev.filter((_, i) => i !== index))
  }
  
  // Start generation
  const handleGenerate = async () => {
    if (!personImage || clothingImages.length === 0) return

    // Clear previous results first (for Regenerate to show skeleton)
    setResultImages([])

    const hasQuota = await checkQuota(CREDIT_COST)
    if (!hasQuota) return
    
    const personImageUrl = personImage.startsWith('data:') ? personImage : 
      personImage.startsWith('http') ? personImage : `data:image/jpeg;base64,${personImage}`
    const taskId = addTask('try_on', personImageUrl, { customPrompt: prompt }, 2)
    initImageSlots(taskId, 2)
    setCurrentTaskId(taskId)
    
    setMode('processing')
    setResultImages([])
    
    // Reserve quota（使用统一 hook）
    await reserveQuota({ taskId, imageCount: 2, taskType: 'try_on' })
    
    // Run generation in background
    runBackgroundGeneration(taskId, personImageUrl)
  }
  
  const runBackgroundGeneration = async (taskId: string, inputImage: string) => {
    try {
      const clothingWithPrefix = clothingImages.map(img => 
        img.startsWith('data:') ? img : 
        img.startsWith('http') ? img : `data:image/jpeg;base64,${img}`
      )
      
      const response = await fetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImage: inputImage,
          clothingImages: clothingWithPrefix,
          prompt,
          generationId: taskId,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to start generation')
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')
      
      const decoder = new TextDecoder()
      let buffer = ''
      const images: string[] = []
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7)
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6))
              
              if (eventType === 'image') {
                images[data.index] = data.url
                setResultImages([...images])
                
                updateImageSlot(taskId, data.index, {
                  status: 'completed',
                  imageUrl: data.url,
                  modelType: 'pro',
                })
                
                triggerFlyToGallery(data.url)
              } else if (eventType === 'complete') {
                updateTaskStatus(taskId, 'completed')
                
                addGeneration({
                  id: taskId,
                  dbId: taskId,
                  type: 'try_on',
                  outputImageUrls: data.images,
                  createdAt: new Date().toISOString(),
                  inputImageUrl: inputImage,
                  params: {
                    productImages: clothingWithPrefix,
                    customPrompt: prompt,
                  },
                })
                
                if (modeRef.current === 'processing') {
                  setResultImages(data.images.filter((url: string) => !!url))
                  setMode('results')
                }
                confirmQuota()
              } else if (eventType === 'error') {
                throw new Error(data.message)
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[TryOn] Generation error:', error)
      updateTaskStatus(taskId, 'failed')
      
      // 退款（使用统一 hook）
      await refundQuota(taskId)
      
      if (modeRef.current === 'processing') {
        alert(error.message || 'Generation failed')
        setMode('main')
      }
    }
  }
  
  // Reset for new generation
  const handleReset = () => {
    setPersonImage(null)
    setClothingImages([])
    setPrompt('')
    setResultImages([])
    setCurrentTaskId(null)
    setMode('main')
  }
  
  const handleNewDuringProcessing = () => {
    setPersonImage(null)
    setClothingImages([])
    setPrompt('')
    setResultImages([])
    setMode('main')
  }
  
  const canGenerate = personImage && clothingImages.length > 0
  
  const videoConstraints = {
    facingMode: "environment",
    width: { min: 1080, ideal: 1920 },
    height: { min: 1080, ideal: 1920 },
  }
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="h-14 flex items-center px-4 bg-white border-b shrink-0">
        <button 
          onClick={() => router.push('/')}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
        >
          <Home className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <span className="font-semibold">{t.tryOn?.title || '虚拟换装'}</span>
        </div>
      </div>
      
      {/* Hidden file inputs */}
      <input 
        ref={personFileInputRef}
        type="file" 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => handleFileUpload(e, 'person')}
      />
      <input 
        ref={clothingFileInputRef}
        type="file" 
        className="hidden" 
        accept="image/*"
        multiple
        onChange={(e) => handleMultiFileUpload(e)}
      />
      
      <AnimatePresence mode="wait">
        {/* Main Mode */}
        {mode === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`flex-1 overflow-y-auto ${isDesktop ? 'bg-gradient-to-br from-zinc-50 via-white to-rose-50/30' : 'pb-40'}`}
          >
            {isDesktop ? (
              /* ========== PC Desktop Layout ========== */
              <div className="max-w-5xl mx-auto px-8 py-8">
                <div className="flex gap-8">
                  {/* Left Column: Person Image - Fixed width */}
                  <div className="w-[400px] shrink-0">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 h-full">
                      <h2 className="text-base font-semibold text-zinc-800 mb-1">{t.tryOn?.personImage || 'Person Photo'}</h2>
                      <p className="text-sm text-zinc-500 mb-4">{t.tryOn?.personImageDesc || 'Upload a full-body photo'}</p>
                      
                      {!personImage ? (
                        <div 
                          className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center hover:border-pink-300 hover:bg-pink-50/30 transition-all group cursor-pointer"
                          onClick={() => personFileInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-pink-400', 'bg-pink-50') }}
                          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50') }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50')
                            const file = e.dataTransfer.files?.[0]
                            if (file && file.type.startsWith('image/')) {
                              const base64 = await fileToBase64(file)
                              const compressed = await compressBase64Image(base64, 1200)
                              setPersonImage(compressed)
                            }
                          }}
                        >
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                            <Upload className="w-7 h-7 text-pink-500" />
                          </div>
                          <p className="text-zinc-600 font-medium text-sm mb-1">{t.common?.clickToUploadOrDrag || 'Click to upload'}</p>
                          <p className="text-zinc-400 text-xs">{t.tryOn?.personImageHint || 'JPG, PNG up to 10MB'}</p>
                        </div>
                      ) : (
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 group">
                          <Image 
                            src={personImage.startsWith('data:') ? personImage : 
                              personImage.startsWith('http') ? personImage : `data:image/jpeg;base64,${personImage}`}
                            alt="Person"
                            fill
                            className="object-contain bg-zinc-50"
                          />
                          <button
                            onClick={() => setPersonImage(null)}
                            className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/95 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t.common?.change || 'Change'}
                          </button>
                        </div>
                      )}
                      
                      {/* Upload buttons */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => personFileInputRef.current?.click()}
                          className="flex-1 h-10 rounded-lg bg-zinc-50 border border-zinc-200 hover:border-pink-400 hover:bg-pink-50 flex items-center justify-center gap-2 transition-all"
                        >
                          <Upload className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600">{t.tryOn?.fromAlbum || 'From Album'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setGalleryTarget('person')
                            setShowGalleryPanel(true)
                          }}
                          className="flex-1 h-10 rounded-lg bg-zinc-50 border border-zinc-200 hover:border-pink-400 hover:bg-pink-50 flex items-center justify-center gap-2 transition-all"
                        >
                          <FolderHeart className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600">{t.tryOn?.fromGallery || 'From Photos'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column: Clothing + Settings - Flexible */}
                  <div className="flex-1 min-w-0 flex flex-col gap-6">
                    {/* Clothing Images Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-semibold text-zinc-800">{t.tryOn?.clothingImages || 'Clothing Images'}</h3>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            {t.tryOn?.clothingImagesDesc || 'Upload clothing items to try on (up to 5)'}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full">
                          {clothingImages.length}/{MAX_CLOTHING_IMAGES}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-3">
                        {clothingImages.map((img, index) => (
                          <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 group">
                            <Image
                              src={img.startsWith('data:') ? img : 
                                img.startsWith('http') ? img : `data:image/jpeg;base64,${img}`}
                              alt={`Clothing ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            <button
                              onClick={() => removeClothingImage(index)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        
                        {clothingImages.length < MAX_CLOTHING_IMAGES && (
                          <div
                            onClick={() => clothingFileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-pink-400', 'bg-pink-50') }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50') }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50')
                              const file = e.dataTransfer.files?.[0]
                              if (file && file.type.startsWith('image/')) {
                                const base64 = await fileToBase64(file)
                                const compressed = await compressBase64Image(base64, 1200)
                                setClothingImages(prev => [...prev, compressed])
                              }
                            }}
                            className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 hover:border-pink-400 hover:bg-pink-50/50 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-5 h-5 text-zinc-400" />
                            <span className="text-[10px] text-zinc-400 font-medium">{t.tryOn?.addClothing || 'Add'}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">
                        {t.proStudio?.maxItemsWarning || 'Max 4 products. Too many may affect quality.'}
                      </p>
                      
                      {/* Upload buttons for clothing */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => clothingFileInputRef.current?.click()}
                          className="flex-1 h-10 rounded-lg bg-zinc-50 border border-zinc-200 hover:border-pink-400 hover:bg-pink-50 flex items-center justify-center gap-2 transition-all"
                        >
                          <Upload className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600">{t.tryOn?.fromAlbum || 'From Album'}</span>
                        </button>
                        <button
                          onClick={() => setShowAssetPanel(true)}
                          className="flex-1 h-10 rounded-lg bg-zinc-50 border border-zinc-200 hover:border-pink-400 hover:bg-pink-50 flex items-center justify-center gap-2 transition-all"
                        >
                          <FolderHeart className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600">{t.common?.fromAssets || 'From Assets'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Style Prompt Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                      <h3 className="text-base font-semibold text-zinc-800 mb-1">
                        {t.common?.style || 'Style'}
                        <span className="text-sm text-zinc-400 font-normal ml-2">({t.common?.custom || 'Custom'})</span>
                      </h3>
                      <p className="text-sm text-zinc-500 mb-3">{t.tryOn?.promptDesc || 'Describe the try-on effect you want'}</p>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t.tryOn?.promptPlaceholder || 'e.g., Natural lighting, casual street style...'}
                        className="w-full h-20 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 transition-all placeholder:text-zinc-400"
                      />
                    </div>
                    
                    {/* Generate Button */}
                    <button
                      onClick={(e) => {
                        triggerFlyToGallery(e)
                        handleGenerate()
                      }}
                      disabled={!canGenerate}
                      className={`w-full h-14 rounded-xl text-base font-semibold gap-3 flex items-center justify-center transition-all ${
                        !canGenerate
                          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
                          : "bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:via-rose-600 hover:to-purple-600 text-white shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40"
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>{t.tryOn?.generate || 'Start Try-On'}</span>
                      <CreditCostBadge cost={CREDIT_COST} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ========== Mobile Layout ========== */
              <>
            {/* Person Image Upload Area */}
                <div className="bg-zinc-100 flex items-center justify-center relative p-4 min-h-[200px]">
              {!personImage ? (
                    <div className="w-full space-y-2 max-w-sm">
                    <button
                      onClick={() => {
                        setCameraTarget('person')
                        setMode('camera')
                      }}
                      className="w-full h-14 rounded-xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-pink-200"
                    >
                      <Camera className="w-5 h-5" />
                        <span className="font-medium">{t.tryOn?.takePhoto || 'Take Photo'}</span>
                    </button>
                  
                      <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => personFileInputRef.current?.click()}
                          className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm text-zinc-700">{t.tryOn?.fromAlbum || 'Album'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setGalleryTarget('person')
                        setShowGalleryPanel(true)
                      }}
                          className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderHeart className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm text-zinc-700">{t.tryOn?.fromGallery || 'Photos'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full max-w-xs">
                  <Image 
                    src={personImage.startsWith('data:') ? personImage : 
                      personImage.startsWith('http') ? personImage : `data:image/jpeg;base64,${personImage}`}
                    alt="Person"
                    width={300}
                    height={400}
                    className="w-full rounded-xl shadow-lg object-contain bg-white"
                  />
                  <button
                    onClick={() => setPersonImage(null)}
                    className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
                  >
                        {t.common?.change || 'Change'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Settings Panel */}
            <div className="p-4 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10 space-y-5">
              {/* Clothing Images */}
              <div>
                    <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.tryOn?.clothingImages || 'Clothing Images'}</h3>
                <p className="text-xs text-zinc-400 mb-3">
                      {t.tryOn?.clothingImagesDesc || 'Upload clothing to try on (up to 5)'}
                </p>
                
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {clothingImages.map((img, index) => (
                    <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border-2 border-zinc-200">
                      <Image
                        src={img.startsWith('data:') ? img : 
                          img.startsWith('http') ? img : `data:image/jpeg;base64,${img}`}
                        alt={`Clothing ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => removeClothingImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {clothingImages.length < MAX_CLOTHING_IMAGES && (
                    <div
                      onClick={() => setShowClothingPanel(true)}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-pink-400', 'bg-pink-50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50') }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-pink-400', 'bg-pink-50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith('image/')) {
                          const base64 = await fileToBase64(file)
                          const compressed = await compressBase64Image(base64, 1200)
                          setClothingImages(prev => [...prev, compressed])
                        }
                      }}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 transition-colors flex flex-col items-center justify-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400">{t.tryOn?.addClothing || 'Add'}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  {t.proStudio?.maxItemsWarning || 'Max 4 products. Too many may affect quality.'}
                </p>
              </div>
              
              {/* Prompt Input */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">
                      {t.common?.style || 'Style'}
                      <span className="text-xs text-zinc-400 font-normal ml-2">({t.common?.custom || 'Optional'})</span>
                </h3>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                      placeholder={t.tryOn?.promptPlaceholder || 'Describe the try-on effect you want (optional)'}
                  className="w-full h-20 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 transition-colors"
                />
              </div>
            </div>
              </>
            )}
          </motion.div>
        )}
        
        {/* Generate Button for main mode - Mobile only (PC button is in the layout) */}
        {mode === 'main' && !isDesktop && (
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto z-40">
              <button
                onClick={(e) => {
                  triggerFlyToGallery(e)
                  handleGenerate()
                }}
                disabled={!canGenerate}
                className={`w-full h-14 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                  !canGenerate
                    ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg shadow-pink-200"
                }`}
              >
                <Sparkles className="w-5 h-5" />
              <span>{t.tryOn?.generate || 'Start Try-On'}</span>
                <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
              </button>
            </div>
        )}
        
        {/* Camera Mode */}
        {mode === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col bg-black relative"
          >
            {/* Back button - hidden on desktop */}
            {!isDesktop && (
              <button
                onClick={() => setMode('main')}
                className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            <div className={`flex-1 relative ${isDesktop ? 'bg-zinc-50' : ''}`}>
              {isDesktop ? (
                /* PC Desktop: Show upload interface */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                      <Camera className="w-12 h-12 text-zinc-400" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 mb-2">
                      {cameraTarget === 'person' ? (t.tryOn?.personImage || '上传人物照片') : (t.tryOn?.clothingImages || '上传服装')}
                    </h2>
                    <p className="text-zinc-500 mb-6">{t.tryOn?.uploadDesc || '选择图片开始虚拟试穿'}</p>
                    <button
                      onClick={() => {
                        setMode('main')
                        setTimeout(() => personFileInputRef.current?.click(), 100)
                      }}
                      className="px-6 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Upload className="w-5 h-5" />
                      {t.tryOn?.fromAlbum || '从相册选择'}
                    </button>
                  </div>
                </div>
              ) : hasCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={() => setHasCamera(false)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Camera not available</p>
                    <button
                      onClick={() => {
                        setMode('main')
                        setTimeout(() => personFileInputRef.current?.click(), 100)
                      }}
                      className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm"
                    >
                      {t.tryOn?.fromAlbum || '从相册选择'}
                    </button>
                  </div>
                </div>
              )}
              
              {!isDesktop && (
                <div className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
                  {cameraTarget === 'person' ? (t.tryOn?.personImage || '拍摄人物照片') : (t.tryOn?.clothingImages || '拍摄服装')}
                </div>
              )}
            </div>
            
            <div className={`py-8 pb-24 flex justify-center ${isDesktop ? 'bg-white border-t border-zinc-200' : 'bg-black'}`}>
              <button
                onClick={handleCameraCapture}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full border-4 border-pink-400/50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-16 h-16 bg-pink-400 rounded-full" />
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Processing Mode */}
        {mode === 'processing' && (
          <ProcessingView
            numImages={2}
            generatedImages={resultImages}
            themeColor="pink"
            gridCols={2}
            title={t.tryOn?.generating || 'Creating outfit change'}
            mobileStatusLines={[t.tryOn?.generatingDesc || 'Generating 2 outfit images']}
            onShootMore={handleNewDuringProcessing}
            onReturnHome={() => router.push('/')}
            shootMoreText={t.tryOn?.newGeneration || 'New Generation'}
            returnHomeText={t.studio?.returnHome || 'Return Home'}
            showBottomNav={false}
          />
        )}
        
        {/* Results Mode */}
        {mode === 'results' && (
          <ResultsView
            title={t.tryOn?.resultTitle || 'Try-On Complete'}
            onBack={() => setMode('main')}
            images={resultImages.filter((url): url is string => !!url).map((url) => ({
              url,
              status: 'completed' as const,
            }))}
            getBadge={() => ({
              text: t.tryOn?.badge || 'Try-On',
              className: 'bg-pink-500',
            })}
            themeColor="pink"
            onFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onDownload={async (url) => {
              try {
                const response = await fetch(url)
                const blob = await response.blob()
                const blobUrl = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = blobUrl
                link.download = `try-on-${Date.now()}.jpg`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(blobUrl)
              } catch (error) {
                console.error("Download failed:", error)
              }
            }}
            onShootNext={() => setMode('main')}
            onGoEdit={(url) => navigateToEdit(router, url)}
            onRegenerate={handleGenerate}
            onImageClick={(i) => setSelectedResultIndex(i)}
          >
            {/* Photo Detail Dialog */}
            <PhotoDetailDialog
              open={selectedResultIndex !== null && !!resultImages[selectedResultIndex!]}
              onClose={() => setSelectedResultIndex(null)}
              imageUrl={selectedResultIndex !== null ? resultImages[selectedResultIndex] || '' : ''}
              badges={[{ text: t.tryOn?.badge || 'Try-On', className: 'bg-pink-500 text-white' }]}
              onFavorite={() => selectedResultIndex !== null && toggleFavorite(selectedResultIndex)}
              isFavorited={selectedResultIndex !== null && isFavorited(selectedResultIndex)}
              onDownload={async () => {
                if (selectedResultIndex === null) return
                            const url = resultImages[selectedResultIndex]
                            try {
                              const response = await fetch(url)
                              const blob = await response.blob()
                              const blobUrl = URL.createObjectURL(blob)
                              const link = document.createElement("a")
                              link.href = blobUrl
                              link.download = `try-on-${Date.now()}.jpg`
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                              URL.revokeObjectURL(blobUrl)
                            } catch (error) {
                              console.error("Download failed:", error)
                            }
                          }}
              onFullscreen={() => {
                if (selectedResultIndex === null) return
                setFullscreenImage(resultImages[selectedResultIndex])
              }}
              quickActions={selectedResultIndex !== null ? [
                createQuickActions.tryOn(() => {
                              const imageUrl = resultImages[selectedResultIndex]
                              setPersonImage(imageUrl)
                              setClothingImages([])
                              setSelectedResultIndex(null)
                              setMode('main')
                }),
                createQuickActions.edit(() => {
                              const imageUrl = resultImages[selectedResultIndex]
                  navigateToEdit(router, imageUrl)
                }),
                createQuickActions.groupShoot(() => {
                            const imageUrl = resultImages[selectedResultIndex]
                            sessionStorage.setItem('groupShootImage', imageUrl)
                            setSelectedResultIndex(null)
                            router.push("/group-shot")
                }),
                createQuickActions.material(() => {
                            const imageUrl = resultImages[selectedResultIndex]
                  const inputImgs: string[] = []
                  if (clothingImages.length > 0) inputImgs.push(...clothingImages)
                  if (personImage) inputImgs.push(personImage)
                            sessionStorage.setItem('modifyMaterial_outputImage', imageUrl)
                  sessionStorage.setItem('modifyMaterial_inputImages', JSON.stringify(inputImgs))
                            setSelectedResultIndex(null)
                            router.push("/gallery/modify-material")
                }),
              ] : []}
              inputImages={[
                ...(personImage ? [{ url: personImage, label: t.tryOn?.personImage || 'Person' }] : []),
                ...clothingImages.map((url, i) => ({ url, label: `${t.tryOn?.clothingImages || 'Clothing'} ${i + 1}` }))
              ]}
              onInputImageClick={(url) => setFullscreenImage(url)}
            />
            
            {/* Fullscreen Image Viewer */}
            <FullscreenImageViewer
              open={!!fullscreenImage}
              onClose={() => setFullscreenImage(null)}
              imageUrl={fullscreenImage || ''}
            />
          </ResultsView>
        )}
      </AnimatePresence>
      
      {/* Clothing Upload Panel */}
      <AnimatePresence>
        {showClothingPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowClothingPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <span className="font-semibold">{t.tryOn?.addClothing || '添加服装'}</span>
                <button
                  onClick={() => setShowClothingPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 pb-24 space-y-3">
                {/* Camera */}
                <button
                  onClick={() => {
                    setShowClothingPanel(false)
                    setCameraTarget('clothing')
                    setMode('camera')
                  }}
                  className="w-full h-14 rounded-xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center gap-3 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="font-medium">{t.tryOn?.takePhoto || '拍摄服装'}</span>
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Album - multiple */}
                  <button
                    onClick={() => clothingFileInputRef.current?.click()}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-700">{t.tryOn?.fromAlbum || '相册'}</span>
                  </button>
                  
                  {/* Assets */}
                  <button
                    onClick={() => {
                      setShowClothingPanel(false)
                      setShowAssetPanel(true)
                    }}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    <FolderHeart className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-700">{t.common?.fromAssets || '素材库'}</span>
                  </button>
                </div>
                
                <p className="text-xs text-zinc-400 text-center pt-2">
                  {(t.tryOn?.clothingRemaining || 'Can add {count} more')
                    .replace('{count}', String(MAX_CLOTHING_IMAGES - clothingImages.length))}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Gallery Selection Panel - Using shared component */}
      <GalleryPickerPanel
        open={showGalleryPanel}
        onClose={() => setShowGalleryPanel(false)}
        onSelect={handleGallerySelect}
        title={galleryTarget === 'person' ? (t.tryOn?.personImage || 'Select Person Photo') : (t.tryOn?.clothingImages || 'Select Clothing')}
        themeColor="purple"
      />

      {/* Asset Picker Panel - For selecting from user's product assets */}
      <AssetPickerPanel
        open={showAssetPanel}
        onClose={() => setShowAssetPanel(false)}
        onSelect={(imageUrl) => {
          if (clothingImages.length < MAX_CLOTHING_IMAGES) {
            setClothingImages(prev => [...prev, imageUrl])
          }
          setShowAssetPanel(false)
        }}
        title={t.common?.fromAssets || 'Select from Assets'}
        themeColor="purple"
      />

    </div>
  )
}
