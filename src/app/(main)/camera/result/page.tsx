"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Download, Heart, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/shared/Header"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { generateId } from "@/lib/utils"

export default function ResultPage() {
  const router = useRouter()
  const { capturedImage, generatedImages, reset } = useCameraStore()
  const { addGeneration, addFavorite, isFavorited, favorites, removeFavorite } = useAssetStore()
  const [isSaved, setIsSaved] = useState(false)
  const [generationId, setGenerationId] = useState<string>("")
  
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
      })
      
      setIsSaved(true)
    }
    
    saveGeneration()
  }, [capturedImage, generatedImages, router, addGeneration, isSaved])
  
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
    router.push("/camera")
  }
  
  const handleAgain = () => {
    router.push("/camera/preview")
  }
  
  if (!capturedImage || generatedImages.length === 0) return null
  
  // Separate product images (first 2) and model images (last 2)
  const productImages = generatedImages.slice(0, 2)
  const modelImages = generatedImages.slice(2, 4)
  
  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <Header 
        title="生成完成" 
        showBack
        rightElement={
          <button onClick={handleDone} className="text-accent text-sm font-medium">
            完成
          </button>
        }
      />
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Saved indicator */}
        {isSaved && (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <Check className="w-4 h-4" />
            <span>已自动保存到图片资产</span>
          </div>
        )}
        
        {/* Product images */}
        {productImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">商品图</h3>
            <div className="grid grid-cols-2 gap-3">
              {productImages.map((image, index) => (
                <ImageCard
                  key={`product-${index}`}
                  imageUrl={image}
                  imageIndex={index}
                  generationId={generationId}
                  onDownload={() => handleDownload(image, index)}
                  onFavorite={() => handleFavorite(index)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Model images */}
        {modelImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">模特展示图</h3>
            <div className="grid grid-cols-2 gap-3">
              {modelImages.map((image, index) => (
                <ImageCard
                  key={`model-${index}`}
                  imageUrl={image}
                  imageIndex={index + 2}
                  generationId={generationId}
                  onDownload={() => handleDownload(image, index + 2)}
                  onFavorite={() => handleFavorite(index + 2)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* If we only have generic images (less than 4) */}
        {productImages.length === 0 && modelImages.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {generatedImages.map((image, index) => (
              <ImageCard
                key={index}
                imageUrl={image}
                imageIndex={index}
                generationId={generationId}
                onDownload={() => handleDownload(image, index)}
                onFavorite={() => handleFavorite(index)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom actions */}
      <div className="sticky bottom-0 p-4 pb-safe bg-gradient-to-t from-primary via-primary to-transparent">
        <Button
          onClick={handleAgain}
          variant="secondary"
          className="w-full"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          再来一次
        </Button>
      </div>
    </div>
  )
}

function ImageCard({
  imageUrl,
  imageIndex,
  generationId,
  onDownload,
  onFavorite,
}: {
  imageUrl: string
  imageIndex: number
  generationId: string
  onDownload: () => void
  onFavorite: () => void
}) {
  const { isFavorited } = useAssetStore()
  const currentlyFavorited = generationId ? isFavorited(generationId, imageIndex) : false
  
  return (
    <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-surface group">
      <Image
        src={imageUrl}
        alt="Generated image"
        fill
        className="object-cover"
      />
      
      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-center gap-4">
          <button
            onClick={onDownload}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onFavorite}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <Heart className={`w-5 h-5 ${currentlyFavorited ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
      </div>
      
      {/* Favorite indicator */}
      {currentlyFavorited && (
        <div className="absolute top-2 right-2">
          <Heart className="w-5 h-5 fill-red-500 text-red-500" />
        </div>
      )}
    </div>
  )
}
