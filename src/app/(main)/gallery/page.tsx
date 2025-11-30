"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, Heart, X, Save, Wand2 } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Generation, Favorite } from "@/types"
import { useRouter } from "next/navigation"

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all")
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const { generations, favorites, _hasHydrated, addFavorite, removeFavorite, isFavorited } = useAssetStore()
  
  // Show loading state until hydrated
  if (!_hasHydrated) {
    return (
      <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }
  
  const displayedHistory: { gen: Generation; url: string; idx: number }[] = activeTab === "all" 
    ? generations.flatMap((gen: Generation) => gen.outputImageUrls.map((url: string, idx: number) => ({ gen, url, idx })))
    : favorites.map((fav: Favorite) => {
        const gen = generations.find((g: Generation) => g.id === fav.generationId)
        if (!gen) return null
        const url = gen.outputImageUrls[fav.imageIndex]
        if (!url) return null
        return { gen, url, idx: fav.imageIndex }
      }).filter((item): item is { gen: Generation; url: string; idx: number } => item !== null)
  
  const handleFavoriteToggle = async (generationId: string, imageIndex: number) => {
    const currentlyFavorited = isFavorited(generationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f: Favorite) => f.generationId === generationId && f.imageIndex === imageIndex
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
  
  const handleDownload = (url: string) => {
    const link = document.createElement("a")
    link.href = url
    link.download = `brand-camera-${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="h-14 border-b bg-white dark:bg-zinc-900 flex items-center justify-between px-4 shrink-0">
        <span className="font-semibold text-lg">图库</span>
        <div className="flex gap-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 h-8">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === "favorites"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              收藏
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {displayedHistory.map((item, i) => (
            <div 
              key={`${item.gen.id}-${item.idx}-${i}`}
              className="group relative aspect-[4/5] bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden cursor-pointer"
              onClick={() => setSelectedItem({ gen: item.gen, index: item.idx })}
            >
              <Image 
                src={item.url} 
                alt="Generated" 
                fill 
                className="object-cover transition-transform group-hover:scale-105" 
              />
              
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-zinc-700 hover:text-red-500 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFavoriteToggle(item.gen.id, item.idx)
                  }}
                >
                  <Heart className={`w-4 h-4 ${isFavorited(item.gen.id, item.idx) ? "fill-red-500 text-red-500" : ""}`} />
                </button>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">
                  {new Date(item.gen.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {displayedHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            <p>暂无{activeTab === "favorites" ? "收藏" : ""}图片</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <button
                onClick={() => setSelectedItem(null)}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <span className="font-semibold text-white">详情</span>
              <div className="w-10" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-[4/5] bg-zinc-900">
                <Image 
                  src={selectedItem.gen.outputImageUrls[selectedItem.index]} 
                  alt="Detail" 
                  fill 
                  className="object-contain" 
                />
              </div>
              
              <div className="p-4 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">
                      {selectedItem.index < 2 ? "商品展示" : "模特展示"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {new Date(selectedItem.gen.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFavoriteToggle(selectedItem.gen.id, selectedItem.index)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                        isFavorited(selectedItem.gen.id, selectedItem.index)
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFavorited(selectedItem.gen.id, selectedItem.index) ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDownload(selectedItem.gen.outputImageUrls[selectedItem.index])}
                      className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 h-12 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <Save className="w-4 h-4" />
                    存为素材
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedItem(null)
                      router.push("/edit")
                    }}
                    className="flex-1 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                    去修图
                  </button>
                </div>

                {selectedItem.gen.params && (
                  <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded text-xs text-zinc-500 max-h-24 overflow-y-auto">
                    <span className="font-semibold block mb-1">生成参数:</span>
                    {selectedItem.gen.params.modelStyle && <p>风格: {selectedItem.gen.params.modelStyle}</p>}
                    {selectedItem.gen.params.model && <p>模特: {selectedItem.gen.params.model}</p>}
                    {selectedItem.gen.params.background && <p>背景: {selectedItem.gen.params.background}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
