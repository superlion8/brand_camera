"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Upload, Loader2, Download, Heart, 
  Sun, Sparkles, Lightbulb, Zap, Home
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, compressBase64Image, generateId } from "@/lib/utils"
import { useAssetStore } from "@/stores/assetStore"
import Image from "next/image"

// Light types
const LIGHT_TYPES = [
  { id: 'Softbox', label: '柔光箱', icon: Lightbulb, desc: '柔和均匀的光线' },
  { id: 'Sunlight', label: '自然光', icon: Sun, desc: '温暖自然的阳光' },
  { id: 'Dramatic', label: '戏剧光', icon: Sparkles, desc: '强对比高光影' },
  { id: 'Neon', label: '霓虹光', icon: Zap, desc: '炫彩霓虹效果' },
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
  { id: 'top-left', label: '左上', x: 0, y: 0 },
  { id: 'top', label: '顶部', x: 1, y: 0 },
  { id: 'top-right', label: '右上', x: 2, y: 0 },
  { id: 'left', label: '左侧', x: 0, y: 1 },
  { id: 'front', label: '正面', x: 1, y: 1 },
  { id: 'right', label: '右侧', x: 2, y: 1 },
  { id: 'bottom-left', label: '左下', x: 0, y: 2 },
  { id: 'bottom', label: '底部', x: 1, y: 2 },
  { id: 'bottom-right', label: '右下', x: 2, y: 2 },
]

// Preset colors
const PRESET_COLORS = [
  '#FFFFFF', // White
  '#FFF5E6', // Warm white
  '#E6F3FF', // Cool white
  '#FFE4E1', // Rose
  '#E6FFE6', // Green tint
  '#FFE4B5', // Golden
  '#E6E6FA', // Lavender
  '#87CEEB', // Sky blue
]

type StudioMode = 'upload' | 'settings' | 'processing' | 'results'

export default function StudioPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [mode, setMode] = useState<StudioMode>('upload')
  const [productImage, setProductImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  
  // Settings
  const [lightType, setLightType] = useState('Softbox')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [lightDirection, setLightDirection] = useState('front')
  const [lightColor, setLightColor] = useState('#FFFFFF')
  
  const { addGeneration, addFavorite, removeFavorite, isFavorited, favorites } = useAssetStore()
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setProductImage(base64)
      setMode('settings')
    }
  }, [])
  
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
        lightColor,
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
      
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          try {
            const result = await response.value.json()
            if (result.success && result.image) {
              images[result.index] = result.image
              modelTypes[result.index] = result.modelType
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
          createdAt: new Date().toISOString(),
          params: { lightType, lightDirection, lightColor, aspectRatio },
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
        <span className="font-semibold ml-2">AI商品影棚</span>
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
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50/50 transition-colors flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-zinc-700">上传商品图片</p>
                <p className="text-sm text-zinc-500 mt-1">支持 JPG、PNG 格式</p>
              </div>
            </button>
            
            <p className="text-sm text-zinc-400 mt-6 text-center max-w-xs">
              上传商品图片，AI将为您生成专业影棚级别的商品展示图
            </p>
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
            <div className="px-4 pb-32 space-y-6">
              {/* Light Type */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">光源类型</h3>
                <div className="grid grid-cols-2 gap-3">
                  {LIGHT_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setLightType(type.id)}
                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                          lightType === type.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${lightType === type.id ? 'text-blue-600' : 'text-zinc-400'}`} />
                        <p className={`text-sm font-medium ${lightType === type.id ? 'text-blue-700' : 'text-zinc-700'}`}>
                          {type.label}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">{type.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Aspect Ratio */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">画面比例</h3>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">光源方向</h3>
                <div className="bg-white rounded-xl p-4 border border-zinc-200">
                  <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
                    {LIGHT_DIRECTIONS.map(dir => (
                      <button
                        key={dir.id}
                        onClick={() => setLightDirection(dir.id)}
                        className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                          dir.id === 'front'
                            ? 'bg-zinc-800 text-white text-xs'
                            : lightDirection === dir.id
                              ? 'bg-yellow-400 shadow-lg shadow-yellow-200'
                              : 'bg-zinc-100 hover:bg-zinc-200'
                        }`}
                      >
                        {dir.id === 'front' ? (
                          <span>📦</span>
                        ) : lightDirection === dir.id ? (
                          <Sun className="w-5 h-5 text-yellow-800" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-zinc-300" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 text-center mt-3">
                    点击选择光源位置，中心为商品
                  </p>
                </div>
              </div>
              
              {/* Light Color */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">光源颜色</h3>
                <div className="bg-white rounded-xl p-4 border border-zinc-200">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setLightColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          lightColor === color
                            ? 'border-blue-500 scale-110'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="flex-1 h-10 px-3 border border-zinc-200 rounded-lg text-sm font-mono"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Generate Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
              <button
                onClick={handleGenerate}
                className="w-full h-12 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                生成影棚照片
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
                className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                拍摄新商品
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

