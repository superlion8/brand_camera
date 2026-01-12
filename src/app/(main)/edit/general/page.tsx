"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Wand2, X, Loader2, Home, ArrowLeft, Camera, FolderHeart, Upload, Images, Trash2 } from "lucide-react"
import { fileToBase64, compressBase64Image, fetchWithTimeout, generateId, ensureBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { PRESET_PRODUCTS } from "@/data/presets"
import Webcam from "react-webcam"
import { motion, AnimatePresence } from "framer-motion"
import { useQuota } from "@/hooks/useQuota"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"
import { TASK_CREDIT_COSTS, TaskTypes } from "@/lib/taskTypes"

const CREDIT_COST = TASK_CREDIT_COSTS[TaskTypes.EDIT]

// Helper to map API error codes to translated messages
const getErrorMessage = (error: string, t: any): string => {
  if (error === 'RESOURCE_BUSY') {
    return t.errors?.resourceBusy || '资源紧张，请稍后重试'
  }
  return error
}

export default function GeneralEditPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const webcamRef = useRef<Webcam>(null)
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Multi-image support: array of up to 5 images
  const MAX_IMAGES = 5
  const [inputImages, setInputImages] = useState<(string | null)[]>([])
  const [activeImageSlot, setActiveImageSlot] = useState<number>(0) // Which slot is being filled
  
  // Ref to track generating state for async callbacks
  const [isGenerating, setIsGenerating] = useState(false)
  const isGeneratingRef = useRef(isGenerating)
  useEffect(() => { isGeneratingRef.current = isGenerating }, [isGenerating])
  
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  
  // Camera and upload states
  const [showCamera, setShowCamera] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)
  
  // Gallery panel data (fetched from API, not store)
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  
  // Check for image passed from gallery page
  useEffect(() => {
    const editImage = sessionStorage.getItem('editImage')
    if (editImage) {
      setInputImages([editImage])
      sessionStorage.removeItem('editImage') // Clean up
    }
  }, [])
  
  // Fetch gallery photos when panel opens
  useEffect(() => {
    if (showGalleryPanel && user) {
      const fetchGalleryPhotos = async () => {
        setIsLoadingGallery(true)
        try {
          const response = await fetch('/api/gallery?type=all&page=1')
          const result = await response.json()
          if (result.success && result.data?.items) {
            setGalleryPhotos(result.data.items)
            console.log('[GeneralEdit] Fetched gallery photos:', result.data.items.length)
          }
        } catch (error) {
          console.error('[GeneralEdit] Failed to fetch gallery:', error)
        } finally {
          setIsLoadingGallery(false)
        }
      }
      fetchGalleryPhotos()
    }
  }, [showGalleryPanel, user])
  
  // Edit state - only prompt for general edit
  const [customPrompt, setCustomPrompt] = useState("")
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  const { addGeneration, userProducts } = useAssetStore()
  const { addTask, updateTaskStatus } = useGenerationTaskStore()
  
  // Quota management
  const { quota, checkQuota, refreshQuota } = useQuota()
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      // 获取视频的实际分辨率，保持正确的宽高比
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        // Add to current active slot or append if slot is full
        setInputImages(prev => {
          const newImages = [...prev]
          if (activeImageSlot < prev.length) {
            newImages[activeImageSlot] = imageSrc
          } else if (prev.length < MAX_IMAGES) {
            newImages.push(imageSrc)
          }
          return newImages
        })
        setShowCamera(false)
        setResultImage(null)
      }
    }
  }, [activeImageSlot])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
  }, [])
  
  const handleSelectFromAsset = useCallback((imageUrl: string) => {
    // 直接使用 URL，后端会转换为 base64
    setInputImages(prev => {
      const newImages = [...prev]
      if (activeImageSlot < prev.length) {
        newImages[activeImageSlot] = imageUrl
      } else if (prev.length < MAX_IMAGES) {
        newImages.push(imageUrl)
      }
      return newImages
    })
    setShowProductPanel(false)
    setResultImage(null)
  }, [activeImageSlot])
  
  const handleSelectFromGallery = useCallback((imageUrl: string) => {
    // 直接使用 URL，后端会转换为 base64
    setInputImages(prev => {
      const newImages = [...prev]
      if (activeImageSlot < prev.length) {
        newImages[activeImageSlot] = imageUrl
      } else if (prev.length < MAX_IMAGES) {
        newImages.push(imageUrl)
      }
      return newImages
    })
    setShowGalleryPanel(false)
    setResultImage(null)
  }, [activeImageSlot])
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setInputImages(prev => {
        const newImages = [...prev]
        if (activeImageSlot < prev.length) {
          newImages[activeImageSlot] = base64
        } else if (prev.length < MAX_IMAGES) {
          newImages.push(base64)
        }
        return newImages
      })
      setResultImage(null)
    }
    // Reset file input
    if (e.target) e.target.value = ''
  }
  
  // Remove image from a specific slot
  const handleRemoveImage = (index: number) => {
    setInputImages(prev => prev.filter((_, i) => i !== index))
    setResultImage(null)
  }
  
  // Add image - open selection for new slot
  const handleAddImage = () => {
    setActiveImageSlot(inputImages.length)
  }
  
  const handleGenerate = async () => {
    const validImages = inputImages.filter((img): img is string => img !== null)
    if (validImages.length === 0 || !customPrompt.trim()) return
    
    // Check quota before starting generation
    const hasQuota = await checkQuota(CREDIT_COST)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Capture current state before async operations
    const currentInputImages = validImages
    const currentCustomPrompt = customPrompt
    
    // Create task (edit generates 1 image)
    const taskId = addTask('edit', currentInputImages[0], { customPrompt: currentCustomPrompt, inputImageCount: currentInputImages.length }, 1)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    setIsGenerating(true)
    
    // IMMEDIATELY reserve quota - deduct before generation starts
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: 1,
          taskType: 'edit',
        }),
      })
      console.log('[Quota] Reserved 1 image for task', taskId)
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve quota:', e)
    }
    
    // Run generation in background
    runEditGeneration(taskId, currentInputImages, currentCustomPrompt)
  }
  
  // Background edit generation - simplified for general edit
  const runEditGeneration = async (
    taskId: string,
    inputImgs: string[],
    prompt: string
  ) => {
    try {
      console.log(`Sending general edit request with ${inputImgs.length} images...`)
      
      // 压缩图片以避免 HTTP 413 错误
      const compressedImages = await Promise.all(
        inputImgs.map(async (img) => {
          try {
            const compressed = await compressBase64Image(img, 1024)
            console.log(`[Edit] Compressed image: ${(img.length / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB`)
            return compressed
          } catch (e) {
            console.warn('[Edit] Compression failed, using original:', e)
            return img
          }
        })
      )
      
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImages: compressedImages, // 传递压缩后的图片数组
          customPrompt: prompt,
          taskId, // 传递 taskId，让后端直接写入数据库
          // No model/background/vibe for general edit
        }),
      }, 180000) // 增加超时时间，因为后端现在会上传图片
      
      // 处理非 JSON 响应（如 413 错误）
      const responseText = await response.text()
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('[Edit] Non-JSON response:', responseText.substring(0, 200))
        if (response.status === 413 || responseText.includes('Request Entity Too Large')) {
          throw new Error('图片太大，请使用较小的图片')
        }
        throw new Error(`服务器错误: ${response.status}`)
      }
      
      if (data.success && data.image) {
        updateTaskStatus(taskId, 'completed', [data.image])
        
        // 后端已写入数据库时，跳过前端的云端同步
        const skipCloudSync = !!data.savedToDb
        console.log(`Edit completed, savedToDb: ${data.savedToDb}`)
        
        await addGeneration({
          id: taskId,
          type: "edit",
          inputImageUrl: inputImgs[0], // 使用第一张作为预览
          outputImageUrls: [data.image],
          prompt: prompt,
          createdAt: new Date().toISOString(),
          params: {
            customPrompt: prompt,
            inputImageCount: inputImgs.length,
          },
        }, skipCloudSync)
        
        // Refresh quota after successful generation
        await refreshQuota()
        
        if (isGeneratingRef.current) {
          setResultImage(data.image)
          setIsGenerating(false)
        }
      } else {
        // Edit failed - full refund
        console.log('[Quota] Edit failed, refunding')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
          await refreshQuota()
        } catch (e) {
          console.warn('[Quota] Failed to refund:', e)
        }
        const errorMsg = getErrorMessage(data.error || "编辑失败", t)
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error("Edit error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || '编辑失败')
      
      // Refund quota on error (in case not already refunded)
      console.log('[Quota] Error occurred, refunding reserved quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        await refreshQuota()
      } catch (e) {
        console.warn('[Quota] Failed to refund on error:', e)
      }
      
      if (isGeneratingRef.current) {
        if (error.name === 'AbortError') {
          alert(t.edit?.editTimeout || "Edit timed out. Please retry with a smaller image.")
        } else {
          const errorMsg = getErrorMessage(error.message, t) || t.errors?.generateFailed || "编辑失败，请重试"
          alert(errorMsg)
        }
        setIsGenerating(false)
      }
    }
  }
  
  // Navigation handlers during processing
  const handleNewEditDuringProcessing = () => {
    setIsGenerating(false)
    setInputImages([])
    setResultImage(null)
    setCustomPrompt("")
    setActiveImageSlot(0)
  }
  
  const handleReturnHomeDuringProcessing = () => {
    setIsGenerating(false)
    router.push('/')
  }
  
  const handleReset = () => {
    setInputImages([])
    setResultImage(null)
    setCustomPrompt("")
    setActiveImageSlot(0)
  }
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header - Mobile only */}
      {!isDesktop && (
        <div className="h-14 border-b bg-white flex items-center px-4 shrink-0">
          <button
            onClick={() => router.push("/edit")}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900">{t.edit?.generalEdit || 'General Edit'}</span>
          </div>
        </div>
      )}
      
      {/* PC Web: Two-column layout */}
      {isDesktop ? (
        <div className="flex-1 overflow-y-auto py-8">
          <div className="max-w-5xl mx-auto px-8">
            <div className="flex gap-8">
              {/* Left Column: Image Upload */}
              <div className="w-[400px] shrink-0">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    {t.edit?.selectImage || 'Select Image'}
                  </h3>
                  
                  {inputImages.length === 0 ? (
                    <div className="space-y-3">
                      {/* Upload options */}
                      <button
                        onClick={() => {
                          setActiveImageSlot(0)
                          fileInputRef.current?.click()
                        }}
                        className="w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl bg-zinc-50 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center justify-center gap-2 transition-colors"
                      >
                        <Upload className="w-8 h-8 text-zinc-400" />
                        <span className="text-sm text-zinc-600 font-medium">{t.edit?.uploadFromAlbum || 'Upload from Album'}</span>
                        <span className="text-xs text-zinc-400">{t.edit?.clickOrDrag || 'Click or drag image'}</span>
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setActiveImageSlot(0)
                            setShowProductPanel(true)
                          }}
                          className="h-12 rounded-xl border border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <FolderHeart className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-zinc-700">{t.edit?.fromAssets || 'From Assets'}</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setActiveImageSlot(0)
                            setShowGalleryPanel(true)
                          }}
                          className="h-12 rounded-xl border border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Images className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-zinc-700">{t.edit?.fromPhotos || 'From Photos'}</span>
                        </button>
                      </div>
                    </div>
                  ) : resultImage ? (
                    <div className="relative group">
                      <Image 
                        src={resultImage} 
                        alt="Result"
                        width={400}
                        height={500}
                        className="w-full rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setZoomImage(resultImage)}
                      />
                      <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">{t.edit?.generationResult || 'Result'}</span>
                      <button
                        onClick={handleReset}
                        className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
                      >
                        {t.edit?.reselect || 'Reselect'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600">
                          {inputImages.filter(Boolean).length}/{MAX_IMAGES} {t.edit?.imagesSelected || 'images'}
                        </span>
                        <button onClick={handleReset} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                          {t.edit?.clearAll || 'Clear all'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {inputImages.map((img, index) => {
                          if (!img || typeof img !== 'string') return null
                          return (
                            <div key={index} className="relative aspect-square group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Image ${index + 1}`} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                              <div className="absolute top-1 left-1 w-5 h-5 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {index + 1}
                              </div>
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                        
                        {inputImages.filter(Boolean).length < MAX_IMAGES && (
                          <button
                            onClick={() => {
                              setActiveImageSlot(inputImages.length)
                              fileInputRef.current?.click()
                            }}
                            className="aspect-square border-2 border-dashed border-zinc-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
                          >
                            <Upload className="w-4 h-4 text-zinc-400" />
                            <span className="text-[10px] text-zinc-400">+{t.edit?.add || 'Add'}</span>
                          </button>
                        )}
                      </div>
                      
                      <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                        <p className="text-xs text-purple-700">
                          💡 {t.edit?.referenceHint || 'Use "Image 1", "Image 2" to reference images in prompt'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column: Prompt & Generate */}
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                  <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                    {t.edit?.describeEdit || 'Describe your edits'}
                  </h3>
                  
                  <textarea
                    placeholder={t.edit?.editPlaceholder || 'e.g.: Change pants to blue jeans, remove people in background...'}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full min-h-[200px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-300 text-sm leading-relaxed"
                  />
                  
                  <p className="text-xs text-zinc-400 mt-2 mb-6">
                    💡 {t.edit?.editPlaceholder || 'e.g.: Change pants to blue jeans, remove people in background...'}
                  </p>
                  
                  <button
                    onClick={(e) => {
                      triggerFlyToGallery(e)
                      handleGenerate()
                    }}
                    disabled={inputImages.filter(Boolean).length === 0 || !customPrompt.trim() || isGenerating}
                    className={`w-full h-12 rounded-xl text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                      inputImages.filter(Boolean).length === 0 || !customPrompt.trim() || isGenerating
                        ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-purple-200"
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.common?.generating || 'Generating...'}</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        <span>{t.edit?.startGenerate || 'Start Generate'}</span>
                        <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mobile: Original layout */
        <div className="flex-1 overflow-y-auto pb-24">
          {/* Image Area */}
          <div className="bg-zinc-100 min-h-[280px] flex items-center justify-center relative p-4">
            {inputImages.length === 0 ? (
              <div className="w-full max-w-sm space-y-2">
                {/* Camera */}
                <button
                  onClick={() => {
                    setActiveImageSlot(0)
                    setShowCamera(true)
                  }}
                  className="w-full h-16 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-purple-200"
                >
                  <Camera className="w-5 h-5" />
                  <span className="font-medium">{t.edit?.takePhoto || 'Take Photo'}</span>
                </button>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* Album */}
                  <button
                    onClick={() => {
                      setActiveImageSlot(0)
                      fileInputRef.current?.click()
                    }}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-700">{t.camera?.album || 'Album'}</span>
                  </button>
                  
                  {/* Asset library */}
                  <button
                    onClick={() => {
                      setActiveImageSlot(0)
                      setShowProductPanel(true)
                    }}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderHeart className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-700">{t.edit?.selectFromAssets || 'Assets'}</span>
                  </button>
                  
                  {/* Gallery */}
                  <button
                    onClick={() => {
                      setActiveImageSlot(0)
                      setShowGalleryPanel(true)
                    }}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Images className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-700">{t.edit?.selectFromGallery || 'Photos'}</span>
                  </button>
                </div>
              </div>
            ) : resultImage ? (
            // Show result image when generation is complete
            <div className="relative w-full max-w-xs group">
              {/* 点击放大 */}
              <button
                onClick={() => setZoomImage(resultImage)}
                className="w-full"
              >
              <Image 
                src={resultImage} 
                alt="Result"
                width={400}
                height={500}
                  className="w-full rounded-xl shadow-lg cursor-pointer hover:opacity-95 transition-opacity"
              />
              </button>
              <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">{t.edit.generationResult}</span>
              {/* 点击提示 */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl pointer-events-none">
                <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-full">
                  点击放大
                </span>
              </div>
              <button
                onClick={handleReset}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors z-10"
              >
                重选
              </button>
            </div>
          ) : (
            // Show multi-image grid with numbered labels
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-600 font-medium">
                  已选择 {inputImages.filter(Boolean).length} 张图片（最多 {MAX_IMAGES} 张）
                </span>
                <button
                  onClick={handleReset}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  清空全部
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Render existing images with labels */}
                {inputImages.map((img, index) => {
                  // 确保 img 是有效的字符串
                  if (!img || typeof img !== 'string') return null
                  return (
                    <div key={index} className="relative aspect-square group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={img} 
                        alt={`图${index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover rounded-xl shadow-md"
                      />
                      {/* Image number label - prominent for reference in prompts */}
                      <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                        {index + 1}
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded font-medium backdrop-blur-sm">
                        图{index + 1}
                      </span>
                      {/* Delete button */}
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
                
                {/* Add more button - if less than MAX_IMAGES */}
                {inputImages.filter(Boolean).length < MAX_IMAGES && (
                  <div className="aspect-square">
                    <div className="w-full h-full border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setActiveImageSlot(inputImages.length)
                            fileInputRef.current?.click()
                          }}
                          className="w-8 h-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center transition-colors"
                          title={t.edit?.fromAlbum || "Upload from Album"}
                        >
                          <Upload className="w-4 h-4 text-zinc-500" />
                        </button>
                        <button
                          onClick={() => {
                            setActiveImageSlot(inputImages.length)
                            setShowCamera(true)
                          }}
                          className="w-8 h-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center transition-colors"
                          title={t.edit?.takePhotoTitle || "Take Photo"}
                        >
                          <Camera className="w-4 h-4 text-zinc-500" />
                        </button>
                        <button
                          onClick={() => {
                            setActiveImageSlot(inputImages.length)
                            setShowProductPanel(true)
                          }}
                          className="w-8 h-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center transition-colors"
                          title={t.edit?.fromAssets || "From Assets"}
                        >
                          <FolderHeart className="w-4 h-4 text-zinc-500" />
                        </button>
                      </div>
                      <span className="text-[10px] text-zinc-400">{t.edit?.addImage || 'Add Image'} {inputImages.length + 1}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hint about referencing images */}
              <div className="mt-3 p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-purple-700">
                  💡 在描述中使用&ldquo;图1&rdquo;、&ldquo;图2&rdquo;等来引用对应的图片
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Prompt Input - Main control */}
        <div className="p-4 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              <label className="text-base font-semibold text-zinc-900">{t.edit.describeEdit}</label>
            </div>
            <textarea
              placeholder={t.edit.editPlaceholder}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full min-h-[120px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-300 text-sm leading-relaxed"
            />
            <p className="text-xs text-zinc-400">
              💡 {t.edit.editPlaceholder}
            </p>
          </div>
          
          {/* Generate Button */}
          <div className="pt-6 pb-24">
            <button
              onClick={(e) => {
                triggerFlyToGallery(e)
                handleGenerate()
              }}
              disabled={inputImages.filter(Boolean).length === 0 || !customPrompt.trim() || isGenerating}
              className={`w-full h-14 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                inputImages.filter(Boolean).length === 0 || !customPrompt.trim() || isGenerating
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-purple-200"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.common.generating}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>{t.edit.startGenerate}</span>
                  <CreditCostBadge cost={CREDIT_COST} className="ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      )}
      
      {/* File input - shared between PC and Mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      
      {/* Loading overlay - PC uses skeleton, Mobile uses spinner */}
      {isGenerating && !isDesktop && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
          </div>
          <h3 className="text-white text-xl font-bold mb-2">{t.edit?.processing || 'AI 正在处理...'}</h3>
          <p className="text-zinc-400 text-sm mb-8">{t.edit?.processingDesc || '根据您的描述修改图片'}</p>
          
          {/* Navigation buttons during processing */}
          <div className="space-y-3 w-full max-w-xs">
            <p className="text-zinc-500 text-xs mb-4">{t.camera.continueInBackground}</p>
            <button
              onClick={handleNewEditDuringProcessing}
              className="w-full h-12 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Wand2 className="w-5 h-5" />
              {t.edit?.editNew || '修新的图'}
            </button>
            <button
              onClick={handleReturnHomeDuringProcessing}
              className="w-full h-12 rounded-full bg-white/10 text-white/90 border border-white/20 font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <Home className="w-5 h-5" />
              {t.camera.returnHome}
            </button>
          </div>
        </div>
      )}
      
      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Back button - hidden on desktop */}
            {!isDesktop && (
            <button
              onClick={() => setShowCamera(false)}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            )}
            
            {/* Camera view / Upload interface */}
            <div className={`flex-1 relative ${isDesktop ? 'bg-zinc-50' : ''}`}>
              {isDesktop ? (
                /* PC Desktop: Show upload interface */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                      <Wand2 className="w-12 h-12 text-zinc-400" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 mb-2">{t.edit?.uploadImage || '上传图片'}</h2>
                    <p className="text-zinc-500 mb-6">{t.edit?.uploadImageDesc || '选择需要修图的图片'}</p>
                    <button
                      onClick={() => {
                        setShowCamera(false)
                        setTimeout(() => fileInputRef.current?.click(), 100)
                      }}
                      className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Upload className="w-5 h-5" />
                      {t.edit?.selectFromAlbum || '从相册选择'}
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
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">{t.edit?.cameraUnavailable || 'Camera unavailable'}</p>
                    <button
                      onClick={() => {
                        setShowCamera(false)
                        setTimeout(() => fileInputRef.current?.click(), 100)
                      }}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm"
                    >
                      {t.edit.selectFromAlbum}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Grid overlay - hidden on desktop */}
              {!isDesktop && (
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
              )}
              
              {/* Focus frame - hidden on desktop */}
              {!isDesktop && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-purple-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-purple-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-purple-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-purple-400" />
                </div>
              </div>
              )}
            </div>
            
            {/* Capture button - positioned above BottomNav, hidden on desktop */}
            <div className={`py-8 pb-24 flex justify-center ${isDesktop ? 'bg-white border-t border-zinc-200' : 'bg-black'}`}>
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full border-4 border-purple-400/50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-full bg-purple-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Product Selection Panel */}
      <AnimatePresence>
        {showProductPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowProductPanel(false)}
            />
            <motion.div
              initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
              animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={isDesktop 
                ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
                : "fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
              }
            >
              <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <span className="font-semibold text-lg">{t.camera?.selectProduct || 'Select Product'}</span>
                <button
                  onClick={() => setShowProductPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Source Tabs */}
              <div className="px-6 py-3 border-b bg-white">
                <div className="flex bg-zinc-100 rounded-lg p-1">
                  <button
                    onClick={() => setProductSourceTab("preset")}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      productSourceTab === "preset"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.camera?.officialExamples || 'Official Examples'} ({PRESET_PRODUCTS.length})
                  </button>
                  <button
                    onClick={() => setProductSourceTab("user")}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      productSourceTab === "user"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t.camera?.myProducts || 'My Products'} ({userProducts.length})
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {/* Loading overlay */}
                {isLoadingAsset && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                )}
                {productSourceTab === 'preset' ? (
                  <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <span className="absolute top-1.5 left-1.5 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {t.common?.official || 'Official'}
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                          <p className="text-xs text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    {userProducts.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                          <p className="text-xs text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
                    <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.camera?.noMyProducts || 'No products yet'}</p>
                    <p className="text-xs mt-1">{t.camera?.uploadInAssets || 'Upload in Assets'}</p>
                    <button
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600"
                    >
                      {t.camera?.goUpload || 'Go Upload'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Gallery Selection Panel */}
      <AnimatePresence>
        {showGalleryPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowGalleryPanel(false)}
            />
            <motion.div
              initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
              animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={isDesktop 
                ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
                : "fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
              }
            >
              <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
                <span className="font-semibold text-lg">{t.edit?.selectFromGallery || 'Select from Photos'}</span>
                <button
                  onClick={() => setShowGalleryPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {/* Loading overlay */}
                {isLoadingGallery && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                )}
                {!isLoadingGallery && galleryPhotos.length > 0 ? (
                  <div className={`grid gap-3 ${isDesktop ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    {galleryPhotos.filter(item => item?.imageUrl).map((item, index) => (
                      <button
                        key={item.id || `gallery-${index}`}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromGallery(item.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={item.imageUrl} alt={`${t.edit?.generationResult || 'Result'} ${index + 1}`} fill className="object-cover" />
                        <span className={`absolute top-1.5 left-1.5 text-white text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          item.generation?.type === 'studio' ? 'bg-amber-500' :
                          item.generation?.type === 'edit' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}>
                          {item.generation?.type === 'studio' ? (t.studio?.title || 'Studio') :
                           item.generation?.type === 'edit' ? (t.nav?.edit || 'Edit') : (t.common?.model || 'Model')}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : !isLoadingGallery ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
                    <Images className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.edit?.noGallery || 'No photos yet'}</p>
                    <p className="text-xs mt-1">{t.studio?.goShootToGenerate || 'Generate some photos first'}</p>
                    <button
                      onClick={() => {
                        setShowGalleryPanel(false)
                        router.push("/buyer-show")
                      }}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600"
                    >
                      {t.edit?.goShoot || 'Go Shoot'}
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      
      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setZoomImage(null)}
          >
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-lg aspect-[3/4] mx-4"
              onClick={e => e.stopPropagation()}
            >
              <Image
                src={zoomImage}
                alt={t.edit?.generationResult || '生成结果'}
                fill
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

