"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, Heart, Trash2, Camera, Sparkles, MapPin, X, Images, FolderHeart } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Generation } from "@/types"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all")
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const { generations, favorites, _hasHydrated, addFavorite, removeFavorite, isFavorited } = useAssetStore()
  
  // Group generations by date
  const groupedGenerations = generations.reduce((groups, gen) => {
    const date = formatDate(gen.createdAt)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(gen)
    return groups
  }, {} as Record<string, Generation[]>)
  
  // Show loading state until hydrated
  if (!_hasHydrated) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">加载中...</p>
        </div>
      </div>
    )
  }
  
  const handleFavorite = async (generationId: string, imageIndex: number) => {
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
  
  return (
    <div className="h-full w-full bg-black overflow-y-auto">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 glass-dark border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">品牌相机</h1>
          <button
            onClick={() => router.push("/camera")}
            className="px-4 py-2 bg-accent text-black font-bold rounded-full active:scale-95 transition-transform flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>拍摄</span>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
              activeTab === "all" 
                ? "border-accent text-white" 
                : "border-transparent text-white/60"
            }`}
          >
            <Images className="w-4 h-4" />
            <span className="text-sm font-medium">全部</span>
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
              activeTab === "favorites" 
                ? "border-accent text-white" 
                : "border-transparent text-white/60"
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span className="text-sm font-medium">收藏夹</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === "all" ? (
          generations.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
                <Camera className="w-10 h-10 text-white/30" />
              </div>
              <h2 className="text-white text-xl font-bold mb-3">还没有生成记录</h2>
              <p className="text-white/60 mb-8 max-w-xs">拍摄一张商品照片，让AI为你创造专业的展示图</p>
              <button
                onClick={() => router.push("/camera")}
                className="px-8 py-4 bg-accent text-black font-bold rounded-full active:scale-95 transition-transform text-lg"
              >
                开始拍摄
              </button>
              
              {/* Features */}
              <div className="grid grid-cols-3 gap-4 mt-12 max-w-md w-full">
                <div className="glass rounded-2xl p-4 text-center">
                  <div className="text-3xl mb-2">📸</div>
                  <div className="text-white/80 text-xs font-medium">商品图</div>
                </div>
                <div className="glass rounded-2xl p-4 text-center">
                  <div className="text-3xl mb-2">👗</div>
                  <div className="text-white/80 text-xs font-medium">模特展示</div>
                </div>
                <div className="glass rounded-2xl p-4 text-center">
                  <div className="text-3xl mb-2">✨</div>
                  <div className="text-white/80 text-xs font-medium">风格定制</div>
                </div>
              </div>
            </div>
          ) : (
            /* Feed - BeReal style */
            <div className="space-y-6 pb-20">
              {Object.entries(groupedGenerations).map(([date, gens]) => (
                <div key={date} className="space-y-4">
                  <h3 className="text-white/60 text-xs font-semibold uppercase">{date}</h3>
                  {gens.map((gen) => (
                    <FeedCard
                      key={gen.id}
                      generation={gen}
                      onSelect={(index) => setSelectedItem({ gen, index })}
                      onFavorite={handleFavorite}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        ) : (
          /* Favorites */
          favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
                <Heart className="w-10 h-10 text-white/30" />
              </div>
              <h2 className="text-white text-xl font-bold mb-3">收藏夹是空的</h2>
              <p className="text-white/60 mb-8">收藏喜欢的图片，方便随时查看</p>
              <button
                onClick={() => setActiveTab("all")}
                className="px-6 py-3 glass text-white font-medium rounded-full"
              >
                浏览全部
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-20">
              {favorites.map((fav) => {
                const gen = generations.find(g => g.id === fav.generationId)
                if (!gen) return null
                const imageUrl = gen.outputImageUrls[fav.imageIndex]
                if (!imageUrl) return null
                
                return (
                  <div
                    key={fav.id}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden glass cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => setSelectedItem({ gen, index: fav.imageIndex })}
                  >
                    <Image
                      src={imageUrl}
                      alt="Favorite"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          generation={selectedItem.gen}
          imageIndex={selectedItem.index}
          onClose={() => setSelectedItem(null)}
          onFavorite={handleFavorite}
        />
      )}
    </div>
  )
}

function FeedCard({
  generation,
  onSelect,
  onFavorite,
}: {
  generation: Generation
  onSelect: (index: number) => void
  onFavorite: (genId: string, index: number) => void
}) {
  const { isFavorited } = useAssetStore()
  const mainImage = generation.outputImageUrls[0]
  const isModel = generation.type === "camera_model"
  
  return (
    <div className="feed-card">
      {/* User info bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isModel ? "bg-gradient-to-br from-white/20 to-accent/20" : "glass"
          }`}>
            {isModel ? (
              <Sparkles className="w-5 h-5 text-accent" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {isModel ? "模特展示" : "商品图"}
            </p>
            <p className="text-white/40 text-xs">
              {new Date(generation.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        {generation.params?.modelStyle && generation.params.modelStyle !== "auto" && (
          <div className="badge badge-yellow text-xs">
            {generation.params.modelStyle === "japanese" ? "日系" :
             generation.params.modelStyle === "korean" ? "韩系" :
             generation.params.modelStyle === "chinese" ? "中式" : "欧美"}
          </div>
        )}
      </div>

      {/* Photo pair */}
      <div className="relative cursor-pointer" onClick={() => onSelect(0)}>
        <img
          src={mainImage}
          alt="Generated"
          className="w-full"
        />
        
        {/* Original thumbnail */}
        <div className="photo-thumbnail">
          <img
            src={generation.inputImageUrl}
            alt="Original"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Image count badge */}
        {generation.outputImageUrls.length > 1 && (
          <div className="absolute bottom-3 right-3 badge badge-glass text-xs">
            1/{generation.outputImageUrls.length}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex gap-2">
          {generation.outputImageUrls.slice(0, 4).map((_, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === 0 ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFavorite(generation.id, 0)
          }}
          className="p-2 -mr-2"
        >
          <Heart className={`w-6 h-6 ${
            isFavorited(generation.id, 0) 
              ? "fill-red-500 text-red-500" 
              : "text-white/60"
          }`} />
        </button>
      </div>
    </div>
  )
}

function DetailModal({
  generation,
  imageIndex,
  onClose,
  onFavorite,
}: {
  generation: Generation
  imageIndex: number
  onClose: () => void
  onFavorite: (genId: string, index: number) => void
}) {
  const { isFavorited } = useAssetStore()
  const [currentIndex, setCurrentIndex] = useState(imageIndex)
  const currentImage = generation.outputImageUrls[currentIndex]
  const currentlyFavorited = isFavorited(generation.id, currentIndex)
  
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = currentImage
    link.download = `brand-camera-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  return (
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto" onClick={onClose}>
      {/* Header */}
      <div className="sticky top-0 z-10 glass-dark px-4 py-3 flex items-center justify-between border-b border-white/10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-white font-bold">详情</h3>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="px-4 py-6" onClick={(e) => e.stopPropagation()}>
        {/* Image selector */}
        {generation.outputImageUrls.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
            {generation.outputImageUrls.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                  currentIndex === idx ? "border-accent" : "border-transparent"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        
        {/* Generated Image */}
        <div className="mb-6">
          <p className="text-white/60 text-xs font-semibold mb-2 uppercase">AI生成</p>
          <div className="rounded-2xl overflow-hidden">
            <img src={currentImage} alt="Generated" className="w-full" />
          </div>
        </div>

        {/* Original Image */}
        <div className="mb-6">
          <p className="text-white/60 text-xs font-semibold mb-2 uppercase">原始照片</p>
          <div className="rounded-2xl overflow-hidden">
            <img src={generation.inputImageUrl} alt="Original" className="w-full" />
          </div>
        </div>

        {/* Style badge */}
        {generation.params?.modelStyle && generation.params.modelStyle !== "auto" && (
          <div className="glass rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-accent text-xs font-semibold uppercase">风格</p>
            </div>
            <p className="text-white">
              {generation.params.modelStyle === "japanese" ? "日系风格" :
               generation.params.modelStyle === "korean" ? "韩系风格" :
               generation.params.modelStyle === "chinese" ? "中式风格" : "欧美风格"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 h-12 rounded-full glass font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Download className="w-5 h-5" />
            下载
          </button>
          <button
            onClick={() => onFavorite(generation.id, currentIndex)}
            className={`flex-1 h-12 rounded-full font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
              currentlyFavorited ? "bg-red-500 text-white" : "glass text-white"
            }`}
          >
            <Heart className={`w-5 h-5 ${currentlyFavorited ? "fill-current" : ""}`} />
            {currentlyFavorited ? "已收藏" : "收藏"}
          </button>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  )
}
