"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import Webcam from "react-webcam"
import { 
  ArrowLeft, Check, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Sparkles, Wand2, Camera, Home,
  Heart, Download, Pin, ZoomIn
} from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, fetchWithTimeout, ensureBase64 } from "@/lib/utils"
import { Asset, ModelStyle, ModelGender, ModelSubcategory, BackgroundSubcategory } from "@/types"
import Image from "next/image"
import { 
  PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_VIBES,
  MODEL_SUBCATEGORIES, BACKGROUND_SUBCATEGORIES
} from "@/data/presets"

const MODEL_STYLES: { id: ModelStyle; label: string }[] = [
  { id: "japanese", label: "日系" },
  { id: "korean", label: "韩系" },
  { id: "chinese", label: "中式" },
  { id: "western", label: "欧美" },
]

const MODEL_GENDERS: { id: ModelGender; label: string }[] = [
  { id: "female", label: "女" },
  { id: "male", label: "男" },
]

type CameraMode = "camera" | "review" | "processing" | "results"

export default function CameraPage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Mode and state
  const [mode, setMode] = useState<CameraMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Check camera permission on mount
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        // Check if permission API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
          } else if (result.state === 'denied') {
            setHasCamera(false)
          }
          // If 'prompt', we'll let the Webcam component handle it
        }
      } catch (e) {
        // Permission API not supported, let Webcam handle it
        console.log('Permission API not supported, using fallback')
      }
      setPermissionChecked(true)
    }
    
    checkCameraPermission()
  }, [])
  
  // Panel states
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showVibePanel, setShowVibePanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState("style")
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)
  const [selectedModelStyle, setSelectedModelStyle] = useState<ModelStyle | null>(null)
  const [selectedModelGender, setSelectedModelGender] = useState<ModelGender | null>(null)
  const [modelSubcategory, setModelSubcategory] = useState<ModelSubcategory | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<BackgroundSubcategory | null>(null)
  
  const { addGeneration, userModels, userBackgrounds, userVibes, addFavorite, removeFavorite, isFavorited, favorites } = useAssetStore()
  const { addTask, updateTaskStatus, tasks } = useGenerationTaskStore()
  
  // Helper to sort by pinned status
  const sortByPinned = (assets: Asset[]) => 
    [...assets].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
  
  // Filter presets by subcategory
  const filteredPresetModels = modelSubcategory 
    ? PRESET_MODELS.filter(m => m.subcategory === modelSubcategory)
    : PRESET_MODELS
  const filteredPresetBackgrounds = bgSubcategory
    ? PRESET_BACKGROUNDS.filter(b => b.subcategory === bgSubcategory)
    : PRESET_BACKGROUNDS
  
  // Merge user assets with presets (pinned first, then other user assets, then presets)
  const allModels = [...sortByPinned(userModels), ...filteredPresetModels]
  const allBackgrounds = [...sortByPinned(userBackgrounds), ...filteredPresetBackgrounds]
  const allVibes = [...sortByPinned(userVibes), ...PRESET_VIBES]
  
  // Get selected assets from merged arrays
  const activeModel = allModels.find(m => m.id === selectedModel)
  const activeBg = allBackgrounds.find(b => b.id === selectedBg)
  const activeVibe = allVibes.find(v => v.id === selectedVibe)
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setMode("review")
      }
    }
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setMode("review")
    }
  }, [])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
  }, [])
  
  const handleRetake = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return
    
    // Capture current selections BEFORE any async operations
    const currentModelStyle = selectedModelStyle
    const currentModelGender = selectedModelGender
    const currentModel = activeModel
    const currentBg = activeBg
    const currentVibe = activeVibe
    
    // Create task and switch to processing mode
    const params = {
      modelStyle: currentModelStyle || undefined,
      modelGender: currentModelGender || undefined,
      model: currentModel?.name,
      background: currentBg?.name,
      vibe: currentVibe?.name,
    }
    
    const taskId = addTask(capturedImage, params)
    updateTaskStatus(taskId, 'generating')
    setMode("processing")
    
    // Start background generation with captured values
    runBackgroundGeneration(
      taskId, 
      capturedImage,
      currentModelStyle,
      currentModelGender,
      currentModel,
      currentBg,
      currentVibe
    )
  }
  
  // Background generation function (runs async, doesn't block UI)
  // All parameters are passed explicitly to avoid closure issues
  const runBackgroundGeneration = async (
    taskId: string, 
    inputImage: string,
    modelStyle: ModelStyle | null,
    modelGender: ModelGender | null,
    model: Asset | undefined,
    background: Asset | undefined,
    vibe: Asset | undefined
  ) => {
    try {
      // Compress and prepare images before sending
      console.log("Preparing images...")
      console.log("Model selected:", model?.name, "URL:", model?.imageUrl?.substring(0, 50))
      console.log("Background selected:", background?.name)
      console.log("Vibe selected:", vibe?.name)
      
      const compressedProduct = await compressBase64Image(inputImage, 1024)
      
      // Convert URLs to base64 if needed (for preset assets)
      const [modelBase64, bgBase64, vibeBase64] = await Promise.all([
        ensureBase64(model?.imageUrl),
        ensureBase64(background?.imageUrl),
        ensureBase64(vibe?.imageUrl),
      ])
      
      console.log("Model base64 ready:", !!modelBase64, modelBase64 ? modelBase64.substring(0, 30) + "..." : "null")
      console.log("Background base64 ready:", !!bgBase64)
      console.log("Vibe base64 ready:", !!vibeBase64)
      
      console.log("Sending generation request...")
      const response = await fetchWithTimeout("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImage: compressedProduct,
          modelImage: modelBase64,
          modelStyle: modelStyle,
          modelGender: modelGender,
          backgroundImage: bgBase64,
          vibeImage: vibeBase64,
        }),
      }, 150000) // 150 second timeout
      
      const data = await response.json()
      
      if (data.success && data.images) {
        console.log(`Generation stats: ${data.stats?.successful}/${data.stats?.total} images in ${data.stats?.duration}ms`)
        
        // Update task with results
        updateTaskStatus(taskId, 'completed', data.images)
        
        // Save to IndexedDB/history
        const id = taskId
        await addGeneration({
          id,
          type: "camera_model",
          inputImageUrl: inputImage,
          outputImageUrls: data.images,
          createdAt: new Date().toISOString(),
          params: { 
            modelStyle: modelStyle || undefined,
            modelGender: modelGender || undefined,
            model: model?.name,
            background: background?.name,
            vibe: vibe?.name,
          },
        })
        
        // If still on processing mode for this task, show results
        if (mode === "processing") {
          setGeneratedImages(data.images)
          setCurrentGenerationId(id)
          setMode("results")
        }
      } else {
        throw new Error(data.error || "生成失败")
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || "生成失败")
      
      // Only alert if still on processing screen
      if (mode === "processing") {
        if (error.name === 'AbortError') {
          alert("生成超时，请重试。建议使用较小的图片。")
        } else {
          alert(error.message || "生成失败，请重试")
        }
        setMode("review")
      }
    }
  }
  
  // Handle return during processing - allow going home
  const handleReturnDuringProcessing = () => {
    router.push("/")
  }
  
  // Handle taking new photo during processing
  const handleNewPhotoDuringProcessing = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setMode("camera")
  }
  
  const handleReturn = () => {
    router.push("/")
  }
  
  // Handle favorite toggle for result images
  const handleResultFavorite = async (imageIndex: number) => {
    if (!currentGenerationId) return
    
    const currentlyFavorited = isFavorited(currentGenerationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === currentGenerationId && f.imageIndex === imageIndex
      )
      if (fav) {
        await removeFavorite(fav.id)
      }
    } else {
      await addFavorite({
        generationId: currentGenerationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => {
    sessionStorage.setItem('editImage', imageUrl)
    router.push("/edit")
  }
  
  // Handle download
  const handleDownload = async (url: string) => {
    try {
      let blob: Blob
      
      if (url.startsWith('data:')) {
        // Handle base64 data URL
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        // Handle regular URL
        const response = await fetch(url)
        blob = await response.blob()
      }
      
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `brand-camera-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      // Fallback to direct link
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.jpg`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  // Asset grid component
  const AssetGrid = ({ 
    items, 
    selectedId, 
    onSelect 
  }: { 
    items: Asset[]
    selectedId: string | null
    onSelect: (id: string) => void 
  }) => (
    <div className="grid grid-cols-3 gap-3 p-1 pb-20">
      {items.map(asset => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`aspect-square rounded-lg overflow-hidden relative border-2 transition-all group ${
            selectedId === asset.id 
              ? "border-blue-600 ring-2 ring-blue-200" 
              : "border-transparent hover:border-zinc-200"
          }`}
        >
          <Image src={asset.imageUrl} alt={asset.name || ""} fill className="object-cover" />
          {selectedId === asset.id && (
            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          )}
          {asset.isPinned && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm z-10">
              <Pin className="w-2.5 h-2.5" />
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
            <p className="text-[10px] text-white truncate text-center">{asset.name}</p>
          </div>
        </button>
      ))}
    </div>
  )
  
  return (
    <div className="h-full relative flex flex-col bg-black">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload}
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
            {/* Top Return Button */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={mode === "review" ? handleRetake : handleReturn}
                className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className="flex-1 relative">
              {mode === "camera" && hasCamera && permissionChecked ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : mode === "camera" && !permissionChecked ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                    <p className="text-sm">正在初始化相机...</p>
                  </div>
                </div>
              ) : mode === "camera" && !hasCamera ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">相机不可用</p>
                    <p className="text-xs mt-1">请使用下方上传按钮</p>
                  </div>
                </div>
              ) : (
                <img 
                  src={capturedImage || ""} 
                  alt="Captured" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              
              {/* Selection Badges Overlay */}
              <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {selectedModelGender && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    性别: {MODEL_GENDERS.find(g => g.id === selectedModelGender)?.label}
                  </span>
                )}
                {selectedModelStyle && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    风格: {MODEL_STYLES.find(s => s.id === selectedModelStyle)?.label}
                  </span>
                )}
                {activeModel && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    模特: {activeModel.name}
                  </span>
                )}
                {activeBg && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    背景: {activeBg.name}
                  </span>
                )}
                {activeVibe && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    氛围: {activeVibe.name}
                  </span>
                )}
              </div>

              {mode === "camera" && (
                <>
                  {/* Grid Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Focus Frame */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                    </div>
                  </div>
                  
                  <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                    拍摄您的商品
                  </div>
                </>
              )}
            </div>

            {/* Bottom Controls Area */}
            <div className="bg-black flex flex-col justify-end pb-safe pt-6 px-6 relative z-20 shrink-0 min-h-[9rem]">
              {mode === "review" ? (
                <div className="space-y-4 pb-4">
                  {/* Custom & Vibe buttons in review mode */}
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={() => setShowCustomPanel(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="text-sm">自定义</span>
                    </button>
                    
                    <button 
                      onClick={() => setShowVibePanel(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm">氛围</span>
                    </button>
                  </div>
                  
                  {/* Shoot It button */}
                  <div className="w-full flex justify-center">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleShootIt}
                      className="w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-around pb-4">
                  {/* Album */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors w-12"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px]">相册</span>
                  </button>

                  {/* Shutter */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform mx-4 disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
                  </button>

                  {/* Right Controls: Custom & Vibe */}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowCustomPanel(true)}
                      className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                        <SlidersHorizontal className="w-5 h-5" />
                      </div>
                      <span className="text-[10px]">自定义</span>
                    </button>
                    
                    <button 
                      onClick={() => setShowVibePanel(true)}
                      className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[10px]">氛围</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Slide-up Panel: Custom */}
            <AnimatePresence>
              {showCustomPanel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowCustomPanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">自定义配置</span>
                      <button 
                        onClick={() => setShowCustomPanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                      {[
                        { id: "style", label: "风格" },
                        { id: "model", label: "模特" },
                        { id: "bg", label: "背景" }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setActiveCustomTab(tab.id)}
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
                      {activeCustomTab === "style" && (
                        <div className="space-y-6">
                          {/* Gender Selection */}
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">模特性别</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {MODEL_GENDERS.map(gender => (
                                <button
                                  key={gender.id}
                                  onClick={() => {
                                    setSelectedModelGender(selectedModelGender === gender.id ? null : gender.id)
                                  }}
                                  className={`h-12 px-4 rounded-lg text-sm font-medium border transition-all flex items-center justify-between ${
                                    selectedModelGender === gender.id 
                                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                                      : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
                                  }`}
                                >
                                  {gender.label}
                                  {selectedModelGender === gender.id && <Check className="w-4 h-4" />}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Style Selection */}
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">模特风格</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {MODEL_STYLES.map(style => (
                                <button
                                  key={style.id}
                                  onClick={() => {
                                    setSelectedModelStyle(selectedModelStyle === style.id ? null : style.id)
                                  }}
                                  className={`h-12 px-4 rounded-lg text-sm font-medium border transition-all flex items-center justify-between ${
                                    selectedModelStyle === style.id 
                                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                                      : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
                                  }`}
                                >
                                  {style.label}
                                  {selectedModelStyle === style.id && <Check className="w-4 h-4" />}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <p className="text-xs text-zinc-400 text-center">选择性别和风格，AI 将自动匹配模特特征</p>
                        </div>
                      )}
                      {activeCustomTab === "model" && (
                        <div className="space-y-4">
                          {/* Model Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setModelSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !modelSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              全部
                            </button>
                            {MODEL_SUBCATEGORIES.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => setModelSubcategory(modelSubcategory === sub.id ? null : sub.id)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                  modelSubcategory === sub.id
                                    ? "bg-zinc-900 text-white"
                                    : "bg-white text-zinc-600 border border-zinc-200"
                                }`}
                              >
                                {sub.label}
                              </button>
                            ))}
                          </div>
                          <AssetGrid 
                            items={allModels} 
                            selectedId={selectedModel} 
                            onSelect={(id) => {
                              setSelectedModel(selectedModel === id ? null : id)
                            }} 
                          />
                        </div>
                      )}
                      {activeCustomTab === "bg" && (
                        <div className="space-y-4">
                          {/* Background Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setBgSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !bgSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              全部
                            </button>
                            {BACKGROUND_SUBCATEGORIES.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => setBgSubcategory(bgSubcategory === sub.id ? null : sub.id)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                  bgSubcategory === sub.id
                                    ? "bg-zinc-900 text-white"
                                    : "bg-white text-zinc-600 border border-zinc-200"
                                }`}
                              >
                                {sub.label}
                              </button>
                            ))}
                          </div>
                          <AssetGrid 
                            items={allBackgrounds} 
                            selectedId={selectedBg} 
                            onSelect={(id) => setSelectedBg(selectedBg === id ? null : id)} 
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Slide-up Panel: Vibe */}
            <AnimatePresence>
              {showVibePanel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowVibePanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[50%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">选择氛围</span>
                      <button 
                        onClick={() => setShowVibePanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      <AssetGrid 
                        items={allVibes} 
                        selectedId={selectedVibe} 
                        onSelect={(id) => setSelectedVibe(selectedVibe === id ? null : id)} 
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            
            <h3 className="text-white text-2xl font-bold mb-2">AI 正在拍摄...</h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              <p>分析商品光影...</p>
              {activeModel && <p>生成模特 {activeModel.name} ...</p>}
              {selectedModelStyle && !activeModel && (
                <p>匹配{MODEL_STYLES.find(s => s.id === selectedModelStyle)?.label}风格...</p>
              )}
              {activeBg && <p>渲染场景背景...</p>}
            </div>
            
            {/* Action buttons during processing */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-500 text-xs mb-4">生成将在后台继续，您可以：</p>
              <button
                onClick={handleNewPhotoDuringProcessing}
                className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Camera className="w-5 h-5" />
                拍摄新商品
              </button>
              <button
                onClick={handleReturnDuringProcessing}
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                返回主页
              </button>
            </div>
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            <div className="h-14 flex items-center px-4 border-b bg-white z-10">
              <button 
                onClick={handleRetake} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold ml-2">本次成片</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-10">
              {/* Product Images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-600 rounded-full" />
                    商品静物图
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {generatedImages.slice(0, 2).map((url, i) => (
                    <div 
                      key={i} 
                      className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                      onClick={() => setSelectedResultIndex(i)}
                    >
                      <Image src={url} alt="Result" fill className="object-cover" />
                      {/* Favorite button - always visible */}
                      <button 
                        className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                          currentGenerationId && isFavorited(currentGenerationId, i) 
                            ? "bg-red-500 text-white" 
                            : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResultFavorite(i)
                        }}
                      >
                        <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, i) ? "fill-current" : ""}`} />
                      </button>
                      {/* Type badge */}
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 rounded text-[10px] font-medium bg-blue-500 text-white">
                          产品
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-purple-600 rounded-full" />
                    模特展示图
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {generatedImages.slice(2, 4).map((url, i) => {
                    const actualIndex = i + 2
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(actualIndex)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        {/* Favorite button - always visible */}
                        <button 
                          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                            currentGenerationId && isFavorited(currentGenerationId, actualIndex) 
                              ? "bg-red-500 text-white" 
                              : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResultFavorite(actualIndex)
                          }}
                        >
                          <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, actualIndex) ? "fill-current" : ""}`} />
                        </button>
                        {/* Type badge */}
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500 text-white">
                            模特
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t shadow-up">
              <button 
                onClick={handleRetake}
                className="w-full h-12 text-lg rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                拍摄下一组
              </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && generatedImages[selectedResultIndex] && (
              <div className="fixed inset-0 z-50 bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                    <button
                      onClick={() => setSelectedResultIndex(null)}
                      className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-700" />
                    </button>
                    <span className="font-semibold text-zinc-900">详情</span>
                    <div className="w-10" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-zinc-100">
                    <div 
                      className="relative aspect-[4/5] bg-zinc-900 cursor-pointer group"
                      onClick={() => setFullscreenImage(generatedImages[selectedResultIndex])}
                    >
                      <Image 
                        src={generatedImages[selectedResultIndex]} 
                        alt="Detail" 
                        fill 
                        className="object-contain" 
                      />
                      {/* Zoom hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <ZoomIn className="w-6 h-6 text-zinc-700" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              selectedResultIndex < 2 
                                ? "bg-blue-100 text-blue-700" 
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {selectedResultIndex < 2 ? "产品展示" : "模特展示"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">
                            刚刚生成
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResultFavorite(selectedResultIndex)}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                              currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex)
                                ? "bg-red-50 border-red-200 text-red-500"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex) ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleDownload(generatedImages[selectedResultIndex])}
                            className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedResultIndex(null)
                          handleGoToEdit(generatedImages[selectedResultIndex])
                        }}
                        className="w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        去修图
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            {/* Close button */}
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Image with zoom */}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
              onPinchingStop={(ref) => {
                // Reset to scale 1 if zoomed out too much
                if (ref.state.scale < 1) {
                  ref.resetTransform()
                }
              }}
            >
              {({ resetTransform }) => (
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full"
                  >
                    <Image
                      src={fullscreenImage}
                      alt="Fullscreen"
                      fill
                      className="object-contain"
                      quality={100}
                      draggable={false}
                    />
                  </motion.div>
                </TransformComponent>
              )}
            </TransformWrapper>
            
            {/* Tap to close hint */}
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">双指缩放 · 双击重置 · 点击 × 关闭</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
