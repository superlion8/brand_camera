"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Wand2, X, Loader2, Home, ArrowLeft, Camera, FolderHeart, Upload, Images, Trash2, Sparkles, RefreshCw, Pencil, Heart, Download } from "lucide-react"
import { fileToBase64, compressBase64Image, fetchWithTimeout, generateId, ensureBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { AssetPickerPanel } from "@/components/shared/AssetPickerPanel"
import { GalleryPickerPanel } from "@/components/shared/GalleryPickerPanel"
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

const BASE_CREDIT_COST = TASK_CREDIT_COSTS[TaskTypes.EDIT]

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
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Generation options
  const [numImages, setNumImages] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'>('1:1')
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K')
  
  // Result images for PC layout
  const [resultImages, setResultImages] = useState<string[]>([])
  // Track which result image is regenerating
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  
  // Check for image passed from gallery page
  useEffect(() => {
    const editImage = sessionStorage.getItem('editImage')
    if (editImage) {
      setInputImages([editImage])
      sessionStorage.removeItem('editImage') // Clean up
    }
  }, [])
  
  // Edit state - only prompt for general edit
  const [customPrompt, setCustomPrompt] = useState("")
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  const { addGeneration } = useAssetStore()
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
  
  // Shared handler for selecting image from asset or gallery
  const handleSelectImage = useCallback((imageUrl: string) => {
    setInputImages(prev => {
      const newImages = [...prev]
      if (activeImageSlot < prev.length) {
        newImages[activeImageSlot] = imageUrl
      } else if (prev.length < MAX_IMAGES) {
        newImages.push(imageUrl)
      }
      return newImages
    })
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
  
  // Calculate dynamic credit cost based on numImages and resolution
  // 4K costs 2x normal price
  const perImageCost = resolution === '4K' ? BASE_CREDIT_COST * 2 : BASE_CREDIT_COST
  const totalCreditCost = perImageCost * numImages
  
  const handleGenerate = async () => {
    const validImages = inputImages.filter((img): img is string => img !== null)
    if (validImages.length === 0 || !customPrompt.trim()) return
    
    // Check quota before starting generation
    const hasQuota = await checkQuota(totalCreditCost)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Capture current state before async operations
    const currentInputImages = validImages
    const currentCustomPrompt = customPrompt
    const currentNumImages = numImages
    const currentAspectRatio = aspectRatio
    const currentResolution = resolution
    
    // Create task
    const taskId = addTask('edit', currentInputImages[0], { 
      customPrompt: currentCustomPrompt, 
      inputImageCount: currentInputImages.length,
      numImages: currentNumImages,
      aspectRatio: currentAspectRatio,
      resolution: currentResolution,
    }, currentNumImages)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    setIsGenerating(true)
    setResultImages([]) // Clear previous results
    
    // IMMEDIATELY reserve quota - deduct before generation starts
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: currentNumImages,
          taskType: 'edit',
        }),
      })
      console.log('[Quota] Reserved', currentNumImages, 'images for task', taskId)
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve quota:', e)
    }
    
    // Run generation in background
    runEditGeneration(taskId, currentInputImages, currentCustomPrompt, currentNumImages, currentAspectRatio, currentResolution)
  }
  
  // Background edit generation - supports multiple image generation
  const runEditGeneration = async (
    taskId: string,
    inputImgs: string[],
    prompt: string,
    count: number = 1,
    ratio: string = '1:1',
    res: string = '1K'
  ) => {
    try {
      console.log(`Sending general edit request with ${inputImgs.length} input images, generating ${count} outputs...`)
      
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
      
      // Generate multiple images in parallel
      const generatedImages: string[] = []
      const generateSingle = async (index: number): Promise<string | null> => {
        try {
          const response = await fetchWithTimeout("/api/edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inputImages: compressedImages,
              customPrompt: prompt,
              taskId: count === 1 ? taskId : `${taskId}-${index}`,
              aspectRatio: ratio,
              resolution: res,
            }),
          }, 180000)
          
          const responseText = await response.text()
          let data: any
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            console.error(`[Edit ${index}] Non-JSON response:`, responseText.substring(0, 200))
            if (response.status === 413 || responseText.includes('Request Entity Too Large')) {
              throw new Error('Image too large')
            }
            throw new Error(`Server error: ${response.status}`)
          }
          
          if (data.success && data.image) {
            console.log(`[Edit ${index}] Success`)
            return data.image
          }
          console.error(`[Edit ${index}] Failed:`, data.error)
          return null
        } catch (err: any) {
          console.error(`[Edit ${index}] Error:`, err.message)
          return null
        }
      }
      
      // Run in parallel
      const results = await Promise.all(
        Array.from({ length: count }, (_, i) => generateSingle(i))
      )
      
      // Filter successful results
      const successfulImages = results.filter((img): img is string => img !== null)
      
      if (successfulImages.length > 0) {
        updateTaskStatus(taskId, 'completed', successfulImages)
        
        await addGeneration({
          id: taskId,
          type: "edit",
          inputImageUrl: inputImgs[0],
          outputImageUrls: successfulImages,
          prompt: prompt,
          createdAt: new Date().toISOString(),
          params: {
            customPrompt: prompt,
            inputImageCount: inputImgs.length,
            numImages: count,
            aspectRatio: ratio,
            resolution: res,
          },
        }, true) // Skip cloud sync since backend saves
        
        await refreshQuota()
        
        if (isGeneratingRef.current) {
          setResultImages(successfulImages)
          setResultImage(successfulImages[0])
          setIsGenerating(false)
        }
        
        // Partial refund for failed images
        const failedCount = count - successfulImages.length
        if (failedCount > 0) {
          console.log(`[Quota] ${failedCount} images failed, partial refund`)
          // Note: Backend should handle partial refunds based on actual success
        }
      } else {
        // All failed - full refund
        console.log('[Quota] All edits failed, refunding')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
          await refreshQuota()
        } catch (e) {
          console.warn('[Quota] Failed to refund:', e)
        }
        throw new Error(t.edit?.editFailed || "Edit failed")
      }
    } catch (error: any) {
      console.error("Edit error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || 'Edit failed')
      
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
          const errorMsg = getErrorMessage(error.message, t) || t.errors?.generateFailed || "Edit failed, please retry"
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
    setResultImages([])
    setCustomPrompt("")
    setActiveImageSlot(0)
  }
  
  // Re-generate a single result image
  const handleRegenerate = async (index: number) => {
    const validImages = inputImages.filter((img): img is string => img !== null)
    if (validImages.length === 0 || !customPrompt.trim()) return
    
    // Check quota for 1 image (4K costs 2x)
    const singleImageCost = resolution === '4K' ? BASE_CREDIT_COST * 2 : BASE_CREDIT_COST
    const hasQuota = await checkQuota(singleImageCost)
    if (!hasQuota) return
    
    // Set regenerating state to show skeleton
    setRegeneratingIndex(index)
    
    const taskId = addTask('edit', validImages[0], { customPrompt, inputImageCount: validImages.length, resolution }, 1)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    
    // Reserve quota for 1 image
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, imageCount: 1, taskType: 'edit' }),
      })
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve:', e)
    }
    
    // Run single image generation
    try {
      const compressedImages = await Promise.all(
        validImages.map(async (img) => {
          try {
            return await compressBase64Image(img, 1024)
          } catch (e) {
            return img
          }
        })
      )
      
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImages: compressedImages,
          customPrompt,
          taskId,
          aspectRatio,
          resolution,
        }),
      }, 180000)
      
      const data = await response.json()
      
      if (data.success && data.image) {
        // Replace the image at the index
        setResultImages(prev => {
          const newImages = [...prev]
          newImages[index] = data.image
          return newImages
        })
        updateTaskStatus(taskId, 'completed', [data.image])
        await refreshQuota()
      } else {
        // Refund on failure
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        await refreshQuota()
        alert(t.edit?.editFailed || 'Regeneration failed')
      }
    } catch (error: any) {
      console.error('Regenerate error:', error)
      await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
      await refreshQuota()
      alert(error.message || t.edit?.editFailed || 'Regeneration failed')
    } finally {
      setRegeneratingIndex(null)
    }
  }
  
  // Download image
  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edit-result-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }
  
  // Favorite image (placeholder - would need backend integration)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const handleFavorite = (index: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(index)) {
        newFavorites.delete(index)
      } else {
        newFavorites.add(index)
      }
      return newFavorites
    })
  }
  
  // Use result image as new input for further editing
  const handleEditResult = (imageUrl: string) => {
    setInputImages([imageUrl])
    setResultImages([])
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
      
      {/* PC Web: Two-column layout - Input on left, Output on right */}
      {isDesktop ? (
        <div className="flex-1 overflow-y-auto py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-6">
              {/* Left Column: Input Controls */}
              <div className="w-[480px] shrink-0 space-y-4">
                {/* Image Upload Section */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                  <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    {t.edit?.selectImage || 'Select Image'}
                  </h3>
                  
                  {inputImages.length === 0 ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setActiveImageSlot(0)
                          fileInputRef.current?.click()
                        }}
                        className="w-full h-28 border-2 border-dashed border-zinc-300 rounded-xl bg-zinc-50 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center justify-center gap-2 transition-colors"
                      >
                        <Upload className="w-7 h-7 text-zinc-400" />
                        <span className="text-sm text-zinc-600 font-medium">{t.edit?.uploadFromAlbum || 'Upload from Album'}</span>
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setActiveImageSlot(0)
                            setShowProductPanel(true)
                          }}
                          className="h-10 rounded-lg border border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <FolderHeart className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-zinc-700">{t.edit?.fromAssets || 'From Assets'}</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setActiveImageSlot(0)
                            setShowGalleryPanel(true)
                          }}
                          className="h-10 rounded-lg border border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Images className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-zinc-700">{t.edit?.fromPhotos || 'From Photos'}</span>
                        </button>
                      </div>
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
                      
                      <div className="grid grid-cols-4 gap-2">
                        {inputImages.map((img, index) => {
                          if (!img || typeof img !== 'string') return null
                          return (
                            <div key={index} className="relative aspect-square group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={img} 
                                alt={`Image ${index + 1}`} 
                                className="absolute inset-0 w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setZoomImage(img)}
                              />
                              <div className="absolute top-1 left-1 w-5 h-5 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                                {index + 1}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveImage(index)
                                }}
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
                
                {/* Prompt & Options Combined */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                  <h3 className="font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                    {t.edit?.describeEdit || 'Describe your edits'}
                  </h3>
                  
                  <textarea
                    placeholder={t.edit?.editPlaceholder || 'e.g.: Change pants to blue jeans, remove people in background...'}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full min-h-[100px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-300 text-sm leading-relaxed"
                  />
                  
                  {/* Compact Options Row */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {/* Number of Images */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{t.edit?.numberOfImages || 'Count'}:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(num => (
                          <button
                            key={num}
                            onClick={() => setNumImages(num)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              numImages === num
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="w-px h-6 bg-zinc-200" />
                    
                    {/* Aspect Ratio */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{t.edit?.aspectRatio || 'Ratio'}:</span>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                        className="h-8 px-2 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 border-0 focus:ring-2 focus:ring-purple-500"
                      >
                        {(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const).map(ratio => (
                          <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-px h-6 bg-zinc-200" />
                    
                    {/* Resolution */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{t.edit?.resolution || 'Quality'}:</span>
                      <div className="flex gap-1">
                        {(['1K', '2K', '4K'] as const).map(res => (
                          <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`px-2.5 h-8 rounded-lg text-xs font-medium transition-colors ${
                              resolution === res
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            } ${res === '4K' ? 'relative' : ''}`}
                          >
                            {res}
                            {res === '4K' && <span className="ml-0.5 text-[10px] text-purple-200">2x</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Generate Button */}
                  <button
                    onClick={(e) => {
                      triggerFlyToGallery(e)
                      handleGenerate()
                    }}
                    disabled={inputImages.filter(Boolean).length === 0 || !customPrompt.trim() || isGenerating}
                    className={`w-full h-12 mt-4 rounded-xl text-base font-semibold gap-2 flex items-center justify-center transition-all ${
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
                        <Sparkles className="w-5 h-5" />
                        <span>{t.edit?.startGenerate || 'Start Generate'}</span>
                        <CreditCostBadge cost={totalCreditCost} className="ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Right Column: Output Results */}
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl border border-zinc-200 p-5 h-full min-h-[600px]">
                  <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                    {t.edit?.generationResult || 'Generation Result'}
                  </h3>
                  
                  {isGenerating ? (
                    <div className="h-full flex flex-col items-center justify-center py-12">
                      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                        {Array.from({ length: numImages }).map((_, i) => (
                          <div key={i} className="aspect-square rounded-xl bg-zinc-100 animate-pulse flex items-center justify-center">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                              <span className="text-xs text-zinc-400">{t.common?.generating || 'Generating...'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : resultImages.length > 0 ? (
                    <div className={`grid gap-4 ${resultImages.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2'}`}>
                      {resultImages.map((img, index) => (
                        <div key={index} className="relative group">
                          {regeneratingIndex === index ? (
                            /* Show skeleton when regenerating */
                            <div className="aspect-square rounded-t-xl bg-zinc-100 animate-pulse flex items-center justify-center">
                              <div className="text-center">
                                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                                <span className="text-xs text-zinc-400">{t.common?.generating || 'Generating...'}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Image
                                src={img}
                                alt={`Result ${index + 1}`}
                                width={500}
                                height={500}
                                className="w-full rounded-t-xl cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => setZoomImage(img)}
                              />
                              {/* Hover actions: favorite & download */}
                              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleFavorite(index) }}
                                  className={`w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                                    favorites.has(index) 
                                      ? 'bg-red-500 text-white' 
                                      : 'bg-black/40 text-white hover:bg-black/60'
                                  }`}
                                  title={t.common?.favorite || 'Favorite'}
                                >
                                  <Heart className={`w-4 h-4 ${favorites.has(index) ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(img, index) }}
                                  className="w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-colors"
                                  title={t.common?.download || 'Download'}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                          <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">
                            {index + 1}
                          </span>
                          {/* Action buttons */}
                          <div className="flex border-t border-zinc-100 bg-white rounded-b-xl">
                            <button
                              onClick={() => handleRegenerate(index)}
                              disabled={regeneratingIndex !== null}
                              className="flex-1 py-2.5 text-sm font-medium text-zinc-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 border-r border-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-4 h-4 ${regeneratingIndex === index ? 'animate-spin' : ''}`} />
                              <span>{t.edit?.regenerate || 'Re-generate'}</span>
                            </button>
                            <button
                              onClick={() => handleEditResult(img)}
                              disabled={regeneratingIndex !== null}
                              className="flex-1 py-2.5 text-sm font-medium text-zinc-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Pencil className="w-4 h-4" />
                              <span>{t.edit?.editThis || 'Edit'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : resultImage ? (
                    <div className="max-w-md mx-auto">
                      <div className="relative group">
                        {regeneratingIndex === 0 ? (
                          /* Show skeleton when regenerating */
                          <div className="aspect-square rounded-t-xl bg-zinc-100 animate-pulse flex items-center justify-center">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                              <span className="text-xs text-zinc-400">{t.common?.generating || 'Generating...'}</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Image
                              src={resultImage}
                              alt="Result"
                              width={500}
                              height={500}
                              className="w-full rounded-t-xl cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => setZoomImage(resultImage)}
                            />
                            {/* Hover actions: favorite & download */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleFavorite(0) }}
                                className={`w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                                  favorites.has(0) 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-black/40 text-white hover:bg-black/60'
                                }`}
                                title={t.common?.favorite || 'Favorite'}
                              >
                                <Heart className={`w-4 h-4 ${favorites.has(0) ? 'fill-current' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(resultImage, 0) }}
                                className="w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-colors"
                                title={t.common?.download || 'Download'}
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">
                          {t.edit?.generationResult || 'Result'}
                        </span>
                        {/* Action buttons */}
                        <div className="flex border-t border-zinc-100 bg-white rounded-b-xl">
                          <button
                            onClick={() => handleRegenerate(0)}
                            disabled={regeneratingIndex !== null}
                            className="flex-1 py-2.5 text-sm font-medium text-zinc-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 border-r border-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-4 h-4 ${regeneratingIndex === 0 ? 'animate-spin' : ''}`} />
                            <span>{t.edit?.regenerate || 'Re-generate'}</span>
                          </button>
                          <button
                            onClick={() => handleEditResult(resultImage)}
                            disabled={regeneratingIndex !== null}
                            className="flex-1 py-2.5 text-sm font-medium text-zinc-600 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Pencil className="w-4 h-4" />
                            <span>{t.edit?.editThis || 'Edit'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-20">
                      <div className="w-20 h-20 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                        <Wand2 className="w-10 h-10 text-zinc-300" />
                      </div>
                      <p className="text-lg font-medium text-zinc-500 mb-1">{t.edit?.noResultsYet || 'No results yet'}</p>
                      <p className="text-sm text-zinc-400">{t.edit?.uploadAndGenerate || 'Upload an image and generate to see results'}</p>
                    </div>
                  )}
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
                  <CreditCostBadge cost={BASE_CREDIT_COST} className="ml-2" />
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
      
      {/* Asset Picker Panel */}
      <AssetPickerPanel
        open={showProductPanel}
        onClose={() => setShowProductPanel(false)}
        onSelect={handleSelectImage}
        onUploadClick={() => fileInputRef.current?.click()}
        themeColor="purple"
      />
      
      {/* Gallery Picker Panel */}
      <GalleryPickerPanel
        open={showGalleryPanel}
        onClose={() => setShowGalleryPanel(false)}
        onSelect={handleSelectImage}
        themeColor="purple"
      />
      
      
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

