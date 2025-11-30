"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, Check, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Sparkles, Wand2, Camera 
} from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId } from "@/lib/utils"
import { Asset, ModelStyle } from "@/types"
import Image from "next/image"

const MODEL_STYLES: { id: ModelStyle; label: string }[] = [
  { id: "japanese", label: "日系" },
  { id: "korean", label: "韩系" },
  { id: "chinese", label: "中式" },
  { id: "western", label: "欧美" },
]

// Demo preset assets
const presetModels: Asset[] = [
  { id: "pm1", type: "model", name: "Japanese Style", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", styleCategory: "japanese" },
  { id: "pm2", type: "model", name: "Korean Clean", imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400", styleCategory: "korean" },
  { id: "pm3", type: "model", name: "Western Casual", imageUrl: "https://images.unsplash.com/photo-1529139574466-a302d2052505?w=400", styleCategory: "western" },
  { id: "pm4", type: "model", name: "Chinese Modern", imageUrl: "https://images.unsplash.com/photo-1594751684246-34925515a838?w=400", styleCategory: "chinese" },
]

const presetBackgrounds: Asset[] = [
  { id: "bg1", type: "background", name: "Minimal Studio", imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400" },
  { id: "bg2", type: "background", name: "Urban Street", imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400" },
  { id: "bg3", type: "background", name: "Nature Soft", imageUrl: "https://images.unsplash.com/photo-1518173946687-a4c88928d9fd?w=400" },
]

const presetVibes: Asset[] = [
  { id: "v1", type: "vibe", name: "Warm & Cozy", imageUrl: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400" },
  { id: "v2", type: "vibe", name: "Cool & Edgy", imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400" },
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
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  
  // Panel states
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showVibePanel, setShowVibePanel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState("style")
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)
  const [selectedModelStyle, setSelectedModelStyle] = useState<ModelStyle | null>(null)
  
  const { addGeneration } = useAssetStore()
  
  // Get selected assets
  const activeModel = presetModels.find(m => m.id === selectedModel)
  const activeBg = presetBackgrounds.find(b => b.id === selectedBg)
  const activeVibe = presetVibes.find(v => v.id === selectedVibe)
  
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
  }, [])
  
  const handleRetake = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return
    
    setMode("processing")
    
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImage: capturedImage,
          modelImage: activeModel?.imageUrl,
          modelStyle: selectedModelStyle,
          backgroundImage: activeBg?.imageUrl,
          vibeImage: activeVibe?.imageUrl,
        }),
      })
      
      const data = await response.json()
      
      if (data.success && data.images) {
        setGeneratedImages(data.images)
        
        // Save to history
        const id = generateId()
        await addGeneration({
          id,
          type: "camera_model",
          inputImageUrl: capturedImage,
          outputImageUrls: data.images,
          createdAt: new Date().toISOString(),
          params: { 
            modelStyle: selectedModelStyle,
            model: activeModel?.name,
            background: activeBg?.name,
            vibe: activeVibe?.name,
          },
        })
        
        setMode("results")
      } else {
        throw new Error(data.error || "生成失败")
      }
    } catch (error) {
      console.error("Generation error:", error)
      alert("生成失败，请重试")
      setMode("review")
    }
  }
  
  const handleReturn = () => {
    router.push("/gallery")
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
                {mode === "review" ? <X className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
              </button>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className="flex-1 relative">
              {mode === "camera" && hasCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
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
            <div className="bg-black flex flex-col justify-end pb-safe pt-8 px-8 relative z-20 shrink-0 min-h-[9rem]">
              {mode === "review" ? (
                <div className="w-full flex justify-center pb-4">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleShootIt}
                    className="w-48 h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
                  >
                    <Wand2 className="w-5 h-5" />
                    Shoot It
                  </motion.button>
                </div>
              ) : (
                <div className="flex items-center justify-around">
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
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {MODEL_STYLES.map(style => (
                              <button
                                key={style.id}
                                onClick={() => {
                                  setSelectedModelStyle(selectedModelStyle === style.id ? null : style.id)
                                  if (selectedModelStyle !== style.id) setSelectedModel(null)
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
                          <p className="text-xs text-zinc-400 text-center mt-4">选择一种风格，AI 将自动匹配模特特征</p>
                        </div>
                      )}
                      {activeCustomTab === "model" && (
                        <AssetGrid 
                          items={presetModels} 
                          selectedId={selectedModel} 
                          onSelect={(id) => {
                            const newId = selectedModel === id ? null : id
                            setSelectedModel(newId)
                            if (newId) setSelectedModelStyle(null)
                          }} 
                        />
                      )}
                      {activeCustomTab === "bg" && (
                        <AssetGrid 
                          items={presetBackgrounds} 
                          selectedId={selectedBg} 
                          onSelect={(id) => setSelectedBg(selectedBg === id ? null : id)} 
                        />
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
                        items={presetVibes} 
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
            <div className="text-zinc-400 space-y-1 text-sm">
              <p>分析商品光影...</p>
              {activeModel && <p>生成模特 {activeModel.name} ...</p>}
              {selectedModelStyle && !activeModel && (
                <p>匹配{MODEL_STYLES.find(s => s.id === selectedModelStyle)?.label}风格...</p>
              )}
              {activeBg && <p>渲染场景背景...</p>}
            </div>
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden"
          >
            <div className="h-14 flex items-center px-4 border-b bg-white dark:bg-zinc-900 z-10">
              <button 
                onClick={handleRetake} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
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
                    <div key={i} className="group relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden shadow-sm border border-zinc-200">
                      <Image src={url} alt="Result" fill className="object-cover" />
                      <div className="absolute top-2 right-2 bg-white/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <Check className="w-3 h-3 text-green-600" />
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
                  {generatedImages.slice(2, 4).map((url, i) => (
                    <div key={i} className="group relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden shadow-sm border border-zinc-200">
                      <Image src={url} alt="Result" fill className="object-cover" />
                      <div className="absolute top-2 right-2 bg-white/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 border-t shadow-up">
              <button 
                onClick={handleRetake}
                className="w-full h-12 text-lg rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                拍摄下一组
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
