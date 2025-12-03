"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, Upload, Home, Pin, X, ZoomIn, RefreshCw } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { Asset, AssetType } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_VIBES, PRESET_PRODUCTS } from "@/data/presets"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageStore } from "@/stores/languageStore"

// System presets from centralized data
const systemPresets: Record<AssetType, Asset[]> = {
  model: PRESET_MODELS,
  background: PRESET_BACKGROUNDS,
  product: PRESET_PRODUCTS,
  vibe: PRESET_VIBES,
}

type SourceTab = "user" | "preset"

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
  } = useAssetStore()
  
  const isSyncing = authSyncing || storeSyncing
  
  const getUserAssets = (type: AssetType): Asset[] => {
    switch (type) {
      case "model": return userModels
      case "background": return userBackgrounds
      case "product": return userProducts
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
  const presetAssets = systemPresets[activeType] || []
  
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
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {displayAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayAssets.map((asset) => (
              <AssetCard
                key={asset.id}
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
            {useLanguageStore.getState().translations.common.official}
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
