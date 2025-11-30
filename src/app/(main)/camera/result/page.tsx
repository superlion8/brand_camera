"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Download, Heart, ArrowLeft, Check, Camera, Sparkles, Save } from "lucide-react"
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
  
  const handleNextShoot = () => {
    reset()
    router.push("/camera")
  }
  
  if (!capturedImage || generatedImages.length === 0) return null
  
  // Separate product images (first 2) and model images (last 2)
  const productImages = generatedImages.slice(0, 2)
  const modelImages = generatedImages.slice(2, 4)
  
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b bg-white dark:bg-zinc-900 z-10">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
        </button>
        <span className="font-semibold ml-2 text-zinc-900 dark:text-white">本次成片</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-10">
        {/* Saved indicator */}
        {isSaved && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4" />
            <span>已自动保存到图片资产</span>
          </div>
        )}
        
        {/* Product images */}
        {productImages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full" />
                商品静物图
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {productImages.map((image, index) => (
                <ResultImageCard
                  key={`product-${index}`}
                  imageUrl={image}
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
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-600 rounded-full" />
                模特展示图
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modelImages.map((image, index) => (
                <ResultImageCard
                  key={`model-${index}`}
                  imageUrl={image}
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
      </div>
      
      {/* Bottom action */}
      <div className="p-4 bg-white dark:bg-zinc-900 border-t shadow-up">
        <button
          onClick={handleNextShoot}
          className="w-full h-12 text-lg rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          拍摄下一组
        </button>
      </div>
      
      {/* Detail Dialog */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Dialog Header */}
            <div className="h-14 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <button
                onClick={() => setSelectedIndex(null)}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <span className="font-semibold text-white">详情</span>
              <div className="w-10" />
            </div>
            
            {/* Dialog Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-[4/5] bg-zinc-900">
                <Image
                  src={generatedImages[selectedIndex]}
                  alt="Detail"
                  fill
                  className="object-contain"
                />
              </div>
              
              <div className="p-4 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">
                      {selectedIndex < 2 ? "商品展示" : "模特展示"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFavorite(selectedIndex)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                        isFavorited(generationId, selectedIndex)
                          ? "bg-red-50 border-red-200 text-red-500"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFavorited(generationId, selectedIndex) ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDownload(generatedImages[selectedIndex], selectedIndex)}
                      className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <button className="w-full h-12 rounded-lg bg-zinc-900 text-white font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors">
                  <Save className="w-4 h-4" />
                  存为素材
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultImageCard({
  imageUrl,
  imageIndex,
  generationId,
  onDownload,
  onFavorite,
  onClick,
}: {
  imageUrl: string
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
      className="group relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-700 cursor-pointer"
      onClick={onClick}
    >
      <Image
        src={imageUrl}
        alt="Generated image"
        fill
        className="object-cover"
      />
      
      {/* Hover overlay */}
      <div className="absolute top-2 right-2 bg-white/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <Check className="w-3 h-3 text-green-600" />
      </div>
      
      {/* Favorite indicator */}
      {currentlyFavorited && (
        <div className="absolute top-2 left-2">
          <Heart className="w-4 h-4 fill-red-500 text-red-500" />
        </div>
      )}
    </div>
  )
}
