"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, Heart, X, Save, Wand2, Camera, Users, Home } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Generation, Favorite } from "@/types"
import { useRouter } from "next/navigation"

type TabType = "all" | "product" | "model" | "favorites"

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const { generations, favorites, _hasHydrated, addFavorite, removeFavorite, isFavorited } = useAssetStore()
  
  // Show loading state until hydrated
  if (!_hasHydrated) {
    return (
      <div className="h-full w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }
  
  // Filter images based on tab
  const getDisplayedHistory = (): { gen: Generation; url: string; idx: number }[] => {
    switch (activeTab) {
      case "product":
        // Product images are index 0 and 1
        return generations.flatMap((gen: Generation) => 
          gen.outputImageUrls
            .slice(0, 2)
            .map((url: string, idx: number) => ({ gen, url, idx }))
        )
      case "model":
        // Model images are index 2 and 3
        return generations.flatMap((gen: Generation) => 
          gen.outputImageUrls
            .slice(2, 4)
            .map((url: string, idx: number) => ({ gen, url, idx: idx + 2 }))
        )
      case "favorites":
        return favorites.map((fav: Favorite) => {
          const gen = generations.find((g: Generation) => g.id === fav.generationId)
          if (!gen) return null
          const url = gen.outputImageUrls[fav.imageIndex]
          if (!url) return null
          return { gen, url, idx: fav.imageIndex }
        }).filter((item): item is { gen: Generation; url: string; idx: number } => item !== null)
      default:
        return generations.flatMap((gen: Generation) => 
          gen.outputImageUrls.map((url: string, idx: number) => ({ gen, url, idx }))
        )
    }
  }
  
  const displayedHistory = getDisplayedHistory()
  
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

  const tabs: { id: TabType; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "全部" },
    { id: "product", label: "产品图", icon: <Camera className="w-3.5 h-3.5" /> },
    { id: "model", label: "模特图", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "favorites", label: "收藏", icon: <Heart className="w-3.5 h-3.5" /> },
  ]
  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="h-14 flex items-center px-4">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <Home className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
            <span className="font-semibold text-lg text-zinc-900">图库</span>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {displayedHistory.map((item, i) => (
            <div 
              key={`${item.gen.id}-${item.idx}-${i}`}
              className="group relative aspect-[4/5] bg-zinc-200 rounded-xl overflow-hidden cursor-pointer shadow-sm"
              onClick={() => setSelectedItem({ gen: item.gen, index: item.idx })}
            >
              <Image 
                src={item.url} 
                alt="Generated" 
                fill 
                className="object-cover transition-transform group-hover:scale-105" 
              />
              
              {/* Type badge */}
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                  item.idx < 2 
                    ? "bg-blue-500 text-white" 
                    : "bg-purple-500 text-white"
                }`}>
                  {item.idx < 2 ? "产品" : "模特"}
                </span>
              </div>
              
              {/* Favorite button */}
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
              
              {/* Favorite indicator */}
              {isFavorited(item.gen.id, item.idx) && (
                <div className="absolute bottom-2 right-2">
                  <Heart className="w-4 h-4 fill-red-500 text-red-500 drop-shadow" />
                </div>
              )}
              
              {/* Date overlay */}
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
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
              {activeTab === "favorites" ? (
                <Heart className="w-8 h-8 text-zinc-300" />
              ) : activeTab === "product" ? (
                <Camera className="w-8 h-8 text-zinc-300" />
              ) : activeTab === "model" ? (
                <Users className="w-8 h-8 text-zinc-300" />
              ) : (
                <Camera className="w-8 h-8 text-zinc-300" />
              )}
            </div>
            <p className="text-sm">
              {activeTab === "favorites" ? "暂无收藏图片" : 
               activeTab === "product" ? "暂无产品图" :
               activeTab === "model" ? "暂无模特图" : "暂无图片"}
            </p>
            <p className="text-xs text-zinc-300 mt-1">
              {activeTab !== "favorites" && "去拍摄生成你的第一张图片吧"}
            </p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-white overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
              <button
                onClick={() => setSelectedItem(null)}
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-zinc-700" />
              </button>
              <span className="font-semibold text-zinc-900">详情</span>
              <div className="w-10" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-100">
              <div className="relative aspect-[4/5] bg-zinc-900">
                <Image 
                  src={selectedItem.gen.outputImageUrls[selectedItem.index]} 
                  alt="Detail" 
                  fill 
                  className="object-contain" 
                />
              </div>
              
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedItem.index < 2 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {selectedItem.index < 2 ? "产品展示" : "模特展示"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {new Date(selectedItem.gen.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFavoriteToggle(selectedItem.gen.id, selectedItem.index)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                        isFavorited(selectedItem.gen.id, selectedItem.index)
                          ? "bg-red-50 border-red-200 text-red-500"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFavorited(selectedItem.gen.id, selectedItem.index) ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDownload(selectedItem.gen.outputImageUrls[selectedItem.index])}
                      className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 h-12 rounded-lg border border-zinc-200 text-zinc-700 font-medium flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors">
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
                  <div className="mt-4 p-3 bg-zinc-50 rounded-lg text-xs text-zinc-500">
                    <span className="font-semibold block mb-1">生成参数:</span>
                    {selectedItem.gen.params.modelGender && <p>性别: {selectedItem.gen.params.modelGender === 'male' ? '男' : '女'}</p>}
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
