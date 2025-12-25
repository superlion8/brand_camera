"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Home, Upload, X, Plus, Loader2, Camera, 
  Sparkles, Check, ArrowLeft, FolderHeart
} from "lucide-react"
import { fileToBase64, compressBase64Image } from "@/lib/utils"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import Webcam from "react-webcam"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

const MAX_CLOTHING_IMAGES = 5

type TryOnMode = 'main' | 'camera' | 'processing' | 'results'

export default function TryOnPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { addGeneration, generations } = useAssetStore()
  
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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Camera states
  const [cameraTarget, setCameraTarget] = useState<'person' | 'clothing'>('person')
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const webcamRef = useRef<Webcam>(null)
  
  // Gallery panel states
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [galleryTarget, setGalleryTarget] = useState<'person' | 'clothing'>('person')
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  
  // Clothing upload panel
  const [showClothingPanel, setShowClothingPanel] = useState(false)
  
  // File input refs
  const personFileInputRef = useRef<HTMLInputElement>(null)
  const clothingFileInputRef = useRef<HTMLInputElement>(null)
  
  // Quota management
  const { quota, checkQuota, refreshQuota, showExceededModal, requiredCount, closeExceededModal } = useQuota()
  
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
  const handleGallerySelect = async (imageUrl: string) => {
    setIsLoadingGallery(true)
    try {
      // 直接使用 URL
      if (galleryTarget === 'person') {
        setPersonImage(imageUrl)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, imageUrl])
        }
      }
      setShowGalleryPanel(false)
    } catch (error) {
      console.error('[TryOn] Failed to load gallery image:', error)
    } finally {
      setIsLoadingGallery(false)
    }
  }
  
  // Remove clothing image
  const removeClothingImage = (index: number) => {
    setClothingImages(prev => prev.filter((_, i) => i !== index))
  }
  
  // Start generation
  const handleGenerate = async () => {
    if (!personImage || clothingImages.length === 0) return
    
    const hasQuota = await checkQuota(2)
    if (!hasQuota) return
    
    const personImageUrl = personImage.startsWith('data:') ? personImage : 
      personImage.startsWith('http') ? personImage : `data:image/jpeg;base64,${personImage}`
    const taskId = addTask('try_on', personImageUrl, { customPrompt: prompt }, 2)
    initImageSlots(taskId, 2)
    setCurrentTaskId(taskId)
    
    setMode('processing')
    setResultImages([])
    
    // Reserve quota
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: 2,
          taskType: 'try_on',
        }),
      })
      refreshQuota()
    } catch (e) {
      console.warn('[Quota] Failed to reserve:', e)
    }
    
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
                refreshQuota()
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
      
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        refreshQuota()
      } catch (e) {
        console.warn('[Quota] Failed to refund:', e)
      }
      
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
            className="flex-1 overflow-y-auto pb-40"
          >
            {/* Person Image Upload Area */}
            <div className="bg-zinc-100 min-h-[200px] flex items-center justify-center relative p-4">
              {!personImage ? (
                <div className="w-full max-w-sm space-y-2">
                  <button
                    onClick={() => {
                      setCameraTarget('person')
                      setMode('camera')
                    }}
                    className="w-full h-14 rounded-xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center gap-3 transition-colors shadow-lg shadow-pink-200"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">{t.tryOn?.takePhoto || '拍摄人物照片'}</span>
                  </button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => personFileInputRef.current?.click()}
                      className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700">{t.tryOn?.fromAlbum || '相册'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setGalleryTarget('person')
                        setShowGalleryPanel(true)
                      }}
                      className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderHeart className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm text-zinc-700">{t.tryOn?.fromGallery || '成片'}</span>
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
                    {t.edit?.editNew || '更换'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Settings Panel */}
            <div className="p-4 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10 space-y-5">
              {/* Clothing Images */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t.tryOn?.clothingImages || '服装图片'}</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  {t.tryOn?.clothingImagesDesc || '上传想要搭配的衣服（最多5件）'}
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
                    <button
                      onClick={() => setShowClothingPanel(true)}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 transition-colors flex flex-col items-center justify-center gap-1 shrink-0"
                    >
                      <Plus className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400">{t.tryOn?.addClothing || '添加'}</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Prompt Input */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">
                  {t.common?.style || '风格描述'}
                  <span className="text-xs text-zinc-400 font-normal ml-2">({t.common?.custom || '可选'})</span>
                </h3>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t.tryOn?.promptPlaceholder || '描述你想要的换装效果（可选）'}
                  className="w-full h-20 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 transition-colors"
                />
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Fixed Generate Button for main mode */}
        {mode === 'main' && (
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
              <span>{t.tryOn?.generate || '开始换装'}</span>
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
            <button
              onClick={() => setMode('main')}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex-1 relative">
              {hasCamera ? (
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
              
              <div className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
                {cameraTarget === 'person' ? (t.tryOn?.personImage || '拍摄人物照片') : (t.tryOn?.clothingImages || '拍摄服装')}
              </div>
            </div>
            
            <div className="bg-black py-8 pb-24 flex justify-center">
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
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 pb-24"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-pink-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-pink-500 animate-spin relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800 mb-2">{t.tryOn?.generating || '正在生成换装效果...'}</h3>
            <p className="text-zinc-500 text-sm mb-8">{t.tryOn?.generatingDesc || 'AI 正在为您生成 2 张换装效果图'}</p>
            
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-400 text-xs text-center mb-4">{t.studio?.continueInBackground || '可以继续拍摄新照片'}</p>
              <button
                onClick={handleNewDuringProcessing}
                className="w-full h-12 rounded-full bg-pink-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors"
              >
                <Camera className="w-5 h-5" />
                {t.tryOn?.newGeneration || '拍摄新照片'}
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full h-12 rounded-full bg-zinc-100 text-zinc-700 font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Home className="w-5 h-5" />
                {t.studio?.returnHome || '返回首页'}
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Results Mode */}
        {mode === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto"
          >
            <div className="p-4 pb-40">
              <div className="text-center mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-zinc-800">{t.tryOn?.resultTitle || '换装完成'}</h3>
                <p className="text-xs text-zinc-500">{t.tryOn?.resultDesc || '点击图片可放大查看'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {resultImages.filter((url): url is string => !!url).map((url, i) => (
                  <button
                    key={i}
                    className="relative aspect-[3/4] bg-zinc-100 rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => setFullscreenImage(url)}
                  >
                    <Image src={url} alt={`Result ${i + 1}`} fill className="object-cover" />
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-pink-500 text-white">
                        换装
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t flex gap-3 max-w-md mx-auto z-40">
              <button
                onClick={() => setMode('main')}
                className="flex-1 h-12 border border-zinc-200 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
              >
                {t.studio?.adjustParams || '调整参数'}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 h-12 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium hover:from-pink-600 hover:to-purple-600 transition-colors"
              >
                {t.tryOn?.newGeneration || '重新换装'}
              </button>
            </div>
            
            {/* Fullscreen Image Viewer */}
            {fullscreenImage && (
              <div 
                className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
                onClick={() => setFullscreenImage(null)}
              >
                <button
                  onClick={() => setFullscreenImage(null)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={4}
                  centerOnInit
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <img
                      src={fullscreenImage}
                      alt="Fullscreen"
                      className="max-w-full max-h-full object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            )}
          </motion.div>
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
              
              <div className="p-4 space-y-3">
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
                  
                  {/* Gallery */}
                  <button
                    onClick={() => {
                      setShowClothingPanel(false)
                      setGalleryTarget('clothing')
                      setShowGalleryPanel(true)
                    }}
                    className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-pink-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    <FolderHeart className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-700">{t.tryOn?.fromGallery || '成片'}</span>
                  </button>
                </div>
                
                <p className="text-xs text-zinc-400 text-center pt-2">
                  {t.tryOn?.clothingImagesDesc || `还可添加 ${MAX_CLOTHING_IMAGES - clothingImages.length} 件服装`}
                </p>
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
                <span className="font-semibold">{t.tryOn?.fromGallery || '从成片选择'}</span>
                <button
                  onClick={() => setShowGalleryPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 relative">
                {isLoadingGallery && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                  </div>
                )}
                {generations.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {generations.flatMap(gen => 
                      (gen.outputImageUrls || []).map((url, idx) => (
                        <button
                          key={`${gen.id}-${idx}`}
                          disabled={isLoadingGallery}
                          onClick={() => handleGallerySelect(url)}
                          className="aspect-[4/5] rounded-lg overflow-hidden relative border-2 border-transparent hover:border-pink-500 transition-all bg-white disabled:opacity-50"
                        >
                          <Image src={url} alt={`Gallery ${idx + 1}`} fill className="object-cover" />
                        </button>
                      ))
                    ).slice(0, 30)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <Home className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.studio?.noGalleryImages || '暂无成片'}</p>
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
        requiredCount={requiredCount}
      />
    </div>
  )
}
