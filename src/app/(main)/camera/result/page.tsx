"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Download, Heart, RotateCcw, Check, X, Camera, Sparkles } from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { generateId } from "@/lib/utils"

export default function ResultPage() {
  const router = useRouter()
  const { capturedImage, generatedImages, modelStyle, reset } = useCameraStore()
  const { addGeneration, addFavorite, isFavorited, favorites, removeFavorite } = useAssetStore()
  const [isSaved, setIsSaved] = useState(false)
  const [generationId, setGenerationId] = useState<string>("")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  
  useEffect(() => {
    if (!capturedImage || generatedImages.length === 0) {
      router.replace("/camera")
      return
    }
    
    // Auto save generation on mount
    const saveGeneration = async () => {
      if (isSaved) return
      
      const id = generateId()
      setGenerationId(id)
      
      await addGeneration({
        id,
        type: "camera_model",
        inputImageUrl: capturedImage,
        outputImageUrls: generatedImages,
        createdAt: new Date().toISOString(),
        params: { modelStyle },
      })
      
      setIsSaved(true)
    }
    
    saveGeneration()
  }, [capturedImage, generatedImages, router, addGeneration, isSaved, modelStyle])
  
  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const link = document.createElement("a")
      link.href = imageUrl
      link.download = `brand-camera-${Date.now()}-${index}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Download error:", error)
    }
  }
  
  const handleFavorite = async (imageIndex: number) => {
    if (!generationId) return
    
    const currentlyFavorited = isFavorited(generationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        f => f.generationId === generationId && f.imageIndex === imageIndex
      )
      if (fav) {
        await removeFavorite(fav.id)
      }
    } else {
      await addFavorite({
        generationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  const handleDone = () => {
    reset()
    router.push("/gallery")
  }
  
  const handleAgain = () => {
    router.push("/camera/preview")
  }
  
  if (!capturedImage || generatedImages.length === 0) return null
  
  // Separate product images (first 2) and model images (last 2)
  const productImages = generatedImages.slice(0, 2)
  const modelImages = generatedImages.slice(2, 4)
  
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 glass-dark border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4 pt-safe">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-semibold">生成完成</h1>
          <button 
            onClick={handleDone}
            className="text-accent text-sm font-medium"
          >
            完成
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Saved indicator */}
        {isSaved && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-white/80">已自动保存到图片资产</span>
          </div>
        )}
        
        {/* Product images */}
        {productImages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-white/60" />
              <h3 className="text-white/60 text-xs font-semibold uppercase">商品图</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {productImages.map((image, index) => (
                <ResultImageCard
                  key={`product-${index}`}
                  imageUrl={image}
                  originalUrl={capturedImage}
                  imageIndex={index}
                  generationId={generationId}
                  onDownload={() => handleDownload(image, index)}
                  onFavorite={() => handleFavorite(index)}
                  onClick={() => setSelectedIndex(index)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Model images */}
        {modelImages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-white/60 text-xs font-semibold uppercase">模特展示图</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modelImages.map((image, index) => (
                <ResultImageCard
                  key={`model-${index}`}
                  imageUrl={image}
                  originalUrl={capturedImage}
                  imageIndex={index + 2}
                  generationId={generationId}
                  onDownload={() => handleDownload(image, index + 2)}
                  onFavorite={() => handleFavorite(index + 2)}
                  onClick={() => setSelectedIndex(index + 2)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* If we only have generic images (less than 4) */}
        {productImages.length === 0 && modelImages.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {generatedImages.map((image, index) => (
              <ResultImageCard
                key={index}
                imageUrl={image}
                originalUrl={capturedImage}
                imageIndex={index}
                generationId={generationId}
                onDownload={() => handleDownload(image, index)}
                onFavorite={() => handleFavorite(index)}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom actions */}
      <div className="sticky bottom-0 p-4 pb-safe glass-dark">
        <button
          onClick={handleAgain}
          className="w-full h-12 rounded-full glass font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <RotateCcw className="w-4 h-4" />
          再来一次
        </button>
      </div>
      
      {/* Detail Modal */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto" onClick={() => setSelectedIndex(null)}>
          <div className="sticky top-0 z-10 glass-dark px-4 py-3 flex items-center justify-between border-b border-white/10">
            <button
              onClick={() => setSelectedIndex(null)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h3 className="text-white font-bold">详情</h3>
            <div className="w-10" />
          </div>
          
          <div className="px-4 py-6" onClick={(e) => e.stopPropagation()}>
            {/* Generated Image */}
            <div className="mb-6">
              <p className="text-white/60 text-xs font-semibold mb-2 uppercase">AI生成</p>
              <div className="rounded-2xl overflow-hidden">
                <img
                  src={generatedImages[selectedIndex]}
                  alt="Generated"
                  className="w-full"
                />
              </div>
            </div>
            
            {/* Original Image */}
            <div className="mb-6">
              <p className="text-white/60 text-xs font-semibold mb-2 uppercase">原始照片</p>
              <div className="rounded-2xl overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Original"
                  className="w-full"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(generatedImages[selectedIndex], selectedIndex)}
                className="flex-1 h-12 rounded-full glass font-medium text-white flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                下载
              </button>
              <button
                onClick={() => handleFavorite(selectedIndex)}
                className={`flex-1 h-12 rounded-full font-medium flex items-center justify-center gap-2 ${
                  isFavorited(generationId, selectedIndex)
                    ? "bg-red-500 text-white"
                    : "glass text-white"
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorited(generationId, selectedIndex) ? "fill-current" : ""}`} />
                {isFavorited(generationId, selectedIndex) ? "已收藏" : "收藏"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultImageCard({
  imageUrl,
  originalUrl,
  imageIndex,
  generationId,
  onDownload,
  onFavorite,
  onClick,
}: {
  imageUrl: string
  originalUrl: string
  imageIndex: number
  generationId: string
  onDownload: () => void
  onFavorite: () => void
  onClick: () => void
}) {
  const { isFavorited } = useAssetStore()
  const currentlyFavorited = generationId ? isFavorited(generationId, imageIndex) : false
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden bg-white/5 group cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="aspect-[3/4]">
        <Image
          src={imageUrl}
          alt="Generated image"
          fill
          className="object-cover"
        />
      </div>
      
      {/* Original thumbnail */}
      <div className="photo-thumbnail">
        <Image
          src={originalUrl}
          alt="Original"
          fill
          className="object-cover"
        />
      </div>
      
      {/* Actions overlay */}
      <div className="image-overlay">
        <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-white"
          >
            <Heart className={`w-5 h-5 ${currentlyFavorited ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
      </div>
      
      {/* Favorite indicator */}
      {currentlyFavorited && (
        <div className="absolute top-3 right-3">
          <Heart className="w-5 h-5 fill-red-500 text-red-500" />
        </div>
      )}
    </div>
  )
}
