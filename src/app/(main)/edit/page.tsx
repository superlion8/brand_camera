"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Sparkles, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/shared/Header"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { StyleSelector } from "@/components/camera/StyleSelector"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { Asset, ModelStyle } from "@/types"
import { fileToBase64 } from "@/lib/utils"

export default function EditPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputImage, setInputImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<Asset | null>(null)
  const [modelStyle, setModelStyle] = useState<ModelStyle>("auto")
  const [customPrompt, setCustomPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setInputImage(base64)
      setResultImage(null)
    }
  }
  
  const handleGenerate = async () => {
    if (!inputImage) return
    
    setIsGenerating(true)
    
    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImage,
          modelImage: selectedModel?.imageUrl,
          modelStyle,
          backgroundImage: selectedBackground?.imageUrl,
          vibeImage: selectedVibe?.imageUrl,
          customPrompt,
        }),
      })
      
      const data = await response.json()
      
      if (data.success && data.image) {
        setResultImage(data.image)
      } else {
        throw new Error(data.error || "编辑失败")
      }
    } catch (error) {
      console.error("Edit error:", error)
      alert("编辑失败，请重试")
    } finally {
      setIsGenerating(false)
    }
  }
  
  const handleReset = () => {
    setInputImage(null)
    setResultImage(null)
    setSelectedModel(null)
    setSelectedBackground(null)
    setSelectedVibe(null)
    setModelStyle("auto")
    setCustomPrompt("")
  }
  
  return (
    <div className="min-h-screen bg-primary">
      <Header title="图像编辑" />
      
      <div className="px-4 py-4 space-y-6">
        {/* Input image area */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400">原始图片</h3>
          
          {inputImage ? (
            <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-surface">
              <Image
                src={inputImage}
                alt="Input image"
                fill
                className="object-cover"
              />
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 px-3 py-1 bg-black/50 rounded-full text-xs text-white hover:bg-black/70 transition-colors"
              >
                更换
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[3/4] rounded-card border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-gray-500 hover:border-accent hover:text-accent transition-colors"
            >
              <Upload className="w-10 h-10" />
              <span className="text-sm">点击上传图片</span>
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
        
        {inputImage && (
          <>
            {/* Style selector */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">模特风格</h3>
              <StyleSelector value={modelStyle} onChange={setModelStyle} />
            </div>
            
            {/* Asset selectors */}
            <AssetSelector
              title="选择模特"
              type="model"
              selected={selectedModel}
              onSelect={setSelectedModel}
              modelStyle={modelStyle}
            />
            
            <AssetSelector
              title="选择背景"
              type="background"
              selected={selectedBackground}
              onSelect={setSelectedBackground}
            />
            
            <AssetSelector
              title="选择 Vibe"
              type="vibe"
              selected={selectedVibe}
              onSelect={setSelectedVibe}
            />
            
            {/* Custom prompt */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">自定义提示词 (可选)</h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="描述你想要的效果..."
                className="w-full h-24 px-4 py-3 bg-surface border border-border rounded-input text-white placeholder-gray-500 resize-none focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            
            {/* Result image */}
            {resultImage && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400">生成结果</h3>
                <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-surface">
                  <Image
                    src={resultImage}
                    alt="Result image"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Generate button */}
        {inputImage && (
          <div className="sticky bottom-20 pt-4 pb-safe bg-gradient-to-t from-primary via-primary to-transparent">
            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full h-14 text-base"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {resultImage ? "重新生成" : "开始编辑"}
            </Button>
          </div>
        )}
        
        {/* Loading overlay */}
        {isGenerating && (
          <div className="fixed inset-0 z-50 bg-primary/90 flex items-center justify-center">
            <LoadingSpinner message="AI正在创作中..." />
          </div>
        )}
      </div>
    </div>
  )
}

