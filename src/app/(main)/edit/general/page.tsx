"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Wand2, X, Loader2, Home, ArrowLeft, Camera, FolderHeart, Upload, Images } from "lucide-react"
import { fileToBase64, compressBase64Image, fetchWithTimeout, generateId, ensureBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { PRESET_PRODUCTS } from "@/data/presets"
import Webcam from "react-webcam"
import { motion, AnimatePresence } from "framer-motion"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"

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
  const [inputImage, setInputImage] = useState<string | null>(null)
  
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
  
  // Check for image passed from gallery page
  useEffect(() => {
    const editImage = sessionStorage.getItem('editImage')
    if (editImage) {
      setInputImage(editImage)
      sessionStorage.removeItem('editImage') // Clean up
    }
  }, [])
  
  // Edit state - only prompt for general edit
  const [customPrompt, setCustomPrompt] = useState("")
  const [resultImage, setResultImage] = useState<string | null>(null)
  
  const { addGeneration, userProducts, generations } = useAssetStore()
  const { addTask, updateTaskStatus } = useGenerationTaskStore()
  
  // Quota management
  const { quota, checkQuota, refreshQuota, showExceededModal, requiredCount, closeExceededModal } = useQuota()
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setInputImage(imageSrc)
        setShowCamera(false)
        setResultImage(null)
      }
    }
  }, [])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
  }, [])
  
  const handleSelectFromAsset = useCallback(async (imageUrl: string) => {
    setIsLoadingAsset(true)
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setInputImage(base64)
        setShowProductPanel(false)
        setResultImage(null)
      }
    } catch (e) {
      console.error('Failed to load asset:', e)
    } finally {
      setIsLoadingAsset(false)
    }
  }, [])
  
  const handleSelectFromGallery = useCallback(async (imageUrl: string) => {
    setIsLoadingAsset(true)
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setInputImage(base64)
        setShowGalleryPanel(false)
        setResultImage(null)
      }
    } catch (e) {
      console.error('Failed to load gallery image:', e)
    } finally {
      setIsLoadingAsset(false)
    }
  }, [])
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setInputImage(base64)
      setResultImage(null)
    }
  }
  
  const handleGenerate = async () => {
    if (!inputImage || !customPrompt.trim()) return
    
    // Check quota before starting generation (1 image)
    const hasQuota = await checkQuota(1)
    if (!hasQuota) {
      return // Modal will be shown by the hook
    }
    
    // Capture current state before async operations
    const currentInputImage = inputImage
    const currentCustomPrompt = customPrompt
    
    // Create task (edit generates 1 image)
    const taskId = addTask('edit', currentInputImage, { customPrompt: currentCustomPrompt }, 1)
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
    runEditGeneration(taskId, currentInputImage, currentCustomPrompt)
  }
  
  // Background edit generation - simplified for general edit
  const runEditGeneration = async (
    taskId: string,
    inputImg: string,
    prompt: string
  ) => {
    try {
      const compressedInput = await compressBase64Image(inputImg, 1024)
      
      console.log("Sending general edit request...")
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImage: compressedInput,
          customPrompt: prompt,
          taskId, // 传递 taskId，让后端直接写入数据库
          // No model/background/vibe for general edit
        }),
      }, 180000) // 增加超时时间，因为后端现在会上传图片
      
      const data = await response.json()
      
      if (data.success && data.image) {
        updateTaskStatus(taskId, 'completed', [data.image])
        
        // 后端已写入数据库时，跳过前端的云端同步
        const skipCloudSync = !!data.savedToDb
        console.log(`Edit completed, savedToDb: ${data.savedToDb}`)
        
        await addGeneration({
          id: taskId,
          type: "edit",
          inputImageUrl: inputImg,
          outputImageUrls: [data.image],
          prompt: prompt,
          createdAt: new Date().toISOString(),
          params: {
            customPrompt: prompt,
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
          alert("编辑超时，请重试。建议使用较小的图片。")
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
    setInputImage(null)
    setResultImage(null)
    setCustomPrompt("")
  }
  
  const handleReturnHomeDuringProcessing = () => {
    setIsGenerating(false)
    router.push('/')
  }
  
  const handleReset = () => {
    setInputImage(null)
    setResultImage(null)
    setCustomPrompt("")
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
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
          <span className="font-semibold text-zinc-900">{t.edit.generalEdit}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Image Area */}
        <div className="bg-zinc-100 min-h-[280px] flex items-center justify-center relative p-4">
          {!inputImage ? (
            <div className="w-full max-w-sm space-y-2">
              {/* Camera */}
              <button
                onClick={() => setShowCamera(true)}
                className="w-full h-16 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-purple-200"
              >
                <Camera className="w-5 h-5" />
                <span className="font-medium">{t.edit.takePhoto}</span>
              </button>
              
              <div className="grid grid-cols-3 gap-2">
                {/* Album */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">{t.camera.album}</span>
                </button>
                
                {/* Asset library */}
                <button
                  onClick={() => setShowProductPanel(true)}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FolderHeart className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">{t.edit.selectFromAssets}</span>
                </button>
                
                {/* Gallery */}
                <button
                  onClick={() => setShowGalleryPanel(true)}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Images className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">{t.edit.selectFromGallery}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-xs">
              <Image 
                src={resultImage || inputImage} 
                alt="Preview"
                width={400}
                height={500}
                className="w-full rounded-xl shadow-lg"
              />
              {resultImage && (
                <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">{t.edit.generationResult}</span>
              )}
              {!resultImage && (
                <span className="absolute top-2 left-2 px-2 py-1 bg-zinc-500 text-white text-xs rounded font-medium">原图</span>
              )}
              
              <button
                onClick={handleReset}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
              >
                重选
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
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
              onClick={handleGenerate}
              disabled={!inputImage || !customPrompt.trim() || isGenerating}
              className={`w-full h-14 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                !inputImage || !customPrompt.trim() || isGenerating
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
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
          </div>
          <h3 className="text-white text-xl font-bold mb-2">AI 正在处理...</h3>
          <p className="text-zinc-400 text-sm mb-8">根据您的描述修改图片</p>
          
          {/* Navigation buttons during processing */}
          <div className="space-y-3 w-full max-w-xs">
            <p className="text-zinc-500 text-xs mb-4">{t.camera.continueInBackground}</p>
            <button
              onClick={handleNewEditDuringProcessing}
              className="w-full h-12 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Wand2 className="w-5 h-5" />
              修新的图
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
            {/* Back button */}
            <button
              onClick={() => setShowCamera(false)}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Camera view */}
            <div className="flex-1 relative">
              {hasCamera ? (
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
                    <p className="text-sm">相机不可用</p>
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
              
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
              
              {/* Focus frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-purple-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-purple-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-purple-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-purple-400" />
                </div>
              </div>
            </div>
            
            {/* Capture button */}
            <div className="bg-black py-8 flex justify-center">
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.camera.selectProduct}</span>
                <button
                  onClick={() => setShowProductPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Source Tabs */}
              <div className="px-4 py-2 border-b bg-white">
                <div className="flex bg-zinc-100 rounded-lg p-1">
                  <button
                    onClick={() => setProductSourceTab("preset")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "preset"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    官方示例 ({PRESET_PRODUCTS.length})
                  </button>
                  <button
                    onClick={() => setProductSourceTab("user")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "user"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    我的商品 ({userProducts.length})
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
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-purple-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                          官方
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {userProducts.map(product => (
                      <button
                        key={product.id}
                        disabled={isLoadingAsset}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.camera.noMyProducts}</p>
                    <p className="text-xs mt-1">{t.camera.uploadInAssets}</p>
                    <button
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600"
                    >
                      {t.camera.goUpload}
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">{t.edit.selectFromGallery}</span>
                <button
                  onClick={() => setShowGalleryPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {/* Loading overlay */}
                {isLoadingAsset && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                )}
                {generations.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {generations
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .flatMap(gen => gen.outputImageUrls.map((url, idx) => ({ url, gen, idx })))
                      .map((item, index) => (
                        <button
                          key={`${item.gen.id}-${item.idx}`}
                          disabled={isLoadingAsset}
                          onClick={() => handleSelectFromGallery(item.url)}
                          className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-purple-500 transition-all bg-white disabled:opacity-50"
                        >
                          <Image src={item.url} alt={`${t.edit.generationResult} ${index + 1}`} fill className="object-cover" />
                          <span className={`absolute top-1 left-1 text-white text-[8px] px-1 py-0.5 rounded font-medium ${
                            item.gen.type === 'studio' ? 'bg-amber-500' :
                            item.gen.type === 'edit' ? 'bg-purple-500' : 'bg-blue-500'
                          }`}>
                            {item.gen.type === 'studio' ? '影棚' :
                             item.gen.type === 'edit' ? t.nav.edit : t.common.model}
                          </span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <Images className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.edit.noGallery}</p>
                    <p className="text-xs mt-1">{t.studio.goShootToGenerate}</p>
                    <button
                      onClick={() => {
                        setShowGalleryPanel(false)
                        router.push("/camera")
                      }}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600"
                    >
                      {t.edit.goShoot}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        usedCount={quota?.usedCount}
        totalQuota={quota?.totalQuota}
        requiredCount={requiredCount}
        userEmail={user?.email || ''}
      />
    </div>
  )
}

