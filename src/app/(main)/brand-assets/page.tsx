"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, Sparkles, Upload, Home, Pin } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Asset, AssetType, ModelSubcategory, BackgroundSubcategory } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { 
  PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_VIBES,
  MODEL_SUBCATEGORIES, BACKGROUND_SUBCATEGORIES
} from "@/data/presets"

// System presets from centralized data
const systemPresets: Record<AssetType, Asset[]> = {
  model: PRESET_MODELS,
  background: PRESET_BACKGROUNDS,
  product: [],
  vibe: PRESET_VIBES,
}

const typeTabs = [
  { value: "product" as AssetType, label: "商品", icon: Package },
  { value: "model" as AssetType, label: "模特", icon: Users },
  { value: "background" as AssetType, label: "背景", icon: ImageIcon },
  { value: "vibe" as AssetType, label: "氛围", icon: Sparkles },
]

type SourceTab = "user" | "preset"

export default function BrandAssetsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeType, setActiveType] = useState<AssetType>("product")
  const [activeSource, setActiveSource] = useState<SourceTab>("user")
  const [uploadType, setUploadType] = useState<AssetType>("product")
  const [modelSubcategory, setModelSubcategory] = useState<ModelSubcategory | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<BackgroundSubcategory | null>(null)
  
  const {
    userModels,
    userBackgrounds,
    userProducts,
    userVibes,
    setUserModels,
    setUserBackgrounds,
    setUserProducts,
    setUserVibes,
    togglePin,
    _hasHydrated,
  } = useAssetStore()
  
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
    
    // Process all files
    const newAssets: Asset[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base64 = await fileToBase64(file)
      newAssets.push({
        id: generateId(),
        type: uploadType,
        name: file.name.replace(/\.[^/.]+$/, ""),
        imageUrl: base64,
      })
    }
    
    // Add all new assets at once
    switch (uploadType) {
      case "model":
        setUserModels([...newAssets, ...userModels])
        break
      case "background":
        setUserBackgrounds([...newAssets, ...userBackgrounds])
        break
      case "product":
        setUserProducts([...newAssets, ...userProducts])
        break
      case "vibe":
        setUserVibes([...newAssets, ...userVibes])
        break
    }
    
    // Switch to user tab after upload
    setActiveSource("user")
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }
  
  const handleDelete = (type: AssetType, id: string) => {
    switch (type) {
      case "model":
        setUserModels(userModels.filter((a: Asset) => a.id !== id))
        break
      case "background":
        setUserBackgrounds(userBackgrounds.filter((a: Asset) => a.id !== id))
        break
      case "product":
        setUserProducts(userProducts.filter((a: Asset) => a.id !== id))
        break
      case "vibe":
        setUserVibes(userVibes.filter((a: Asset) => a.id !== id))
        break
    }
  }
  
  const userAssets = getUserAssets(activeType)
  let presetAssets = systemPresets[activeType] || []
  
  // Filter presets by subcategory if applicable
  if (activeType === "model" && modelSubcategory) {
    presetAssets = presetAssets.filter(a => a.subcategory === modelSubcategory)
  } else if (activeType === "background" && bgSubcategory) {
    presetAssets = presetAssets.filter(a => a.subcategory === bgSubcategory)
  }
  
  // Sort user assets: pinned first
  const sortedUserAssets = [...userAssets].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
  const displayAssets = activeSource === "user" ? sortedUserAssets : presetAssets
  
  if (!_hasHydrated) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">加载中...</p>
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
              <span className="font-semibold text-lg text-zinc-900">品牌资产</span>
            </div>
          </div>
          <button
            onClick={() => handleUploadClick(activeType)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            上传
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
            我的资产
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
            官方预设
            {presetAssets.length > 0 && (
              <span className="ml-1.5 text-xs text-zinc-400">({presetAssets.length})</span>
            )}
          </button>
        </div>
      </div>
      
      {/* Subcategory Tabs - only for model and background in preset mode */}
      {activeSource === "preset" && (activeType === "model" || activeType === "background") && (
        <div className="bg-white border-b px-4 py-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => activeType === "model" ? setModelSubcategory(null) : setBgSubcategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (activeType === "model" ? !modelSubcategory : !bgSubcategory)
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              全部
            </button>
            {activeType === "model" && MODEL_SUBCATEGORIES.map(sub => (
              <button
                key={sub.id}
                onClick={() => setModelSubcategory(modelSubcategory === sub.id ? null : sub.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  modelSubcategory === sub.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {sub.label}
              </button>
            ))}
            {activeType === "background" && BACKGROUND_SUBCATEGORIES.map(sub => (
              <button
                key={sub.id}
                onClick={() => setBgSubcategory(bgSubcategory === sub.id ? null : sub.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  bgSubcategory === sub.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isPreset={activeSource === "preset"}
                onDelete={activeSource === "user" ? () => handleDelete(activeType, asset.id) : undefined}
                onPin={activeSource === "user" ? () => togglePin(activeType, asset.id) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              {activeSource === "user" ? (
                <Upload className="w-8 h-8 text-zinc-300" />
              ) : (
                <Sparkles className="w-8 h-8 text-zinc-300" />
              )}
            </div>
            <p className="text-zinc-600 mb-2 text-center">
              {activeSource === "user" 
                ? `暂无${activeType === "model" ? "模特" : activeType === "background" ? "背景" : activeType === "vibe" ? "氛围" : "商品"}资产`
                : "该分类暂无官方预设"
              }
            </p>
            {activeSource === "user" && (
              <button
                onClick={() => handleUploadClick(activeType)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                点击上传
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AssetCard({ 
  asset, 
  onDelete,
  onPin,
  isPreset = false
}: { 
  asset: Asset
  onDelete?: () => void
  onPin?: () => void
  isPreset?: boolean
}) {
  return (
    <div className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-100">
      <div className="aspect-square bg-zinc-100 relative">
        <Image
          src={asset.imageUrl}
          alt={asset.name || "Asset"}
          fill
          className="object-cover"
        />
        {isPreset && (
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            官方
          </span>
        )}
        {asset.isPinned && (
          <span className="absolute top-2 right-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <Pin className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="truncate flex-1 mr-2">
          <h4 className="text-sm font-medium text-zinc-900 truncate">{asset.name}</h4>
          {asset.styleCategory && (
            <p className="text-xs text-zinc-400 capitalize">{asset.styleCategory}</p>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {onPin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPin()
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                asset.isPinned 
                  ? "bg-amber-50 text-amber-600 hover:bg-amber-100" 
                  : "hover:bg-zinc-100 text-zinc-400 hover:text-amber-600"
              }`}
              title={asset.isPinned ? "取消置顶" : "置顶"}
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
