"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Plus, Upload, Trash2, Users, Image as ImageIcon, Package } from "lucide-react"
import { Header } from "@/components/shared/Header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
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
    
    // Reset input
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
  
  return (
    <div className="min-h-screen bg-primary">
      <Header 
        title="品牌资产" 
        rightElement={
          <button
            onClick={() => handleUploadClick(activeTab)}
            className="flex items-center gap-1 text-accent text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            上传
          </button>
        }
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <div className="px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              模特
            </TabsTrigger>
            <TabsTrigger value="background" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              背景
            </TabsTrigger>
            <TabsTrigger value="product" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              商品
            </TabsTrigger>
          </TabsList>
          
          {(["model", "background", "product"] as AssetType[]).map((type) => (
            <TabsContent key={type} value={type} className="space-y-6">
              {/* System presets */}
              {systemPresets[type].length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-400">系统预设</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {systemPresets[type].map((asset) => (
                      <AssetCard key={asset.id} asset={asset} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* User assets */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400">我的资产</h3>
                {getUserAssets(type).length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {getUserAssets(type).map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onDelete={() => handleDelete(type, asset.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={type === "model" ? Users : type === "background" ? ImageIcon : Package}
                    title={`还没有${type === "model" ? "模特" : type === "background" ? "背景" : "商品"}素材`}
                    description={`上传${type === "model" ? "模特" : type === "background" ? "背景" : "商品"}图片，让生成更符合品牌调性`}
                    actionLabel="立即上传"
                    onAction={() => handleUploadClick(type)}
                  />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete?: () => void }) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-surface group">
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
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {asset.isSystem && (
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-accent/80 rounded text-[10px] text-primary font-medium">
          预设
        </div>
      )}
    </div>
  )
}

