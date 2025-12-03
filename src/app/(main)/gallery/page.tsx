"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Download, Heart, X, Wand2, Camera, Users, Home, ZoomIn, Loader2, Lightbulb, RefreshCw, Trash2, Package, FolderPlus } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { useGenerationTaskStore, GenerationTask } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { Generation, Favorite, Asset } from "@/types"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { generateId } from "@/lib/utils"

type TabType = "all" | "model" | "product" | "favorites"

// Helper functions for type classification
function isModelType(gen: Generation): boolean {
  const type = gen.type?.toLowerCase() || ''
  if (type === 'camera_model' || type === 'model' || type === 'camera' || type === 'model_studio') {
    return true
  }
  // Fallback: has generation modes = likely model generation
  if (gen.outputGenModes && gen.outputGenModes.length > 0) {
    return true
  }
  return false
}

function isProductType(gen: Generation): boolean {
  const type = gen.type?.toLowerCase() || ''
  return type === 'studio' || type === 'camera_product' || type === 'product' || type === 'product_studio'
}

function isEditType(gen: Generation): boolean {
  const type = gen.type?.toLowerCase() || ''
  return type === 'edit' || type === 'editing'
}

// Helper to get display label for generation type
// debugMode controls whether to show sub-labels (极简/扩展)
function getTypeLabel(gen: Generation, imageIndex: number, debugMode: boolean = false): { label: string; color: string; subLabel?: string; subColor?: string } {
  // Studio/product types
  if (isProductType(gen)) {
    return { label: '产品', color: 'bg-amber-500' }
  }
  
  // Edit types
  if (isEditType(gen)) {
    return { label: '修图', color: 'bg-purple-500' }
  }
  
  // Model/camera types (most common)
  if (isModelType(gen)) {
    const mode = gen.outputGenModes?.[imageIndex]
    // Only show sub-labels in debug mode
    const subLabel = debugMode && mode ? (mode === 'simple' ? '极简' : '扩展') : undefined
    return { 
      label: '模特', 
      color: 'bg-blue-500',
      subLabel,
      subColor: mode === 'simple' ? 'bg-green-500' : 'bg-purple-500'
    }
  }
  
  // Last fallback - treat as edit
  return { label: '修图', color: 'bg-purple-500' }
}

export default function GalleryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [selectedItem, setSelectedItem] = useState<{ gen: Generation; index: number } | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  
  const { 
    generations, 
    favorites, 
    _hasHydrated, 
    addFavorite, 
    removeFavorite, 
    isFavorited, 
    deleteGeneration,
    deleteGenerationImage,
    addUserAsset,
    isSyncing: storeSyncing,
  } = useAssetStore()
  
  const { isSyncing: authSyncing } = useAuth()
  const isSyncing = authSyncing || storeSyncing
  const { tasks, removeTask } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  
  // Get active tasks (pending/generating) - show loading cards for these
  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'generating')
  
  // Get completed tasks that might not yet be in generations store
  const completedTasks = tasks.filter(t => t.status === 'completed')
  
  // Track which completed tasks have their generations in the store
  // We need to keep showing completed task cards until generation is definitely visible
  const completedTasksWithImages = completedTasks.filter(task => 
    task.outputImageUrls && task.outputImageUrls.length > 0
  )
  
  // Check which completed tasks already have their generation in the store
  const tasksToHide = completedTasksWithImages.filter(task => {
    // Match by comparing output URLs (more reliable than input URL)
    return generations.some(gen => {
      if (!gen.outputImageUrls || gen.outputImageUrls.length === 0) return false
      // Check if any output URL matches
      return task.outputImageUrls.some(url => 
        gen.outputImageUrls.includes(url)
      )
    })
  })
  
  // Only show completed tasks that DON'T have their generation in the store yet
  const completedTasksToShow = completedTasksWithImages.filter(
    task => !tasksToHide.some(t => t.id === task.id)
  )
  
  // Auto-remove completed tasks after they're no longer needed
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []
    
    // Remove tasks that already have their generation in the store
    tasksToHide.forEach(task => {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => removeTask(task.id), 500)
      timers.push(timer)
    })
    
    // Also remove completed tasks that have been around too long (10 seconds)
    completedTasks.forEach(task => {
      const timer = setTimeout(() => {
        // Only remove if still in completed state
        const currentTask = tasks.find(t => t.id === task.id)
        if (currentTask?.status === 'completed') {
          removeTask(task.id)
        }
      }, 10000)
      timers.push(timer)
    })
    
    // Cleanup all timers when dependencies change
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [tasksToHide, completedTasks, tasks, removeTask])
  
  // Clear save success message
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])
  
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
    const validGenerations = generations.filter(
      (gen: Generation) => gen.outputImageUrls && Array.isArray(gen.outputImageUrls) && gen.outputImageUrls.length > 0
    )
    
    switch (activeTab) {
      case "model":
        return validGenerations
          .filter((gen: Generation) => isModelType(gen))
          .flatMap((gen: Generation) => 
            (gen.outputImageUrls || []).map((url: string, idx: number) => ({ gen, url, idx }))
          )
      case "product":
        return validGenerations
          .filter((gen: Generation) => isProductType(gen))
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
        const response = await fetch(url)
        blob = await response.blob()
      } else {
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
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.jpg`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  const handleDelete = async () => {
    if (!selectedItem) return
    
    try {
      // Delete only the selected image, not the entire generation
      await deleteGenerationImage(selectedItem.gen.id, selectedItem.index)
      setSelectedItem(null)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error("Delete failed:", error)
    }
  }
  
  const handleSaveAsAsset = async (type: 'product' | 'model') => {
    if (!selectedItem) return
    
    const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
    
    const newAsset: Asset = {
      id: generateId(),
      type: type,
      name: `${type === 'product' ? '商品' : '模特'}-${new Date().toLocaleString()}`,
      imageUrl: imageUrl,
      isSystem: false,
    }
    
    try {
      await addUserAsset(newAsset)
      setShowSaveMenu(false)
      setSaveSuccess(type === 'product' ? '已保存到我的商品' : '已保存到我的模特')
    } catch (error) {
      console.error("Save failed:", error)
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
            {isSyncing && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin" />
                同步中
              </span>
            )}
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
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {/* Show loading cards for active tasks */}
          {activeTab === "all" && activeTasks.map((task) => (
            <GeneratingCard key={task.id} task={task} />
          ))}
          
          {/* Show completed task images while waiting for sync to generations store */}
          {activeTab === "all" && completedTasksToShow.map((task) => (
            task.outputImageUrls.map((url, idx) => (
              <div 
                key={`completed-${task.id}-${idx}`}
                className="relative aspect-[4/5] bg-zinc-200 rounded-xl overflow-hidden shadow-sm ring-2 ring-green-400"
              >
                <Image 
                  src={url} 
                  alt={`Generated ${idx + 1}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                  <span>✓ 完成</span>
                </div>
              </div>
            ))
          ))}
          
          {displayedHistory.map((item, i) => {
            const typeInfo = getTypeLabel(item.gen, item.idx, debugMode)
            return (
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
                  <span className={`px-2 py-1 rounded text-[10px] font-medium ${typeInfo.color} text-white`}>
                    {typeInfo.label}
                  </span>
                  {typeInfo.subLabel && (
                    <span className={`px-1.5 py-1 rounded text-[9px] font-medium ${typeInfo.subColor} text-white`}>
                      {typeInfo.subLabel}
                    </span>
                  )}
                </div>
                
                {/* Favorite button */}
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
            )
          })}
        </div>
        
        {displayedHistory.length === 0 && activeTasks.length === 0 && completedTasksToShow.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            {isSyncing ? (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
                <p className="text-sm text-blue-600">正在同步云端数据...</p>
                <p className="text-xs text-zinc-300 mt-1">请稍候</p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <div className="h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-700" />
                </button>
                <span className="font-semibold text-zinc-900">详情</span>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-10 h-10 -mr-2 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-100 pb-20">
                <div className="bg-zinc-900">
                  <div 
                    className="relative aspect-[4/5] cursor-pointer group shrink-0"
                    onClick={() => setFullscreenImage(selectedItem.gen.outputImageUrls[selectedItem.index])}
                  >
                    {/* Use img tag for native long-press save support */}
                    <img 
                      src={selectedItem.gen.outputImageUrls[selectedItem.index]} 
                      alt="Detail" 
                      className="w-full h-full object-contain" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <ZoomIn className="w-6 h-6 text-zinc-700" />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-zinc-500 text-xs py-2">长按图片保存</p>
                </div>
                
                <div className="p-4 bg-white pb-8">
                  {/* Type and date info */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {(() => {
                        const typeInfo = getTypeLabel(selectedItem.gen, selectedItem.index, debugMode)
                        return (
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            {typeInfo.subLabel && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeInfo.subColor}`}>
                                {typeInfo.subLabel}
                              </span>
                            )}
                          </div>
                        )
                      })()}
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

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        const imageUrl = selectedItem.gen.outputImageUrls[selectedItem.index]
                        sessionStorage.setItem('editImage', imageUrl)
                        setSelectedItem(null)
                        router.push("/edit")
                      }}
                      className="flex-1 h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Wand2 className="w-4 h-4" />
                      去修图
                    </button>
                    <button 
                      onClick={() => setShowSaveMenu(true)}
                      className="h-12 px-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                      存为素材
                    </button>
                  </div>
                  
                  {/* Generation Details - Only show in debug mode */}
                  {debugMode && (
                  <div className="mt-6 pt-4 border-t border-zinc-100 pb-8">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                    
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
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
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
                            <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                              {selectedItem.gen.params.model || '模特'}
                              {selectedItem.gen.params.modelIsUserSelected === false && ' (随机)'}
                            </p>
                          </div>
                        )}
                        
                        {selectedItem.gen.params?.backgroundImage && (
                          <div className="flex flex-col items-center">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                              <Image 
                                src={selectedItem.gen.params.backgroundImage} 
                                alt="环境" 
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">
                              {selectedItem.gen.params.background || '环境'}
                              {selectedItem.gen.params.bgIsUserSelected === false && ' (随机)'}
                            </p>
                          </div>
                        )}
                      </div>
                      
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
                          {selectedItem.gen.params.lightType && (
                            <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                              光源: {selectedItem.gen.params.lightType}
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
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Save Menu */}
            <AnimatePresence>
              {showSaveMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 flex items-end justify-center z-10"
                  onClick={() => setShowSaveMenu(false)}
                >
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="bg-white rounded-t-2xl w-full max-w-lg p-4 pb-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />
                    <h3 className="font-semibold text-zinc-900 text-center mb-4">保存到我的素材</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleSaveAsAsset('product')}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-zinc-900">保存到我的商品</p>
                          <p className="text-xs text-zinc-500">可在拍摄时选择使用</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSaveAsAsset('model')}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-zinc-900">保存到我的模特</p>
                          <p className="text-xs text-zinc-500">可在拍摄时作为参考模特</p>
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={() => setShowSaveMenu(false)}
                      className="w-full mt-4 p-3 text-zinc-500 font-medium"
                    >
                      取消
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Delete Confirmation */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    className="bg-white rounded-2xl w-full max-w-sm p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-center mb-2">确认删除？</h3>
                    <p className="text-sm text-zinc-500 text-center mb-6">
                      删除后将无法恢复，同一批次生成的所有图片都会被删除
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 h-11 rounded-lg border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 h-11 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Save Success Toast */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center"
          >
            <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-medium">{saveSuccess}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
            >
              {() => (
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full flex items-center justify-center"
                  >
                    {/* Use img tag for native long-press save support */}
                    <img
                      src={fullscreenImage}
                      alt="Fullscreen"
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />
                  </motion.div>
                </TransformComponent>
              )}
            </TransformWrapper>
            
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">长按保存 · 双指缩放 · 双击重置</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Generating card component
function GeneratingCard({ task }: { task: GenerationTask }) {
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
  
  // Get expected image count, fallback to defaults
  const imageCount = task.expectedImageCount || (isStudio ? 2 : isEdit ? 1 : 6)
  
  const subtitle = isStudio 
    ? `AI 正在生成 ${imageCount} 张商品图` 
    : isEdit 
      ? 'AI 正在处理您的图片'
      : `AI 正在生成 ${imageCount} 张模特图`
  
  const badgeText = isStudio 
    ? '商品影棚' 
    : isEdit 
      ? '修图室'
      : '模特影棚'
  
  return (
    <div className={`relative aspect-[4/5] bg-gradient-to-br ${bgGradient} rounded-xl overflow-hidden shadow-sm border-2 border-dashed ${borderColor}`}>
      <div className="absolute inset-0 opacity-30">
        <Image 
          src={task.inputImageUrl} 
          alt="Generating" 
          fill 
          className="object-cover blur-sm" 
        />
      </div>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative mb-3">
          <div className={`absolute inset-0 ${pulseColor} blur-lg rounded-full animate-pulse`} />
          <Loader2 className={`w-10 h-10 ${spinnerColor} animate-spin relative z-10`} />
        </div>
        <span className={`${textColor} font-semibold text-sm`}>{title}</span>
        <span className={`${subTextColor} text-xs mt-1`}>{subtitle}</span>
      </div>
      
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-1 rounded text-[10px] font-medium ${badgeColor} text-white animate-pulse`}>
          {badgeText}
        </span>
      </div>
    </div>
  )
}
