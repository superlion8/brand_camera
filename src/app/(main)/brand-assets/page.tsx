"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Plus, Trash2, Users, Image as ImageIcon, Package, X, Check } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { Asset, AssetType } from "@/types"
import { fileToBase64, generateId } from "@/lib/utils"

// Demo system presets
const systemPresets: Record<AssetType, Asset[]> = {
  model: [
    { id: "sm1", type: "model", name: "日系模特", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", isSystem: true, styleCategory: "japanese" },
    { id: "sm2", type: "model", name: "韩系模特", imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", isSystem: true, styleCategory: "korean" },
    { id: "sm3", type: "model", name: "中式模特", imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", isSystem: true, styleCategory: "chinese" },
    { id: "sm4", type: "model", name: "欧美模特", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", isSystem: true, styleCategory: "western" },
  ],
  background: [
    { id: "sb1", type: "background", name: "纯白背景", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", isSystem: true },
    { id: "sb2", type: "background", name: "城市街景", imageUrl: "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?w=400", isSystem: true },
    { id: "sb3", type: "background", name: "自然风光", imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400", isSystem: true },
  ],
  product: [],
  vibe: [
    { id: "sv1", type: "vibe", name: "奢华感", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", isSystem: true },
    { id: "sv2", type: "vibe", name: "休闲风", imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400", isSystem: true },
  ],
}

const tabs = [
  { value: "model" as AssetType, label: "模特", icon: Users },
  { value: "background" as AssetType, label: "背景", icon: ImageIcon },
  { value: "product" as AssetType, label: "商品", icon: Package },
]

export default function BrandAssetsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<AssetType>("model")
  const [uploadType, setUploadType] = useState<AssetType>("model")
  
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
        setUserModels(userModels.filter(a => a.id !== id))
        break
      case "background":
        setUserBackgrounds(userBackgrounds.filter(a => a.id !== id))
        break
      case "product":
        setUserProducts(userProducts.filter(a => a.id !== id))
        break
    }
  }
  
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
  
  return (
    <div className="min-h-screen bg-black">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 glass-dark border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4">
          <h1 className="text-white text-lg font-bold">品牌资产</h1>
          <button
            onClick={() => handleUploadClick(activeTab)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-black text-sm font-medium active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            上传
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex px-4 gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                  activeTab === tab.value 
                    ? "border-accent text-white" 
                    : "border-transparent text-white/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <div className="px-4 py-4 space-y-6 pb-24">
        {/* System presets */}
        {systemPresets[activeTab].length > 0 && (
          <div className="space-y-3">
            <h3 className="text-white/60 text-xs font-semibold uppercase">系统预设</h3>
            <div className="grid grid-cols-3 gap-3">
              {systemPresets[activeTab].map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        )}
        
        {/* User assets */}
        <div className="space-y-3">
          <h3 className="text-white/60 text-xs font-semibold uppercase">我的资产</h3>
          {getUserAssets(activeTab).length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {getUserAssets(activeTab).map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={() => handleDelete(activeTab, asset.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
                {activeTab === "model" && <Users className="w-8 h-8 text-white/30" />}
                {activeTab === "background" && <ImageIcon className="w-8 h-8 text-white/30" />}
                {activeTab === "product" && <Package className="w-8 h-8 text-white/30" />}
              </div>
              <p className="text-white font-medium mb-2">
                还没有{activeTab === "model" ? "模特" : activeTab === "background" ? "背景" : "商品"}素材
              </p>
              <p className="text-white/60 text-sm mb-6">
                上传素材，让生成更符合品牌调性
              </p>
              <button
                onClick={() => handleUploadClick(activeTab)}
                className="px-6 py-3 rounded-full bg-accent text-black font-medium active:scale-95 transition-transform"
              >
                立即上传
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete?: () => void }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group">
      <Image
        src={asset.imageUrl}
        alt={asset.name || "Asset"}
        fill
        className="object-cover"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-xs text-white truncate">{asset.name}</p>
        </div>
        
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:bg-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {asset.isSystem && (
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-accent rounded text-[10px] text-black font-medium">
          预设
        </div>
      )}
    </div>
  )
}
