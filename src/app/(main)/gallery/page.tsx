"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, Heart, Trash2, Filter, Images, FolderHeart } from "lucide-react"
import { Header } from "@/components/shared/Header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/EmptyState"
import { useAssetStore } from "@/stores/assetStore"
import { Generation } from "@/types"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("all")
  const { generations, favorites } = useAssetStore()
  
  // Group generations by date
  const groupedGenerations = generations.reduce((groups, gen) => {
    const date = formatDate(gen.createdAt)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(gen)
    return groups
  }, {} as Record<string, Generation[]>)
  
  return (
    <div className="min-h-screen bg-primary">
      <Header 
        title="图片资产" 
        rightElement={
          <button className="text-gray-400 hover:text-white transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Images className="w-4 h-4" />
              全部
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <FolderHeart className="w-4 h-4" />
              收藏夹
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            {generations.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedGenerations).map(([date, gens]) => (
                  <div key={date} className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-400">{date}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {gens.flatMap((gen) =>
                        gen.outputImageUrls.map((url, index) => (
                          <ImageCard
                            key={`${gen.id}-${index}`}
                            imageUrl={url}
                            generationId={gen.id}
                            imageIndex={index}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Images}
                title="还没有生成历史"
                description="去拍摄你的第一件商品吧"
                actionLabel="打开相机"
                onAction={() => router.push("/camera")}
              />
            )}
          </TabsContent>
          
          <TabsContent value="favorites" className="mt-4">
            {favorites.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {favorites.map((fav) => {
                  const gen = generations.find(g => g.id === fav.generationId)
                  if (!gen) return null
                  const imageUrl = gen.outputImageUrls[fav.imageIndex]
                  if (!imageUrl) return null
                  
                  return (
                    <ImageCard
                      key={fav.id}
                      imageUrl={imageUrl}
                      generationId={fav.generationId}
                      imageIndex={fav.imageIndex}
                      isFavorited
                    />
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={FolderHeart}
                title="收藏夹是空的"
                description="收藏喜欢的图片，方便随时查看"
                actionLabel="浏览历史"
                onAction={() => setActiveTab("all")}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ImageCard({
  imageUrl,
  generationId,
  imageIndex,
  isFavorited = false,
}: {
  imageUrl: string
  generationId: string
  imageIndex: number
  isFavorited?: boolean
}) {
  const { addFavorite, removeFavorite, favorites } = useAssetStore()
  
  const isCurrentlyFavorited = isFavorited || favorites.some(
    f => f.generationId === generationId && f.imageIndex === imageIndex
  )
  
  const handleFavorite = () => {
    if (isCurrentlyFavorited) {
      const fav = favorites.find(
        f => f.generationId === generationId && f.imageIndex === imageIndex
      )
      if (fav) {
        removeFavorite(fav.id)
      }
    } else {
      addFavorite({
        id: `${generationId}-${imageIndex}`,
        generationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  const handleDownload = async () => {
    try {
      const link = document.createElement("a")
      link.href = imageUrl
      link.download = `brand-camera-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Download error:", error)
    }
  }
  
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-surface group">
      <Image
        src={imageUrl}
        alt="Generated image"
        fill
        className="object-cover"
      />
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-center gap-2">
          <button
            onClick={handleDownload}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleFavorite}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <Heart className={`w-4 h-4 ${isCurrentlyFavorited ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
      </div>
      
      {/* Favorite indicator */}
      {isCurrentlyFavorited && (
        <div className="absolute top-1 right-1">
          <Heart className="w-4 h-4 fill-red-500 text-red-500" />
        </div>
      )}
    </div>
  )
}

