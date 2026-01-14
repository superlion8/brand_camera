"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, Upload, Home, Pin, ZoomIn, RefreshCw, FolderOpen, Sparkles } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { Asset, AssetType } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { usePresetStore } from "@/stores/presetStore"
import { FullscreenImageViewer } from "@/components/shared/FullscreenImageViewer"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageStore } from "@/stores/languageStore"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"

type SourceTab = "user" | "preset"
type ModelSubTab = "normal" | "studio"
type BackgroundSubTab = "normal" | "studio"
type ProductSubTab = "all" | "top" | "pants" | "inner" | "shoes" | "hat"

const PRODUCT_CATEGORIES: ProductSubTab[] = ["all", "top", "pants", "inner", "shoes", "hat"]

// 商品分类翻译映射
const getProductCategoryLabel = (cat: ProductSubTab, t: any): string => {
  switch (cat) {
    case "all": return t.common?.all || "All"
    case "top": return t.assets?.productTop || "Tops"
    case "pants": return t.assets?.productPants || "Pants"
    case "inner": return t.assets?.productInner || "Inner"
    case "shoes": return t.assets?.productShoes || "Shoes"
    case "hat": return t.assets?.productHat || "Hats"
    default: return cat
  }
}

export default function BrandAssetsPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // Type tabs with translated labels
  const typeTabs = [
    { value: "product" as AssetType, label: t.assets.products, icon: Package },
    { value: "model" as AssetType, label: t.assets.models, icon: Users },
    { value: "background" as AssetType, label: t.assets.scenes, icon: ImageIcon },
  ]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeType, setActiveType] = useState<AssetType>("product")
  const [activeSource, setActiveSource] = useState<SourceTab>("user")
  const [uploadType, setUploadType] = useState<AssetType>("product")
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  // 二级分类状态
  const [modelSubTab, setModelSubTab] = useState<ModelSubTab>("normal")
  const [backgroundSubTab, setBackgroundSubTab] = useState<BackgroundSubTab>("normal")
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("all")
  
  // Auth and sync state
  const { isSyncing: authSyncing } = useAuth()
  
  const {
    userModels,
    userBackgrounds,
    userProducts,
    userVibes,
    pinnedPresetIds,
    addUserAsset,
    deleteUserAsset,
    togglePin,
    togglePresetPin,
    isPresetPinned,
    _hasHydrated,
    isSyncing: storeSyncing,
    isInitialLoading,
  } = useAssetStore()
  
  // 动态加载预设资源
  const {
    visibleModels,
    visibleBackgrounds,
    studioModels,
    studioBackgrounds,
    presetProducts,
    isLoading: presetsLoading,
    loadPresets,
  } = usePresetStore()
  
  // 用于跟踪是否已加载
  const hasLoadedRef = useRef(false)
  
  // 每次进入页面强制刷新预设（无缓存）
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadPresets(true)
    return () => { hasLoadedRef.current = false }
  }, [loadPresets])
  
  // 动态预设数据
  const modelPresets = { normal: visibleModels, studio: studioModels }
  const backgroundPresets = { normal: visibleBackgrounds, studio: studioBackgrounds }
  const systemPresets: Record<AssetType, Asset[]> = {
    model: [...visibleModels, ...studioModels],
    background: [...visibleBackgrounds, ...studioBackgrounds],
    product: presetProducts,
    vibe: [],
  }
  
  const isSyncing = authSyncing || storeSyncing || isInitialLoading || presetsLoading
  
  const getUserAssets = (type: AssetType): Asset[] => {
    switch (type) {
      case "model": return userModels
      case "background": return userBackgrounds
      case "product": 
        if (productSubTab === "all") return userProducts
        return userProducts.filter(p => p.category === productSubTab)
      case "vibe": return userVibes
      default: return []
    }
  }
  
  const handleUploadClick = (type: AssetType) => {
    setUploadType(type)
    fileInputRef.current?.click()
  }
  
  const generateAssetName = (type: AssetType, existingAssets: Asset[]): string => {
    const prefix = type === 'background' ? 'scene' : type
    const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i')
    let maxNumber = 0
    existingAssets.forEach(asset => {
      const match = asset.name?.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    })
    return `${prefix}${maxNumber + 1}`
  }
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const existingAssets = uploadType === 'product' ? userProducts 
      : uploadType === 'model' ? userModels 
      : uploadType === 'background' ? userBackgrounds 
      : userVibes
    
    let currentAssets = [...existingAssets]
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base64 = await fileToBase64(file)
      const assetName = generateAssetName(uploadType, currentAssets)
      const newAsset: Asset = {
        id: generateId(),
        type: uploadType,
        name: assetName,
        imageUrl: base64,
        ...(uploadType === 'product' && productSubTab !== 'all' && { category: productSubTab }),
      }
      await addUserAsset(newAsset)
      currentAssets = [...currentAssets, newAsset]
    }
    setActiveSource("user")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }
  
  const handleDelete = async (type: AssetType, id: string) => {
    await deleteUserAsset(type, id)
  }
  
  const userAssets = getUserAssets(activeType)
  
  const getPresetAssets = () => {
    if (activeType === 'model') return modelPresets[modelSubTab] || []
    if (activeType === 'background') return backgroundPresets[backgroundSubTab] || []
    return systemPresets[activeType] || []
  }
  const presetAssets = getPresetAssets()
  
  const sortedUserAssets = [...userAssets].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
  
  const sortedPresetAssets = [...presetAssets].sort((a, b) => {
    const aIsPinned = pinnedPresetIds.has(a.id)
    const bIsPinned = pinnedPresetIds.has(b.id)
    if (aIsPinned && !bIsPinned) return -1
    if (!aIsPinned && bIsPinned) return 1
    return 0
  })
  
  const displayAssets = activeSource === "user" ? sortedUserAssets : sortedPresetAssets
  
  if (!_hasHydrated || screenLoading) {
    return <ScreenLoadingGuard><div className="h-screen bg-zinc-50" /></ScreenLoadingGuard>
  }

  // ====== PC Desktop Layout ======
  // No separate sidebar - use global Sidebar from layout
  // Information architecture: Category (Products/Models/Scenes) -> Source (My/Market)
  if (isDesktop) {
    return (
      <div className="h-full flex flex-col bg-zinc-50">
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
        
        {/* Top Header with Category Tabs */}
        <div className="bg-white border-b border-zinc-200 shrink-0">
          <div className="px-8 py-4">
            {/* Page Title */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-zinc-900">{t.assets.title}</h1>
              <div className="flex items-center gap-3">
                {isSyncing && (
                  <div className="flex items-center gap-2 text-blue-600 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.user.syncing}</span>
                  </div>
                )}
                <button
                  onClick={() => { hasLoadedRef.current = false; loadPresets(true) }}
                  disabled={presetsLoading}
                  className="w-10 h-10 rounded-xl border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 text-zinc-600 ${presetsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => handleUploadClick(activeType)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  {t.common?.upload || 'Upload'}
                </button>
              </div>
            </div>
            
            {/* Category Tabs */}
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
              {typeTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeType === tab.value
                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveType(tab.value)
                      // Reset to "user" source when switching categories (except for products which has no market)
                      if (tab.value !== "product") {
                        setActiveSource("user")
                      }
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                      isActive
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Source Sub-tabs (My / Market) - Only for Models and Scenes */}
          {activeType !== "product" && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveSource("user")}
                  className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                    activeSource === "user" 
                      ? "border-blue-600 text-blue-600" 
                      : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="font-medium">
                    {t.common?.my || 'My'} {activeType === "model" ? t.assets?.models : t.assets?.scenes}
                  </span>
                  <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
                    {activeType === "model" ? userModels.length : userBackgrounds.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveSource("preset")}
                  className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                    activeSource === "preset" 
                      ? "border-purple-600 text-purple-600" 
                      : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">
                    {activeType === "model" ? (t.assets?.modelMarket || 'Model Market') : (t.assets?.sceneMarket || 'Scene Market')}
                  </span>
                  <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
                    {activeType === "model" ? systemPresets.model.length : systemPresets.background.length}
                  </span>
                </button>
              </div>
            </div>
          )}
          
          {/* Product Category Filter (only for products) */}
          {activeType === "product" && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {PRODUCT_CATEGORIES.map(cat => {
                  const count = cat === "all" ? userProducts.length : userProducts.filter(p => p.category === cat).length
                  const isActive = productSubTab === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setProductSubTab(cat)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {getProductCategoryLabel(cat, t)} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Model/Scene Type Filter (only for preset models/scenes) */}
          {activeSource === "preset" && activeType === "model" && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModelSubTab("normal")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    modelSubTab === "normal"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {t.assets?.normalModels || 'Lifestyle'} ({modelPresets.normal.length})
                </button>
                <button
                  onClick={() => setModelSubTab("studio")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    modelSubTab === "studio"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {t.assets?.studioModels || 'Studio'} ({modelPresets.studio.length})
                </button>
              </div>
            </div>
          )}
          
          {activeSource === "preset" && activeType === "background" && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBackgroundSubTab("normal")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    backgroundSubTab === "normal"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {t.assets?.normalScenes || 'Lifestyle'} ({backgroundPresets.normal.length})
                </button>
                <button
                  onClick={() => setBackgroundSubTab("studio")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    backgroundSubTab === "studio"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {t.assets?.studioScenes || 'Studio'} ({backgroundPresets.studio.length})
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {displayAssets.length > 0 ? (
            <motion.div 
              key={`grid-${activeType}-${activeSource}-${modelSubTab}-${backgroundSubTab}-${productSubTab}`}
              className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {displayAssets.map((asset, index) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
                >
                  <AssetCardDesktop
                    asset={asset}
                    isPreset={activeSource === "preset"}
                    isPinned={activeSource === "preset" ? isPresetPinned(asset.id) : asset.isPinned}
                    onDelete={activeSource === "user" ? () => handleDelete(activeType, asset.id) : undefined}
                    onPin={activeSource === "user" ? () => togglePin(activeType, asset.id) : () => togglePresetPin(asset.id)}
                    onZoom={() => setZoomImage(asset.imageUrl)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : isInitialLoading && activeSource === "user" ? (
            <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[3/4] bg-zinc-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
              <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6">
                {activeSource === "user" ? <Upload className="w-10 h-10 text-zinc-300" /> : <Package className="w-10 h-10 text-zinc-300" />}
              </div>
              <p className="text-lg text-zinc-600 mb-2">
                {activeSource === "user" 
                  ? (activeType === "model" ? t.assets.noModels : activeType === "background" ? t.assets.noScenes : t.assets.noProducts)
                  : "No presets available"
                }
              </p>
              {activeSource === "user" && (
                <button onClick={() => handleUploadClick(activeType)} className="text-blue-600 hover:text-blue-700 font-medium">
                  {t.assets.clickUpload}
                </button>
              )}
            </div>
          )}
        </div>
        
        <FullscreenImageViewer open={!!zoomImage} onClose={() => setZoomImage(null)} imageUrl={zoomImage || ''} />
      </div>
    )
  }
  
  // ====== Mobile Layout (Original) ======
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
      
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center">
            <button onClick={() => router.push("/")} className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors">
              <Home className="w-5 h-5 text-zinc-600" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
              <span className="font-semibold text-lg text-zinc-900">{t.assets.title}</span>
              {isSyncing && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {t.user.syncing}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { hasLoadedRef.current = false; loadPresets(true) }} disabled={presetsLoading} className="w-9 h-9 rounded-lg border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-zinc-600 ${presetsLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => handleUploadClick(activeType)} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors">
              <Plus className="w-4 h-4" />
              {t.assets.upload}
            </button>
          </div>
        </div>
        
        {/* Type Tabs */}
        <div className="pb-3 flex gap-2 overflow-x-auto hide-scrollbar px-4">
          {typeTabs.map((tab) => {
            const Icon = tab.icon
            const userCount = getUserAssets(tab.value).length
            return (
              <button
                key={tab.value}
                onClick={() => setActiveType(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  activeType === tab.value ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {userCount > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeType === tab.value ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-500"}`}>
                    {userCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Source Tabs */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => setActiveSource("user")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeSource === "user" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            {t.common.my}{t.nav.assets}
            {userAssets.length > 0 && <span className="ml-1.5 text-xs text-zinc-400">({userAssets.length})</span>}
          </button>
          <button
            onClick={() => setActiveSource("preset")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeSource === "preset" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            {t.common.official}{t.common.preset}
            {presetAssets.length > 0 && <span className="ml-1.5 text-xs text-zinc-400">({presetAssets.length})</span>}
          </button>
        </div>
        
        {/* Sub-filters */}
        {activeSource === "preset" && activeType === "model" && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => setModelSubTab("normal")} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${modelSubTab === "normal" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {t.assets.normalModels || 'Regular'} ({modelPresets.normal.length})
            </button>
            <button onClick={() => setModelSubTab("studio")} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${modelSubTab === "studio" ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {t.assets.studioModels || 'Studio'} ({modelPresets.studio.length})
            </button>
          </div>
        )}
        
        {activeSource === "preset" && activeType === "background" && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => setBackgroundSubTab("normal")} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${backgroundSubTab === "normal" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {t.assets.normalScenes || 'Regular'} ({backgroundPresets.normal.length})
            </button>
            <button onClick={() => setBackgroundSubTab("studio")} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${backgroundSubTab === "studio" ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {t.assets.studioScenes || 'Studio'} ({backgroundPresets.studio.length})
            </button>
          </div>
        )}
        
        {activeSource === "user" && activeType === "product" && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {PRODUCT_CATEGORIES.map(cat => {
              const count = cat === "all" ? userProducts.length : userProducts.filter(p => p.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setProductSubTab(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${productSubTab === cat ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                >
                  {getProductCategoryLabel(cat, t)} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 p-4">
        {displayAssets.length > 0 ? (
          <motion.div key={`grid-${activeType}-${activeSource}`} className="grid grid-cols-2 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {displayAssets.map((asset, index) => (
              <motion.div key={asset.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}>
                <AssetCard
                  asset={asset}
                  isPreset={activeSource === "preset"}
                  isPinned={activeSource === "preset" ? isPresetPinned(asset.id) : asset.isPinned}
                  onDelete={activeSource === "user" ? () => handleDelete(activeType, asset.id) : undefined}
                  onPin={activeSource === "user" ? () => togglePin(activeType, asset.id) : () => togglePresetPin(asset.id)}
                  onZoom={() => setZoomImage(asset.imageUrl)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              {activeSource === "user" ? <Upload className="w-8 h-8 text-zinc-300" /> : <Package className="w-8 h-8 text-zinc-300" />}
            </div>
            <p className="text-zinc-600 mb-2 text-center">
              {activeSource === "user" ? (activeType === "model" ? t.assets.noModels : activeType === "background" ? t.assets.noScenes : t.assets.noProducts) : t.common.preset}
            </p>
            {activeSource === "user" && (
              <button onClick={() => handleUploadClick(activeType)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                {t.assets.clickUpload}
              </button>
            )}
          </div>
        )}
      </div>
      
      <FullscreenImageViewer open={!!zoomImage} onClose={() => setZoomImage(null)} imageUrl={zoomImage || ''} />
    </div>
  )
}

// ====== Desktop Asset Card ======
function AssetCardDesktop({ 
  asset, onDelete, onPin, onZoom, isPreset = false, isPinned = false
}: { 
  asset: Asset
  onDelete?: () => void
  onPin?: () => void
  onZoom?: () => void
  isPreset?: boolean
  isPinned?: boolean
}) {
  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-100 hover:shadow-lg hover:border-zinc-200 transition-all duration-200">
      <div className="aspect-[3/4] bg-zinc-100 relative cursor-pointer overflow-hidden" onClick={onZoom}>
        <Image src={asset.imageUrl} alt={asset.name || "Asset"} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isPreset && (
            <span className="bg-zinc-900/80 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full font-medium">
              Official
            </span>
          )}
          {isPinned && (
            <span className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
              <Pin className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <ZoomIn className="w-6 h-6 text-zinc-700" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-900 truncate flex-1 mr-2">{asset.name}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin() }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isPinned ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "hover:bg-zinc-100 text-zinc-400 hover:text-amber-600"
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-zinc-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
            </div>
    </div>
  )
}

// ====== Mobile Asset Card (Original) ======
function AssetCard({ 
  asset, onDelete, onPin, onZoom, isPreset = false, isPinned = false
}: { 
  asset: Asset
  onDelete?: () => void
  onPin?: () => void
  onZoom?: () => void
  isPreset?: boolean
  isPinned?: boolean
}) {
  const t = useLanguageStore(state => state.t)
  
  return (
    <div className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-100">
      <div className="aspect-square bg-zinc-100 relative cursor-pointer" onClick={onZoom}>
        <Image src={asset.imageUrl} alt={asset.name || "Asset"} fill className="object-cover" unoptimized />
        {isPreset && (
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            {t.common.official}
          </span>
        )}
        {isPinned && (
          <span className="absolute top-2 right-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <Pin className="w-3 h-3" />
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="truncate flex-1 mr-2">
          <h4 className="text-sm font-medium text-zinc-900 truncate">{asset.name}</h4>
        </div>
        <div className="flex items-center gap-1">
          {onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin() }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isPinned ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "hover:bg-zinc-100 text-zinc-400 hover:text-amber-600"
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-zinc-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
