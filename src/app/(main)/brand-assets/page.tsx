"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, Sparkles, Upload, MoreVertical } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Asset, AssetType } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"

// Demo system presets
const systemPresets: Record<AssetType, Asset[]> = {
  model: [
    { id: "sm1", type: "model", name: "Japanese Style", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", isSystem: true, styleCategory: "japanese" },
    { id: "sm2", type: "model", name: "Korean Clean", imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", isSystem: true, styleCategory: "korean" },
    { id: "sm3", type: "model", name: "Chinese Modern", imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", isSystem: true, styleCategory: "chinese" },
    { id: "sm4", type: "model", name: "Western Casual", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", isSystem: true, styleCategory: "western" },
  ],
  background: [
    { id: "sb1", type: "background", name: "Minimal Studio", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", isSystem: true },
    { id: "sb2", type: "background", name: "Urban Street", imageUrl: "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?w=400", isSystem: true },
    { id: "sb3", type: "background", name: "Nature Soft", imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400", isSystem: true },
  ],
  product: [],
  vibe: [
    { id: "sv1", type: "vibe", name: "Warm & Cozy", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", isSystem: true },
    { id: "sv2", type: "vibe", name: "Cool & Edgy", imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400", isSystem: true },
  ],
}

const tabs = [
  { value: "product" as AssetType, label: "商品", icon: Package },
  { value: "model" as AssetType, label: "模特", icon: Users },
  { value: "background" as AssetType, label: "背景", icon: ImageIcon },
  { value: "vibe" as AssetType, label: "氛围", icon: Sparkles },
]

export default function BrandAssetsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<AssetType>("product")
  const [uploadType, setUploadType] = useState<AssetType>("product")
  
  const {
    userModels,
    userBackgrounds,
    userProducts,
    setUserModels,
    setUserBackgrounds,
    setUserProducts,
    _hasHydrated,
  } = useAssetStore()
  
  const getUserAssets = (type: AssetType): Asset[] => {
    switch (type) {
      case "model": return userModels
      case "background": return userBackgrounds
      case "product": return userProducts
      default: return []
    }
  }
  
  const handleUploadClick = (type: AssetType) => {
    setUploadType(type)
    fileInputRef.current?.click()
  }
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const base64 = await fileToBase64(file)
    const newAsset: Asset = {
      id: generateId(),
      type: uploadType,
      name: file.name.replace(/\.[^/.]+$/, ""),
      imageUrl: base64,
    }
    
    switch (uploadType) {
      case "model":
        setUserModels([...userModels, newAsset])
        break
      case "background":
        setUserBackgrounds([...userBackgrounds, newAsset])
        break
      case "product":
        setUserProducts([...userProducts, newAsset])
        break
    }
    
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
    }
  }
  
  if (!_hasHydrated) {
    return (
      <div className="h-screen w-full bg-zinc-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50 bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {/* Header */}
      <div className="h-14 border-b bg-white bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
          <span className="font-semibold text-lg text-zinc-900 text-zinc-900">品牌资产</span>
        </div>
        <button
          onClick={() => handleUploadClick(activeTab)}
          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 dark:bg-white text-white text-zinc-500 text-sm font-medium rounded-lg hover:bg-zinc-800 hover:bg-zinc-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          上传
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 pt-4">
          <div className="w-full grid grid-cols-4 bg-zinc-100 bg-zinc-100 rounded-lg p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.value
                      ? "bg-white bg-white text-zinc-900 text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* System presets for model, background, vibe */}
          {systemPresets[activeTab]?.length > 0 && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">官方预设</h3>
              <div className="grid grid-cols-3 gap-3">
                {systemPresets[activeTab].map((asset) => (
                  <AssetCard key={asset.id} asset={asset} isPreset />
                ))}
              </div>
            </div>
          )}
          
          {/* User assets */}
          <div className="p-4 pt-0">
            <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">我的资产</h3>
            {getUserAssets(activeTab).length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {getUserAssets(activeTab).map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onDelete={() => handleDelete(activeTab, asset.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <div className="w-16 h-16 bg-zinc-100 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-zinc-300 text-zinc-500" />
                </div>
                <p className="text-zinc-600 text-zinc-500 mb-2">
                  暂无{activeTab === "model" ? "模特" : activeTab === "background" ? "背景" : activeTab === "vibe" ? "氛围" : "商品"}资产
                </p>
                <button
                  onClick={() => handleUploadClick(activeTab)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  点击上传
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AssetCard({ 
  asset, 
  onDelete,
  isPreset = false
}: { 
  asset: Asset
  onDelete?: () => void
  isPreset?: boolean
}) {
  return (
    <div className="group relative bg-white bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-100 border-zinc-200">
      <div className="aspect-square bg-zinc-100 bg-zinc-100 relative">
        <Image
          src={asset.imageUrl}
          alt={asset.name || "Asset"}
          fill
          className="object-cover"
        />
        {isPreset && (
          <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
            官方
          </span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="truncate flex-1 mr-2">
          <h4 className="text-sm font-medium text-zinc-900 text-zinc-900 truncate">{asset.name}</h4>
          <p className="text-xs text-zinc-500">{isPreset ? "预设" : "用户上传"}</p>
        </div>
        
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-zinc-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
