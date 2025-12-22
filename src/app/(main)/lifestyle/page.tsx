"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Wand2, Camera, Home,
  Heart, Download, ZoomIn, Plus, Sparkles
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, saveProductToAssets } from "@/lib/utils"
import Image from "next/image"
import { PRESET_PRODUCTS } from "@/data/presets"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"

type PageMode = "camera" | "review" | "processing" | "results"

const LIFESTYLE_NUM_IMAGES = 4

function LifestylePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, refreshQuota, showExceededModal, requiredCount, closeExceededModal, quota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { userProducts, addUserAsset, addGeneration } = useAssetStore()
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [lifestyleStatus, setLifestyleStatus] = useState<string>('')
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<string[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<('simple' | 'extended')[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  // Camera permission check
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(track => track.stop())
        setCameraReady(true)
      } catch {
        setHasCamera(false)
      }
      setPermissionChecked(true)
    }
    checkCameraPermission()
  }, [])

  const handleCapture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setProductFromPhone(true)
        setMode("review")
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setProductFromPhone(true)
      setMode("review")
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setProductFromPhone(false)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setSelectedResultIndex(null)
    setMode("camera")
  }

  const handleLifestyleGenerate = async () => {
    if (!capturedImage) return
    
    const hasQuota = await checkQuota(LIFESTYLE_NUM_IMAGES)
    if (!hasQuota) return
    
    if (productFromPhone && capturedImage) {
      saveProductToAssets(capturedImage, addUserAsset, t.common.product)
    }
    
    const params = {
      type: 'lifestyle',
      modelId: null,
      sceneId: null,
    }
    
    const taskId = addTask('lifestyle', capturedImage, params, LIFESTYLE_NUM_IMAGES)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, LIFESTYLE_NUM_IMAGES)
    setMode("processing")
    
    // Reserve quota
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: LIFESTYLE_NUM_IMAGES,
        taskType: 'lifestyle',
      }),
    }).then(() => refreshQuota()).catch(e => console.warn('[Quota] Failed to reserve:', e))
    
    await runLifestyleGeneration(taskId, capturedImage)
  }

  const runLifestyleGeneration = async (taskId: string, productImage: string) => {
    let firstDbId: string | null = null
    
    try {
      setLifestyleStatus('正在连接服务器...')
      
      const response = await fetch('/api/generate-lifestyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage,
          taskId,
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
                setLifestyleStatus(event.message)
                break
              case 'analysis_complete':
                setLifestyleStatus('分析完成，正在匹配...')
                break
              case 'materials_ready':
                setLifestyleStatus('素材准备完成，开始生成...')
                break
              case 'progress':
                setLifestyleStatus(`正在生成第 ${event.index + 1} 张图片...`)
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
                  setCurrentGenerationId(event.dbId)
                }
                
                setGeneratedImages(prev => {
                  const newImages = [...prev]
                  newImages[event.index] = event.image
                  return newImages
                })
                setGeneratedModelTypes(prev => {
                  const newTypes = [...prev]
                  newTypes[event.index] = event.modelType
                  return newTypes
                })
                setGeneratedGenModes(prev => {
                  const newModes = [...prev]
                  newModes[event.index] = 'simple'
                  return newModes
                })
                
                if (mode === 'processing') {
                  setMode('results')
                }
                break
              case 'image_error':
                updateImageSlot(taskId, event.index, {
                  status: 'failed',
                  error: event.error,
                })
                break
              case 'error':
                setLifestyleStatus(`错误: ${event.error}`)
                updateTaskStatus(taskId, 'failed')
                break
              case 'complete':
                setLifestyleStatus('')
                updateTaskStatus(taskId, 'completed')
                if (!firstDbId) setCurrentGenerationId(taskId)
                
                const completedTask = tasks.find(t => t.id === taskId)
                if (completedTask?.imageSlots) {
                  const outputUrls = completedTask.imageSlots
                    .filter(s => s.status === 'completed' && s.imageUrl)
                    .map(s => s.imageUrl!)
                  
                  if (outputUrls.length > 0) {
                    addGeneration({
                      id: firstDbId || taskId,
                      type: 'lifestyle',
                      inputImageUrl: productImage,
                      outputImageUrls: outputUrls,
                      outputModelTypes: completedTask.imageSlots.map(s => s.modelType || 'pro'),
                      outputGenModes: completedTask.imageSlots.map(s => s.genMode || 'simple'),
                      createdAt: new Date().toISOString(),
                      params: { type: 'lifestyle' },
                    })
                  }
                }
                refreshQuota()
                break
            }
          } catch (e) {
            console.warn('[Lifestyle] Failed to parse event:', jsonStr)
          }
        }
      }
    } catch (error: any) {
      setLifestyleStatus(`生成失败: ${error.message}`)
      updateTaskStatus(taskId, 'failed')
    }
  }

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `lifestyle-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full relative flex flex-col bg-black overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      <AnimatePresence mode="wait">
        {(mode === "camera" || mode === "review") && (
          <motion.div 
            key="camera-view"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 relative overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button
                onClick={mode === "review" ? handleRetake : () => router.push("/")}
                className="w-10 h-10 rounded-full bg-black/20 text-white backdrop-blur-md flex items-center justify-center"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
              <div className="px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-white text-xs font-medium">LifeStyle 街拍</span>
              </div>
              <div className="w-10" />
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative bg-zinc-900">
              {mode === "camera" ? (
                hasCamera && permissionChecked ? (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="absolute inset-0 w-full h-full object-cover"
                    videoConstraints={{ facingMode: "environment" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <div className="text-center text-zinc-500">
                      <Camera className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">相机未准备好，请从相册上传商品图</p>
                    </div>
                  </div>
                )
              ) : (
                <img src={capturedImage || ""} alt="Captured" className="w-full h-full object-cover" />
              )}
            </div>

            {/* Bottom Controls Area */}
            <div className="bg-black flex flex-col justify-end pb-safe pt-6 px-6 relative z-20 shrink-0 min-h-[9rem]">
              {mode === "review" ? (
                <div className="space-y-4 pb-4">
                  <div className="text-center text-white/60 text-xs px-4">
                    AI 将自动分析这件服装，并为您匹配最佳的街拍模特和城市场景
                  </div>
                  <div className="w-full flex justify-center">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleLifestyleGenerate}
                      className="w-full max-w-xs h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                    >
                      <Wand2 className="w-5 h-5" />
                      开始生成
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-8 pb-4">
                  {/* Album - Left of shutter */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">相册</span>
                  </button>

                  {/* Shutter */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
                  </button>

                  {/* Examples - Right of shutter */}
                  <button 
                    onClick={() => setShowProductPanel(true)}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">示例</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-20 h-20 mb-8 relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full animate-pulse" />
              <Loader2 className="w-full h-full text-purple-500 animate-spin" />
            </div>
            <h3 className="text-white text-2xl font-bold mb-4">正在创作街拍大片</h3>
            <p className="text-zinc-400 text-sm mb-12">{lifestyleStatus}</p>
            <button onClick={() => router.push("/")} className="px-8 py-3 rounded-full bg-white/10 text-white text-sm">
              在后台继续，返回首页
            </button>
            <BottomNav forceShow />
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            <div className="h-14 flex items-center justify-between px-4 border-b bg-white">
              <button onClick={handleRetake} className="flex items-center gap-2 font-medium">
                <ArrowLeft className="w-5 h-5" />
                <span>重拍</span>
              </button>
              <span className="font-bold">LifeStyle 成片</span>
              <div className="w-10" />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: LIFESTYLE_NUM_IMAGES }).map((_, i) => {
                  const url = generatedImages[i]
                  return (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-200 overflow-hidden relative" onClick={() => setSelectedResultIndex(i)}>
                      {url ? (
                        <Image src={url} alt="Result" fill className="object-cover" />
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
            <div className="p-6 pb-safe bg-white border-t">
              <button onClick={handleRetake} className="w-full h-14 rounded-xl bg-zinc-900 text-white font-bold">
                拍摄下一组
              </button>
            </div>
            <BottomNav forceShow />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Detail */}
      <AnimatePresence>
        {selectedResultIndex !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b">
              <button onClick={() => setSelectedResultIndex(null)}><X className="w-6 h-6" /></button>
              <span className="font-bold">详情</span>
              <button onClick={() => handleDownload(generatedImages[selectedResultIndex!])}><Download className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 bg-zinc-100 flex items-center justify-center p-4">
              <img src={generatedImages[selectedResultIndex!]} alt="Detail" className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Panel */}
      <AnimatePresence>
        {showProductPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setShowProductPanel(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-3xl z-50 flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <span className="font-bold text-lg">选择商品示例</span>
                <button onClick={() => setShowProductPanel(false)}><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-3">
                  {PRESET_PRODUCTS.map(p => (
                    <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-zinc-100 relative" onClick={() => {
                      setCapturedImage(p.imageUrl)
                      setProductFromPhone(false)
                      setMode("review")
                      setShowProductPanel(false)
                    }}>
                      <Image src={p.imageUrl} alt={p.name || 'Product'} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

export default function LifestylePage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <LifestylePageContent />
    </Suspense>
  )
}

