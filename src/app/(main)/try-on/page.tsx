"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Home, Upload, X, Plus, Loader2, Camera, Images, 
  Sparkles, Check, ArrowLeft, ZoomIn
} from "lucide-react"
import { fileToBase64, compressBase64Image, generateId } from "@/lib/utils"
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

type Phase = 'input' | 'generating' | 'result'

export default function TryOnPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  const { addGeneration } = useAssetStore()
  
  // Input states
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [clothingImages, setClothingImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  
  // UI states
  const [phase, setPhase] = useState<Phase>('input')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState("")
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 2 })
  const [resultImages, setResultImages] = useState<string[]>([])
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<'person' | 'clothing'>('person')
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const webcamRef = useRef<Webcam>(null)
  
  // Gallery panel states
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [galleryTarget, setGalleryTarget] = useState<'person' | 'clothing'>('person')
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  
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
          }
        } catch (error) {
          console.error('[TryOn] Failed to fetch gallery:', error)
        } finally {
          setIsLoadingGallery(false)
        }
      }
      fetchGalleryPhotos()
    }
  }, [showGalleryPanel, user])
  
  // Handle file upload
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'person' | 'clothing'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const base64 = await fileToBase64(file)
      const compressed = await compressBase64Image(base64, 1200, 0.85)
      
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
    
    // Reset input
    e.target.value = ''
  }
  
  // Handle camera capture
  const handleCameraCapture = async () => {
    if (!webcamRef.current) return
    
    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return
    
    try {
      const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, '')
      const compressed = await compressBase64Image(base64, 1200, 0.85)
      
      if (cameraTarget === 'person') {
        setPersonImage(compressed)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, compressed])
        }
      }
      
      setShowCamera(false)
      setCameraReady(false)
    } catch (error) {
      console.error('[TryOn] Failed to capture:', error)
    }
  }
  
  // Handle gallery selection
  const handleGallerySelect = async (imageUrl: string) => {
    try {
      // Fetch and convert to base64
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.replace(/^data:image\/\w+;base64,/, ''))
        }
        reader.readAsDataURL(blob)
      })
      
      const compressed = await compressBase64Image(base64, 1200, 0.85)
      
      if (galleryTarget === 'person') {
        setPersonImage(compressed)
      } else {
        if (clothingImages.length < MAX_CLOTHING_IMAGES) {
          setClothingImages(prev => [...prev, compressed])
        }
      }
      
      setShowGalleryPanel(false)
    } catch (error) {
      console.error('[TryOn] Failed to load gallery image:', error)
    }
  }
  
  // Remove clothing image
  const removeClothingImage = (index: number) => {
    setClothingImages(prev => prev.filter((_, i) => i !== index))
  }
  
  // Start generation
  const handleGenerate = async () => {
    if (!personImage || clothingImages.length === 0) return
    
    // Check quota
    const hasQuota = await checkQuota(2)
    if (!hasQuota) return
    
    setIsGenerating(true)
    setPhase('generating')
    setGeneratingStep(t.tryOn?.generating || 'Generating...')
    setGeneratingProgress({ current: 0, total: 2 })
    setResultImages([])
    
    // Create task
    const personImageUrl = personImage.startsWith('data:') ? personImage : `data:image/jpeg;base64,${personImage}`
    const taskId = addTask('try_on', personImageUrl, { prompt }, 2)
    initImageSlots(taskId, 2)
    setCurrentTaskId(taskId)
    
    try {
      // Prepare clothing images with data URI prefix if needed
      const clothingWithPrefix = clothingImages.map(img => 
        img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
      )
      
      const response = await fetch('/api/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImage: personImage.startsWith('data:') ? personImage : `data:image/jpeg;base64,${personImage}`,
          clothingImages: clothingWithPrefix,
          prompt,
          generationId: taskId,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to start generation')
      }
      
      // Handle SSE stream
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
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7)
            const dataLine = lines[lines.indexOf(line) + 1]
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6))
              
              if (eventType === 'progress') {
                setGeneratingStep(data.message)
                if (data.current && data.total) {
                  setGeneratingProgress({ current: data.current, total: data.total })
                }
              } else if (eventType === 'image') {
                setResultImages(prev => {
                  const newResults = [...prev]
                  newResults[data.index] = data.url
                  return newResults
                })
                
                updateImageSlot(taskId, data.index, {
                  status: 'completed',
                  imageUrl: data.url,
                  modelType: 'pro',
                })
                
                // Trigger fly animation
                triggerFlyToGallery(data.url)
              } else if (eventType === 'complete') {
                updateTaskStatus(taskId, 'completed')
                
                // Add to gallery
                addGeneration({
                  id: taskId,
                  dbId: taskId,
                  type: 'try_on',
                  outputImageUrls: data.images,
                  createdAt: new Date().toISOString(),
                  inputImageUrl: personImage.startsWith('data:') ? personImage : `data:image/jpeg;base64,${personImage}`,
                  params: {
                    productImages: clothingWithPrefix,
                    prompt,
                  },
                })
                
                setPhase('result')
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
      setPhase('input')
    } finally {
      setIsGenerating(false)
    }
  }
  
  // Reset for new generation
  const handleNewGeneration = () => {
    setPhase('input')
    setResultImages([])
    setCurrentTaskId(null)
  }
  
  // Check if can generate
  const canGenerate = personImage && clothingImages.length > 0 && !isGenerating
  
  return (
    <div className="min-h-full bg-zinc-50 pb-24">
      {/* Header */}
      <div className="h-14 border-b bg-white/95 backdrop-blur-md flex items-center px-4 sticky top-0 z-30">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-600" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <span className="font-semibold text-lg text-zinc-900">{t.tryOn?.title || '虚拟换装'}</span>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {/* Input Phase */}
        {phase === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 space-y-6"
          >
            {/* Person Image Section */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold">1</span>
                {t.tryOn?.personImage || '人物照片'}
              </h3>
              <p className="text-xs text-zinc-500 mb-3">{t.tryOn?.personImageDesc || '上传一张人物照片作为换装基础'}</p>
              
              {personImage ? (
                <div className="relative w-full aspect-[3/4] max-w-[280px] rounded-2xl overflow-hidden bg-zinc-200 mx-auto">
                  <Image
                    src={personImage.startsWith('data:') ? personImage : `data:image/jpeg;base64,${personImage}`}
                    alt="Person"
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => setPersonImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => personFileInputRef.current?.click()}
                    className="flex-1 h-32 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-6 h-6 text-zinc-400" />
                    <span className="text-sm text-zinc-500">{t.tryOn?.fromAlbum || '从相册选择'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCameraTarget('person')
                      setShowCamera(true)
                    }}
                    className="flex-1 h-32 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Camera className="w-6 h-6 text-zinc-400" />
                    <span className="text-sm text-zinc-500">{t.tryOn?.takePhoto || '拍照'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setGalleryTarget('person')
                      setShowGalleryPanel(true)
                    }}
                    className="flex-1 h-32 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-pink-400 hover:bg-pink-50/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Images className="w-6 h-6 text-zinc-400" />
                    <span className="text-sm text-zinc-500">{t.tryOn?.fromGallery || '从成片选择'}</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Clothing Images Section */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">2</span>
                {t.tryOn?.clothingImages || '服装图片'}
              </h3>
              <p className="text-xs text-zinc-500 mb-3">
                {t.tryOn?.clothingImagesDesc || '上传想要搭配的衣服（最多5件）'}
              </p>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {clothingImages.map((img, index) => (
                  <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden bg-zinc-200 shrink-0">
                    <Image
                      src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                      alt={`Clothing ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => removeClothingImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                {clothingImages.length < MAX_CLOTHING_IMAGES && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => clothingFileInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      <Plus className="w-5 h-5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-400">{t.tryOn?.addClothing || '添加服装'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Prompt Input */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                {t.common?.style || '效果描述'}
                <span className="text-xs text-zinc-400 font-normal">({t.common?.custom || '可选'})</span>
              </h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.tryOn?.promptPlaceholder || '描述你想要的换装效果（可选）'}
                className="w-full h-20 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400"
              />
            </div>
            
            {/* Generate Button */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full h-14 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                  canGenerate
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg shadow-pink-200'
                    : 'bg-zinc-300 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                {t.tryOn?.generate || '开始换装'}
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Generating Phase */}
        {phase === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-[60vh] p-8"
          >
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-pink-100" />
              <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-pink-500" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-zinc-900 mb-2">
              {t.tryOn?.generating || '正在生成换装效果...'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              {generatingStep}
            </p>
            
            {/* Progress dots */}
            <div className="flex gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i <= generatingProgress.current
                      ? 'bg-pink-500'
                      : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
        
        {/* Result Phase */}
        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4"
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900">{t.tryOn?.resultTitle || '换装完成'}</h2>
              <p className="text-sm text-zinc-500 mt-1">{t.tryOn?.resultDesc || '点击图片可放大查看'}</p>
            </div>
            
            {/* Result Images */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {resultImages.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setFullscreenImage(url)}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-200 active:scale-[0.98] transition-transform"
                >
                  <Image
                    src={url}
                    alt={`Result ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded-full text-xs text-white">
                    {index + 1}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent">
              <div className="flex gap-3">
                <button
                  onClick={handleNewGeneration}
                  className="flex-1 h-12 rounded-xl border-2 border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors"
                >
                  {t.tryOn?.newGeneration || '重新换装'}
                </button>
                <button
                  onClick={() => router.push('/gallery')}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium shadow-lg shadow-pink-200"
                >
                  {t.tryOn?.viewGallery || '查看成片'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hidden file inputs */}
      <input
        ref={personFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'person')}
      />
      <input
        ref={clothingFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'clothing')}
      />
      
      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
              <button
                onClick={() => {
                  setShowCamera(false)
                  setCameraReady(false)
                }}
                className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {hasCamera ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: 'environment',
                  aspectRatio: 3/4,
                }}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() => setHasCamera(false)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                Camera not available
              </div>
            )}
            
            {cameraReady && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                <button
                  onClick={handleCameraCapture}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
                >
                  <div className="w-14 h-14 rounded-full border-4 border-pink-500" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Gallery Panel */}
      <AnimatePresence>
        {showGalleryPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowGalleryPanel(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-100">
                <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-3" />
                <h3 className="font-semibold text-zinc-900 text-center">
                  {t.tryOn?.fromGallery || '从成片选择'}
                </h3>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
                {isLoadingGallery ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                  </div>
                ) : galleryPhotos.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    No photos available
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {galleryPhotos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => handleGallerySelect(photo.imageUrl)}
                        className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 active:scale-95 transition-transform"
                      >
                        <Image
                          src={photo.imageUrl}
                          alt={`Gallery ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
            >
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img
                  src={fullscreenImage}
                  alt="Fullscreen"
                  className="max-w-full max-h-full object-contain"
                />
              </TransformComponent>
            </TransformWrapper>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
        currentQuota={quota?.remaining || 0}
      />
    </div>
  )
}

