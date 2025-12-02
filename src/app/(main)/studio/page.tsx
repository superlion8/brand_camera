"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Upload, Loader2, Download, Heart, 
  Sun, Sparkles, Lightbulb, Zap, Home, FolderHeart, X, Camera
} from "lucide-react"
import { useRouter } from "next/navigation"
import Webcam from "react-webcam"
import { fileToBase64, compressBase64Image, generateId, ensureBase64 } from "@/lib/utils"
import { useAssetStore } from "@/stores/assetStore"
import { PRESET_PRODUCTS } from "@/data/presets"
import Image from "next/image"

// Light types - compact version
const LIGHT_TYPES = [
  { id: 'Softbox', label: '柔光', icon: Lightbulb },
  { id: 'Sunlight', label: '自然', icon: Sun },
  { id: 'Dramatic', label: '戏剧', icon: Sparkles },
  { id: 'Neon', label: '霓虹', icon: Zap },
]

// Aspect ratios
const ASPECT_RATIOS = [
  { id: 'original', label: '原图' },
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
]

// Light direction positions (relative to center)
const LIGHT_DIRECTIONS = [
  { id: 'top-left', x: 0, y: 0 },
  { id: 'top', x: 1, y: 0 },
  { id: 'top-right', x: 2, y: 0 },
  { id: 'left', x: 0, y: 1 },
  { id: 'front', x: 1, y: 1 },
  { id: 'right', x: 2, y: 1 },
  { id: 'bottom-left', x: 0, y: 2 },
  { id: 'bottom', x: 1, y: 2 },
  { id: 'bottom-right', x: 2, y: 2 },
]

// Preset background colors - pairs for gradients
const PRESET_BG_COLORS = [
  { id: 'warm', colors: ['#FFE4B5', '#DEB887'], label: '暖金' },
  { id: 'cool', colors: ['#87CEEB', '#B0E0E6'], label: '冷蓝' },
  { id: 'neutral', colors: ['#D3D3D3', '#A9A9A9'], label: '中灰' },
  { id: 'rose', colors: ['#DDA0DD', '#DA70D6'], label: '玫瑰' },
]

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

// Hex to HSV
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, v]
}

type StudioMode = 'upload' | 'camera' | 'settings' | 'processing' | 'results'

export default function StudioPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const webcamRef = useRef<Webcam>(null)
  
  const [mode, setMode] = useState<StudioMode>('upload')
  const [productImage, setProductImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  
  // Camera state
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Settings
  const [lightType, setLightType] = useState('Softbox')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [lightDirection, setLightDirection] = useState('front')
  const [bgColor, setBgColor] = useState('#FFFFFF')
  
  // Color picker state (HSV)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [brightness, setBrightness] = useState(1)
  
  const { addGeneration, addFavorite, removeFavorite, isFavorited, favorites, userProducts } = useAssetStore()
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  
  // Update bgColor when HSV changes
  const updateColorFromHSV = useCallback((h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v)
    setBgColor(rgbToHex(r, g, b))
  }, [])
  
  // Handle saturation/brightness picker
  const handleSBPick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = colorPickerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    
    setSaturation(x)
    setBrightness(1 - y)
    updateColorFromHSV(hue, x, 1 - y)
  }, [hue, updateColorFromHSV])
  
  // Handle hue slider
  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseFloat(e.target.value)
    setHue(h)
    updateColorFromHSV(h, saturation, brightness)
  }, [saturation, brightness, updateColorFromHSV])
  
  // Set color from preset
  const setPresetColor = useCallback((hex: string) => {
    const [h, s, v] = hexToHsv(hex)
    setHue(h)
    setSaturation(s)
    setBrightness(v)
    setBgColor(hex)
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setProductImage(base64)
      setMode('settings')
    }
  }, [])
  
  const handleSelectFromAsset = useCallback(async (imageUrl: string) => {
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setProductImage(base64)
        setShowProductPanel(false)
        setMode('settings')
      }
    } catch (e) {
      console.error('Failed to load asset:', e)
    }
  }, [])
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setProductImage(imageSrc)
        setMode('settings')
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
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleGenerate = async () => {
    if (!productImage) return
    
    setMode('processing')
    setGeneratedImages([])
    setGeneratedModelTypes([])
    
    try {
      const compressedProduct = await compressBase64Image(productImage, 1024)
      
      const basePayload = {
        productImage: compressedProduct,
        lightType,
        lightDirection,
        lightColor: bgColor, // background color
        aspectRatio,
      }
      
      // Stagger 2 requests
      const staggerDelay = 1000
      
      const createDelayedRequest = (index: number, delayMs: number) => {
        return new Promise<Response>((resolve, reject) => {
          setTimeout(() => {
            console.log(`Starting Studio ${index + 1}...`)
            fetch("/api/generate-studio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...basePayload, index }),
            }).then(resolve).catch(reject)
          }, delayMs)
        })
      }
      
      const requests = [
        createDelayedRequest(0, 0),
        createDelayedRequest(1, staggerDelay),
      ]
      
      const responses = await Promise.allSettled(requests)
      
      const images: (string | null)[] = [null, null]
      const modelTypes: (('pro' | 'flash') | null)[] = [null, null]
      let usedPrompt: string = ''
      
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          try {
            const result = await response.value.json()
            if (result.success && result.image) {
              images[result.index] = result.image
              modelTypes[result.index] = result.modelType
              if (result.prompt && !usedPrompt) {
                usedPrompt = result.prompt
              }
              console.log(`Studio ${result.index + 1}: ✓ (${result.modelType}, ${result.duration}ms)`)
            }
          } catch (e) {
            console.log('Parse error')
          }
        }
      }
      
      const finalImages = images.filter((img): img is string => img !== null)
      const finalModelTypes = modelTypes.filter((t): t is 'pro' | 'flash' => t !== null)
      
      if (finalImages.length > 0) {
        const id = generateId()
        setCurrentGenerationId(id)
        setGeneratedImages(finalImages)
        setGeneratedModelTypes(finalModelTypes)
        
        await addGeneration({
          id,
          type: "studio",
          inputImageUrl: productImage,
          outputImageUrls: finalImages,
          prompt: usedPrompt || undefined,
          createdAt: new Date().toISOString(),
          params: { lightType, lightDirection, lightColor: bgColor, aspectRatio },
        })
        
        setMode('results')
      } else {
        alert('生成失败，请重试')
        setMode('settings')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      alert(error.message || '生成失败')
      setMode('settings')
    }
  }
  
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `studio-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }
  
  const handleFavorite = async (imageIndex: number) => {
    if (!currentGenerationId) return
    
    const currentlyFavorited = isFavorited(currentGenerationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === currentGenerationId && f.imageIndex === imageIndex
      )
      if (fav) await removeFavorite(fav.id)
    } else {
      await addFavorite({
        generationId: currentGenerationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  const handleReset = () => {
    setProductImage(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setMode('upload')
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
        <span className="font-semibold ml-2">商品影棚</span>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload}
      />
      
      <AnimatePresence mode="wait">
        {/* Upload Mode */}
        {mode === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-sm space-y-3">
              {/* Camera capture */}
              <button
                onClick={() => setMode('camera')}
                className="w-full h-24 rounded-2xl bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-3 text-white"
              >
                <Camera className="w-7 h-7" />
                <div className="text-left">
                  <p className="font-semibold">拍摄商品</p>
                  <p className="text-xs text-amber-100">使用相机拍照</p>
                </div>
              </button>
              
              {/* Upload from album */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 rounded-2xl border-2 border-zinc-200 bg-white hover:border-amber-500 transition-colors flex items-center justify-center gap-3"
              >
                <Upload className="w-5 h-5 text-zinc-500" />
                <div className="text-left">
                  <p className="font-medium text-zinc-700">从相册上传</p>
                  <p className="text-xs text-zinc-500">JPG、PNG</p>
                </div>
              </button>
              
              {/* Select from asset library */}
              <button
                onClick={() => setShowProductPanel(true)}
                className="w-full h-20 rounded-2xl border-2 border-zinc-200 bg-white hover:border-amber-500 transition-colors flex items-center justify-center gap-3"
              >
                <FolderHeart className="w-5 h-5 text-zinc-500" />
                <div className="text-left">
                  <p className="font-medium text-zinc-700">从资产库选择</p>
                  <p className="text-xs text-zinc-500">官方示例 · 我的商品</p>
                </div>
              </button>
            </div>
            
            <p className="text-sm text-zinc-400 mt-6 text-center max-w-xs">
              上传商品图片，AI将生成专业影棚级别的商品展示图
            </p>
          </motion.div>
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
            {/* Back button */}
            <button
              onClick={() => setMode('upload')}
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
                        setMode('upload')
                        setTimeout(() => fileInputRef.current?.click(), 100)
                      }}
                      className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm"
                    >
                      从相册上传
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
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400" />
                </div>
              </div>
              
              <div className="absolute top-16 left-0 right-0 text-center text-white/80 text-sm font-medium">
                将商品放入框内拍摄
              </div>
            </div>
            
            {/* Capture button */}
            <div className="bg-black py-8 flex justify-center">
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full border-4 border-amber-400/50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-16 h-16 bg-amber-400 rounded-full" />
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Settings Mode */}
        {mode === 'settings' && productImage && (
          <motion.div
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto"
          >
            {/* Preview */}
            <div className="p-4">
              <div className="relative aspect-square bg-zinc-200 rounded-xl overflow-hidden max-w-xs mx-auto">
                <Image src={productImage} alt="Product" fill className="object-contain" />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 px-3 py-1 bg-white/90 rounded-full text-xs font-medium hover:bg-white"
                >
                  更换图片
                </button>
              </div>
            </div>
            
            {/* Settings */}
            <div className="px-4 pb-40 space-y-5">
              {/* Light Type - Single row */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">光源类型</h3>
                <div className="flex gap-2">
                  {LIGHT_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setLightType(type.id)}
                        className={`flex-1 py-2.5 px-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          lightType === type.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${lightType === type.id ? 'text-amber-600' : 'text-zinc-400'}`} />
                        <span className={`text-xs font-medium ${lightType === type.id ? 'text-amber-700' : 'text-zinc-600'}`}>
                          {type.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Aspect Ratio */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">画面比例</h3>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        aspectRatio === ratio.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Light Direction */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">光源方向</h3>
                <div className="bg-white rounded-xl p-3 border border-zinc-200">
                  <div className="grid grid-cols-3 gap-1.5 max-w-[140px] mx-auto">
                    {LIGHT_DIRECTIONS.map(dir => (
                      <button
                        key={dir.id}
                        onClick={() => setLightDirection(dir.id)}
                        className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                          dir.id === 'front'
                            ? 'bg-zinc-800 text-white'
                            : lightDirection === dir.id
                              ? 'bg-yellow-400 shadow-md'
                              : 'bg-zinc-100 hover:bg-zinc-200'
                        }`}
                      >
                        {dir.id === 'front' ? (
                          <span className="text-sm">📦</span>
                        ) : lightDirection === dir.id ? (
                          <Sun className="w-4 h-4 text-yellow-800" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Background Color - Advanced picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-700">背景颜色</h3>
                  <div className="flex items-center gap-2">
                    {/* Upload custom background */}
                    <button className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center hover:border-zinc-400">
                      <Upload className="w-3 h-3 text-zinc-400" />
                    </button>
                    {/* Preset color pairs */}
                    {PRESET_BG_COLORS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setPresetColor(preset.colors[0])}
                        className="w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden"
                        style={{ 
                          background: `linear-gradient(135deg, ${preset.colors[0]} 50%, ${preset.colors[1]} 50%)`
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="bg-zinc-900 rounded-2xl p-3 space-y-3">
                  {/* Saturation/Brightness picker */}
                  <div
                    ref={colorPickerRef}
                    onClick={handleSBPick}
                    onMouseMove={(e) => e.buttons === 1 && handleSBPick(e)}
                    onTouchMove={handleSBPick}
                    className="relative h-32 rounded-xl cursor-crosshair overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${hue * 360}, 100%, 50%))
                      `
                    }}
                  >
                    {/* Picker indicator */}
                    <div
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        left: `calc(${saturation * 100}% - 8px)`,
                        top: `calc(${(1 - brightness) * 100}% - 8px)`,
                        backgroundColor: bgColor,
                      }}
                    />
                  </div>
                  
                  {/* Hue slider */}
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={hue}
                      onChange={handleHueChange}
                      className="w-full h-3 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      }}
                    />
                    {/* Custom thumb indicator */}
                    <div
                      className="absolute top-0 w-4 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                      style={{
                        left: `calc(${hue * 100}% - 8px)`,
                        backgroundColor: `hsl(${hue * 360}, 100%, 50%)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Generate Button - positioned above bottom nav */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
              <button
                onClick={handleGenerate}
                className="w-full h-14 bg-amber-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98] transition-all shadow-lg shadow-amber-200"
              >
                <Sparkles className="w-6 h-6" />
                开始拍摄
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
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800 mb-2">AI 影棚拍摄中...</h3>
            <p className="text-zinc-500 text-sm">正在生成专业商品照片</p>
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
            <div className="p-4 pb-32">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成结果</h3>
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((url, i) => (
                  <div 
                    key={i}
                    className="relative aspect-square bg-zinc-100 rounded-xl overflow-hidden"
                  >
                    <Image src={url} alt={`Result ${i + 1}`} fill className="object-cover" />
                    
                    {/* Model type badge */}
                    {generatedModelTypes[i] === 'flash' && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] rounded font-medium">
                        2.5
                      </span>
                    )}
                    
                    {/* Actions */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => handleFavorite(i)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          currentGenerationId && isFavorited(currentGenerationId, i)
                            ? 'bg-red-500 text-white'
                            : 'bg-white/90 text-zinc-600'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, i) ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDownload(url)}
                        className="w-8 h-8 rounded-full bg-white/90 text-zinc-600 flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-3">
              <button
                onClick={() => setMode('settings')}
                className="flex-1 h-12 border border-zinc-200 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
              >
                调整参数
              </button>
              <button
                onClick={handleReset}
                className="flex-1 h-12 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
              >
                拍摄新商品
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
                <span className="font-semibold">选择商品</span>
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
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
                {productSourceTab === 'preset' ? (
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all bg-white"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
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
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-amber-500 transition-all bg-white"
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
                    <p className="text-sm">暂无我的商品</p>
                    <p className="text-xs mt-1">在品牌资产中上传商品图片</p>
                    <button
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600"
                    >
                      去上传
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

