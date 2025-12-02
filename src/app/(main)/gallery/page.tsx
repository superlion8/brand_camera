"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Download, Heart, X, Wand2, Camera, Users, Home, ZoomIn, Loader2, Sparkles, Lightbulb } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore, GenerationTask } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { Generation, Favorite } from "@/types"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

type TabType = "all" | "model" | "product" | "favorites"

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const { generations, favorites, _hasHydrated, addFavorite, removeFavorite, isFavorited } = useAssetStore()
  const { tasks, removeTask } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  
  // Get active tasks (generating)
  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'generating')
  
  // Auto-refresh when tasks complete
  useEffect(() => {
    // Clean up completed tasks after a delay
    const completedTasks = tasks.filter(t => t.status === 'completed')
    completedTasks.forEach(task => {
      setTimeout(() => removeTask(task.id), 1000)
    })
  }, [tasks, removeTask])
  
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
    // Filter out generations with invalid outputImageUrls
    const validGenerations = generations.filter(
      (gen: Generation) => gen.outputImageUrls && Array.isArray(gen.outputImageUrls) && gen.outputImageUrls.length > 0
    )
    
    switch (activeTab) {
      case "model":
        // Model images from camera_model type generations
        return validGenerations
          .filter((gen: Generation) => gen.type === 'camera_model')
          .flatMap((gen: Generation) => 
            (gen.outputImageUrls || []).map((url: string, idx: number) => ({ gen, url, idx }))
          )
      case "product":
        // Product images from studio type generations
        return validGenerations
          .filter((gen: Generation) => gen.type === 'studio')
          .flatMap((gen: Generation) => 
            (gen.outputImageUrls || []).map((url: string, idx: number) => ({ gen, url, idx }))
          )
      case "favorites":
        return favorites.map((fav: Favorite) => {
          const gen = validGenerations.find((g: Generation) => g.id === fav.generationId)
          if (!gen) return null
          const url = gen.outputImageUrls?.[fav.imageIndex]
          if (!url) return null
          return { gen, url, idx: fav.imageIndex }
        }).filter((item): item is { gen: Generation; url: string; idx: number } => item !== null)
      default:
        return validGenerations.flatMap((gen: Generation) => 
          (gen.outputImageUrls || []).map((url: string, idx: number) => ({ gen, url, idx }))
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
  
  const handleDownload = async (url: string) => {
    try {
      let blob: Blob
      
      if (url.startsWith('data:')) {
        // Handle base64 data URL
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        // Handle regular URL
        const response = await fetch(url)
        blob = await response.blob()
      }
      
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `brand-camera-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      // Fallback to direct link
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.jpg`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const tabs: { id: TabType; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "全部" },
    { id: "model", label: "模特", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "product", label: "产品", icon: <Lightbulb className="w-3.5 h-3.5" /> },
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
          {/* Active generation tasks - show at top */}
          {activeTab === "all" && activeTasks.map((task) => (
            <GeneratingCard key={task.id} task={task} />
          ))}
          
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
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {item.gen.type === 'studio' ? (
                  <span className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500 text-white">
                    产品
                  </span>
                ) : item.gen.type === 'camera_model' ? (
                  <>
                    <span className="px-2 py-1 rounded text-[10px] font-medium bg-blue-500 text-white">
                      模特
                    </span>
                    {item.gen.outputGenModes?.[item.idx] === 'simple' ? (
                      <span className="px-1.5 py-1 rounded text-[9px] font-medium bg-green-500 text-white">
                        极简
                      </span>
                    ) : (
                      <span className="px-1.5 py-1 rounded text-[9px] font-medium bg-purple-500 text-white">
                        扩展
                      </span>
                    )}
                  </>
                ) : item.gen.type === 'edit' ? (
                  <span className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500 text-white">
                    修图
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-500 text-white">
                    其他
                  </span>
                )}
              </div>
              
              {/* Favorite button - always visible */}
              <button 
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                  isFavorited(item.gen.id, item.idx) 
                    ? "bg-red-500 text-white" 
                    : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFavoriteToggle(item.gen.id, item.idx)
                }}
              >
                <Heart className={`w-4 h-4 ${isFavorited(item.gen.id, item.idx) ? "fill-current" : ""}`} />
              </button>
              
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
              ) : activeTab === "model" ? (
                <Users className="w-8 h-8 text-zinc-300" />
              ) : activeTab === "product" ? (
                <Lightbulb className="w-8 h-8 text-zinc-300" />
              ) : (
                <Camera className="w-8 h-8 text-zinc-300" />
              )}
            </div>
            <p className="text-sm">
              {activeTab === "favorites" ? "暂无收藏图片" : 
               activeTab === "model" ? "暂无模特图" :
               activeTab === "product" ? "暂无产品图" : "暂无图片"}
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
              <div 
                className="relative aspect-[4/5] bg-zinc-900 cursor-pointer group"
                onClick={() => setFullscreenImage(selectedItem.gen.outputImageUrls[selectedItem.index])}
              >
                <Image 
                  src={selectedItem.gen.outputImageUrls[selectedItem.index]} 
                  alt="Detail" 
                  fill 
                  className="object-contain" 
                />
                {/* Zoom hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <ZoomIn className="w-6 h-6 text-zinc-700" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedItem.gen.outputGenModes?.[selectedItem.index] === 'simple'
                          ? "bg-green-100 text-green-700" 
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {selectedItem.gen.outputGenModes?.[selectedItem.index] === 'simple' ? "极简模式" : "扩展模式"}
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

                <button 
                  onClick={() => {
                    // Store the image URL in sessionStorage to pass to edit page
                    const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                    sessionStorage.setItem('editImage', imageUrl)
                    setSelectedItem(null)
                    router.push("/edit")
                  }}
                  className="w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Wand2 className="w-4 h-4" />
                  去修图
                </button>
                
                {/* Generation Details - Only show in debug mode */}
                {debugMode && (
                <div className="mt-6 pt-4 border-t border-zinc-100 pb-8">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                  
                  {/* Prompt - show per-image prompt if available */}
                  {(selectedItem.gen.prompts?.[selectedItem.index] || selectedItem.gen.prompt) && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-zinc-500 mb-2">Prompt</p>
                      <div className="bg-zinc-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <pre className="text-[11px] text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
                          {selectedItem.gen.prompts?.[selectedItem.index] || selectedItem.gen.prompt}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {/* Reference Images */}
                  <div className="space-y-3">
                    {/* Reference images grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {/* Input Product Image */}
                      {selectedItem.gen.inputImageUrl && (
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                            <Image 
                              src={selectedItem.gen.inputImageUrl} 
                              alt="商品" 
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">商品</p>
                        </div>
                      )}
                      
                      {/* Model Image */}
                      {selectedItem.gen.params?.modelImage && (
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                            <Image 
                              src={selectedItem.gen.params.modelImage} 
                              alt="模特" 
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedItem.gen.params.model || '模特'}</p>
                        </div>
                      )}
                      
                      {/* Background Image */}
                      {selectedItem.gen.params?.backgroundImage && (
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                            <Image 
                              src={selectedItem.gen.params.backgroundImage} 
                              alt="背景" 
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedItem.gen.params.background || '背景'}</p>
                        </div>
                      )}
                      
                      {/* Vibe Image */}
                      {selectedItem.gen.params?.vibeImage && (
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                            <Image 
                              src={selectedItem.gen.params.vibeImage} 
                              alt="氛围" 
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{selectedItem.gen.params.vibe || '氛围'}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Style and Studio params */}
                    {selectedItem.gen.params && (
                      <div className="flex gap-2 flex-wrap">
                        {selectedItem.gen.params.modelStyle && selectedItem.gen.params.modelStyle !== 'auto' && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                            风格: {selectedItem.gen.params.modelStyle === 'korean' ? '韩系' : 
                                   selectedItem.gen.params.modelStyle === 'western' ? '欧美' : selectedItem.gen.params.modelStyle}
                          </span>
                        )}
                        {selectedItem.gen.params.modelGender && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                            性别: {selectedItem.gen.params.modelGender === 'male' ? '男' : 
                                   selectedItem.gen.params.modelGender === 'female' ? '女' : 
                                   selectedItem.gen.params.modelGender === 'boy' ? '男童' : '女童'}
                          </span>
                        )}
                        {/* Studio params */}
                        {selectedItem.gen.params.lightType && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                            光源: {selectedItem.gen.params.lightType === 'Softbox' ? '柔光' : 
                                   selectedItem.gen.params.lightType === 'Sunlight' ? '自然光' : 
                                   selectedItem.gen.params.lightType === 'Dramatic' ? '戏剧' : 
                                   selectedItem.gen.params.lightType === 'Neon' ? '霓虹' : selectedItem.gen.params.lightType}
                          </span>
                        )}
                        {selectedItem.gen.params.lightDirection && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                            方向: {selectedItem.gen.params.lightDirection}
                          </span>
                        )}
                        {selectedItem.gen.params.lightColor && selectedItem.gen.params.lightColor !== '#FFFFFF' && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600 flex items-center gap-1">
                            背景色: 
                            <span 
                              className="w-3 h-3 rounded-full border border-zinc-300 inline-block" 
                              style={{ backgroundColor: selectedItem.gen.params.lightColor }}
                            />
                          </span>
                        )}
                        {selectedItem.gen.params.aspectRatio && selectedItem.gen.params.aspectRatio !== 'original' && (
                          <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                            比例: {selectedItem.gen.params.aspectRatio}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Show "no params" if nothing */}
                    {!selectedItem.gen.params && !selectedItem.gen.inputImageUrl && (
                      <p className="text-xs text-zinc-400 text-center py-2">暂无生成参数记录</p>
                    )}
                    
                    {/* Generation Type Badge */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                      <span className="text-[10px] text-zinc-400">生成类型：</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        selectedItem.gen.type === 'studio' 
                          ? 'bg-amber-100 text-amber-700' 
                          : selectedItem.gen.type === 'edit'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedItem.gen.type === 'studio' ? 'AI 影棚' : 
                         selectedItem.gen.type === 'edit' ? '图片编辑' : 
                         selectedItem.gen.type === 'camera_model' ? '拍摄生成' : selectedItem.gen.type}
                      </span>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          >
            {/* Close button */}
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Image with zoom */}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
              onPinchingStop={(ref) => {
                // Reset to scale 1 if zoomed out too much
                if (ref.state.scale < 1) {
                  ref.resetTransform()
                }
              }}
            >
              {({ resetTransform }) => (
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full"
                  >
                    <Image
                      src={fullscreenImage}
                      alt="Fullscreen"
                      fill
                      className="object-contain"
                      quality={100}
                      draggable={false}
                    />
                  </motion.div>
                </TransformComponent>
              )}
            </TransformWrapper>
            
            {/* Tap to close hint */}
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">双指缩放 · 双击重置 · 点击 × 关闭</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Generating card component with task type support
function GeneratingCard({ task }: { task: GenerationTask }) {
  // Determine colors and text based on task type
  const isStudio = task.type === 'studio'
  const isEdit = task.type === 'edit'
  
  const bgGradient = isStudio 
    ? 'from-amber-100 to-orange-100' 
    : isEdit 
      ? 'from-purple-100 to-pink-100'
      : 'from-blue-100 to-purple-100'
  
  const borderColor = isStudio 
    ? 'border-amber-300' 
    : isEdit 
      ? 'border-purple-300'
      : 'border-blue-300'
  
  const pulseColor = isStudio 
    ? 'bg-amber-500/20' 
    : isEdit 
      ? 'bg-purple-500/20'
      : 'bg-blue-500/20'
  
  const spinnerColor = isStudio 
    ? 'text-amber-600' 
    : isEdit 
      ? 'text-purple-600'
      : 'text-blue-600'
  
  const textColor = isStudio 
    ? 'text-amber-700' 
    : isEdit 
      ? 'text-purple-700'
      : 'text-blue-700'
  
  const subTextColor = isStudio 
    ? 'text-amber-500' 
    : isEdit 
      ? 'text-purple-500'
      : 'text-blue-500'
  
  const badgeColor = isStudio 
    ? 'bg-amber-500' 
    : isEdit 
      ? 'bg-purple-500'
      : 'bg-blue-500'
  
  const title = isStudio 
    ? '影棚拍摄中...' 
    : isEdit 
      ? '修图中...'
      : '模特拍摄中...'
  
  const subtitle = isStudio 
    ? 'AI 正在生成 2 张商品图' 
    : isEdit 
      ? 'AI 正在处理您的图片'
      : 'AI 正在生成 2 张模特图' // DEBUG: changed from 6 to 2
  
  const badgeText = isStudio 
    ? '商品影棚' 
    : isEdit 
      ? '修图室'
      : '模特影棚'
  
  return (
    <div className={`relative aspect-[4/5] bg-gradient-to-br ${bgGradient} rounded-xl overflow-hidden shadow-sm border-2 border-dashed ${borderColor}`}>
      {/* Thumbnail preview */}
      <div className="absolute inset-0 opacity-30">
        <Image 
          src={task.inputImageUrl} 
          alt="Generating" 
          fill 
          className="object-cover blur-sm" 
        />
      </div>
      
      {/* Loading overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative mb-3">
          <div className={`absolute inset-0 ${pulseColor} blur-lg rounded-full animate-pulse`} />
          <Loader2 className={`w-10 h-10 ${spinnerColor} animate-spin relative z-10`} />
        </div>
        <span className={`${textColor} font-semibold text-sm`}>{title}</span>
        <span className={`${subTextColor} text-xs mt-1`}>{subtitle}</span>
      </div>
      
      {/* Status badge */}
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-1 rounded text-[10px] font-medium ${badgeColor} text-white animate-pulse`}>
          {badgeText}
        </span>
      </div>
    </div>
  )
}
