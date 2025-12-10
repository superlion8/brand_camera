"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, Upload, Home, Pin, X, ZoomIn, RefreshCw, Loader2 } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { Asset, AssetType } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"
import { useRouter } from "next/navigation"
// 使用硬编码预设数据（动态加载有 URL 问题）
import { PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_PRODUCTS, STUDIO_MODELS, ALL_STUDIO_BACKGROUNDS } from "@/data/presets"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageStore } from "@/stores/languageStore"

type SourceTab = "user" | "preset"
type ModelSubTab = "normal" | "studio"
type BackgroundSubTab = "normal" | "studio"
type ProductSubTab = "all" | "top" | "pants" | "inner" | "shoes" | "hat"

const PRODUCT_CATEGORIES: ProductSubTab[] = ["all", "top", "pants", "inner", "shoes", "hat"]

// 商品分类翻译映射
const getProductCategoryLabel = (cat: ProductSubTab, t: any): string => {
  switch (cat) {
    case "all": return t.common?.all || "全部"
    case "top": return t.assets?.productTop || "上衣"
    case "pants": return t.assets?.productPants || "裤子"
    case "inner": return t.assets?.productInner || "内衬"
    case "shoes": return t.assets?.productShoes || "鞋子"
    case "hat": return t.assets?.productHat || "帽子"
    default: return cat
  }
}

export default function BrandAssetsPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  // Type tabs with translated labels
  const typeTabs = [
    { value: "product" as AssetType, label: t.assets.products, icon: Package },
    { value: "model" as AssetType, label: t.assets.models, icon: Users },
    { value: "background" as AssetType, label: t.assets.backgrounds, icon: ImageIcon },
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
  
  // 使用硬编码预设数据
  const modelPresets = {
    normal: PRESET_MODELS,
    studio: STUDIO_MODELS,
  }
  
  const backgroundPresets = {
    normal: PRESET_BACKGROUNDS,
    studio: ALL_STUDIO_BACKGROUNDS,
  }
  
  const systemPresets: Record<AssetType, Asset[]> = {
    model: [...PRESET_MODELS, ...STUDIO_MODELS],
    background: [...PRESET_BACKGROUNDS, ...ALL_STUDIO_BACKGROUNDS],
    product: PRESET_PRODUCTS,
    vibe: [],
  }
  
  const isSyncing = authSyncing || storeSyncing || isInitialLoading
  
  const getUserAssets = (type: AssetType): Asset[] => {
    switch (type) {
      case "model": return userModels
      case "background": return userBackgrounds
      case "product": 
        // 商品支持二级分类筛选
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
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    // Process all files and add them using addUserAsset (which syncs to cloud)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base64 = await fileToBase64(file)
      const newAsset: Asset = {
        id: generateId(),
        type: uploadType,
        name: file.name.replace(/\.[^/.]+$/, ""),
        imageUrl: base64,
        // 如果上传的是商品且选择了具体分类，则设置 category
        ...(uploadType === 'product' && productSubTab !== 'all' && { category: productSubTab }),
      }
      
      // Use addUserAsset which handles both local state and cloud sync
      await addUserAsset(newAsset)
    }
    
    // Switch to user tab after upload
    setActiveSource("user")
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }
  
  const handleDelete = async (type: AssetType, id: string) => {
    // Use deleteUserAsset which handles both local state and cloud sync
    await deleteUserAsset(type, id)
  }
  
  const userAssets = getUserAssets(activeType)
  
  // 获取预设资产，模特和环境使用二级分类
  const getPresetAssets = () => {
    if (activeType === 'model') {
      return modelPresets[modelSubTab] || []
    }
    if (activeType === 'background') {
      return backgroundPresets[backgroundSubTab] || []
    }
    return systemPresets[activeType] || []
  }
  const presetAssets = getPresetAssets()
  
  // Sort user assets: pinned first
  const sortedUserAssets = [...userAssets].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
  
  // Sort preset assets: pinned first
  const sortedPresetAssets = [...presetAssets].sort((a, b) => {
    const aIsPinned = pinnedPresetIds.has(a.id)
    const bIsPinned = pinnedPresetIds.has(b.id)
    if (aIsPinned && !bIsPinned) return -1
    if (!aIsPinned && bIsPinned) return 1
    return 0
  })
  
  const displayAssets = activeSource === "user" ? sortedUserAssets : sortedPresetAssets
  
  if (!_hasHydrated) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">{t.common.loading}</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <Home className="w-5 h-5 text-zinc-600" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
              <span className="font-semibold text-lg text-zinc-900">{t.assets.title}</span>
              {/* Syncing indicator - only show when actively syncing */}
              {isSyncing && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {t.user.syncing}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleUploadClick(activeType)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.assets.upload}
          </button>
        </div>
        
        {/* Type Tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {typeTabs.map((tab) => {
            const Icon = tab.icon
            const userCount = getUserAssets(tab.value).length
            return (
              <button
                key={tab.value}
                onClick={() => setActiveType(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  activeType === tab.value
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {userCount > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeType === tab.value 
                      ? "bg-white/20 text-white" 
                      : "bg-zinc-200 text-zinc-500"
                  }`}>
                    {userCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Source Tabs: 我的资产 | 官方预设 */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => setActiveSource("user")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeSource === "user"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.common.my}{t.nav.assets}
            {userAssets.length > 0 && (
              <span className="ml-1.5 text-xs text-zinc-400">({userAssets.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveSource("preset")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeSource === "preset"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.common.official}{t.common.preset}
            {presetAssets.length > 0 && (
              <span className="ml-1.5 text-xs text-zinc-400">({presetAssets.length})</span>
            )}
          </button>
        </div>
        
        {/* 二级分类 - 模特 */}
        {activeSource === "preset" && activeType === "model" && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setModelSubTab("normal")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                modelSubTab === "normal"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.assets.normalModels || '普通模特'}
              <span className="ml-1 opacity-70">({modelPresets.normal.length})</span>
            </button>
            <button
              onClick={() => setModelSubTab("studio")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                modelSubTab === "studio"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.assets.studioModels || '高级模特'}
              <span className="ml-1 opacity-70">({modelPresets.studio.length})</span>
            </button>
          </div>
        )}
        
        {/* 二级分类 - 环境 */}
        {activeSource === "preset" && activeType === "background" && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setBackgroundSubTab("normal")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                backgroundSubTab === "normal"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.assets.normalBackgrounds || '普通背景'}
              <span className="ml-1 opacity-70">({backgroundPresets.normal.length})</span>
            </button>
            <button
              onClick={() => setBackgroundSubTab("studio")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                backgroundSubTab === "studio"
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.assets.studioBackgrounds || '棚拍背景'}
              <span className="ml-1 opacity-70">({backgroundPresets.studio.length})</span>
            </button>
          </div>
        )}
        
        {/* 二级分类 - 商品（仅我的资产） */}
        {activeSource === "user" && activeType === "product" && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {PRODUCT_CATEGORIES.map(cat => {
              const count = cat === "all" 
                ? userProducts.length 
                : userProducts.filter(p => p.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setProductSubTab(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    productSubTab === cat
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {getProductCategoryLabel(cat, t)}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {/* 初始加载时显示同步中提示 */}
        {isInitialLoading && activeSource === "user" && (
          <div className="flex items-center justify-center gap-2 py-3 mb-4 bg-blue-50 border border-blue-100 rounded-lg">
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600">{t.user.syncing}</span>
          </div>
        )}
        
        {displayAssets.length > 0 ? (
          <motion.div 
            className="grid grid-cols-2 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {displayAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
              >
                <AssetCard
                  asset={asset}
                  isPreset={activeSource === "preset"}
                  isPinned={activeSource === "preset" ? isPresetPinned(asset.id) : asset.isPinned}
                  onDelete={activeSource === "user" ? () => handleDelete(activeType, asset.id) : undefined}
                  onPin={activeSource === "user" 
                    ? () => togglePin(activeType, asset.id) 
                    : () => togglePresetPin(asset.id)
                  }
                  onZoom={() => setZoomImage(asset.imageUrl)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : isInitialLoading && activeSource === "user" ? (
          // 初始加载中显示骨架屏
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-zinc-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              {activeSource === "user" ? (
                <Upload className="w-8 h-8 text-zinc-300" />
              ) : (
                <Package className="w-8 h-8 text-zinc-300" />
              )}
            </div>
            <p className="text-zinc-600 mb-2 text-center">
              {activeSource === "user" 
                ? (activeType === "model" ? t.assets.noModels : activeType === "background" ? t.assets.noBackgrounds : t.assets.noProducts)
                : t.common.preset
              }
            </p>
            {activeSource === "user" && (
              <button
                onClick={() => handleUploadClick(activeType)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {t.assets.clickUpload}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Fullscreen Zoom Viewer */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              limitToBounds={false}
              doubleClick={{ disabled: false }}
              wheel={{ smoothStep: 0.01 }}
              pinch={{ disabled: false }}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Image
                  src={zoomImage}
                  alt="Fullscreen"
                  width={1080}
                  height={1920}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </TransformComponent>
            </TransformWrapper>

            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-[101] w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm z-[101]">
              {t.imageActions.longPressSaveZoom}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AssetCard({ 
  asset, 
  onDelete,
  onPin,
  onZoom,
  isPreset = false,
  isPinned = false
}: { 
  asset: Asset
  onDelete?: () => void
  onPin?: () => void
  onZoom?: () => void
  isPreset?: boolean
  isPinned?: boolean
}) {
  return (
    <div className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-100">
      <div 
        className="aspect-square bg-zinc-100 relative cursor-pointer"
        onClick={onZoom}
      >
        <Image
          src={asset.imageUrl}
          alt={asset.name || "Asset"}
          fill
          className="object-cover"
        />
        {isPreset && (
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            {useLanguageStore.getState().t.common.official}
          </span>
        )}
        {isPinned && (
          <span className="absolute top-2 right-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <Pin className="w-3 h-3" />
          </span>
        )}
        {/* Zoom hint on hover */}
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
              onClick={(e) => {
                e.stopPropagation()
                onPin()
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isPinned 
                  ? "bg-amber-50 text-amber-600 hover:bg-amber-100" 
                  : "hover:bg-zinc-100 text-zinc-400 hover:text-amber-600"
              }`}
              title={isPinned ? "取消置顶" : "置顶"}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
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
