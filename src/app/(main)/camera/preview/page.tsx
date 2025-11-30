"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronLeft, Sparkles, Check } from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { ModelStyle } from "@/types"

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能" },
  { value: "japanese", label: "日系" },
  { value: "korean", label: "韩系" },
  { value: "chinese", label: "中式" },
  { value: "western", label: "欧美" },
]

export default function PreviewPage() {
  const router = useRouter()
  const {
    capturedImage,
    selectedModel,
    selectedBackground,
    selectedVibe,
    modelStyle,
    isGenerating,
    setSelectedModel,
    setSelectedBackground,
    setSelectedVibe,
    setModelStyle,
    setIsGenerating,
    setGeneratedImages,
    reset
  } = useCameraStore()
  
  useEffect(() => {
    if (!capturedImage) {
      router.replace("/camera")
    }
  }, [capturedImage, router])
  
  const handleRetake = () => {
    reset()
    router.replace("/camera")
  }
  
  const handleGenerate = async () => {
    if (!capturedImage) return
    
    setIsGenerating(true)
    
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImage: capturedImage,
          modelImage: selectedModel?.imageUrl,
          modelStyle,
          backgroundImage: selectedBackground?.imageUrl,
          vibeImage: selectedVibe?.imageUrl,
        }),
      })
      
      const data = await response.json()
      
      if (data.success && data.images) {
        setGeneratedImages(data.images)
        router.push("/camera/result")
      } else {
        throw new Error(data.error || "生成失败")
      }
    } catch (error) {
      console.error("Generation error:", error)
      alert("生成失败，请重试")
    } finally {
      setIsGenerating(false)
    }
  }
  
  if (!capturedImage) return null
  
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 glass-dark border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4 pt-safe">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-semibold">商品预览</h1>
          <button 
            onClick={handleRetake}
            className="text-accent text-sm font-medium"
          >
            重拍
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Product preview */}
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5">
          <Image
            src={capturedImage}
            alt="Product preview"
            fill
            className="object-cover"
          />
        </div>
        
        {/* Style selector */}
        <div className="space-y-3">
          <h3 className="text-white/60 text-xs font-semibold uppercase">模特风格</h3>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {styleOptions.map((style) => (
              <button
                key={style.value}
                onClick={() => setModelStyle(style.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  modelStyle === style.value
                    ? "bg-accent text-black"
                    : "glass text-white"
                }`}
              >
                {modelStyle === style.value && <Check className="w-4 h-4" />}
                {style.label}
              </button>
            ))}
          </div>
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
      </div>
      
      {/* Generate button */}
      <div className="sticky bottom-0 p-4 pb-safe glass-dark">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full h-14 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all ${
            isGenerating 
              ? "bg-white/20 text-white/60" 
              : "bg-accent text-black active:scale-[0.98]"
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Shoot It</span>
            </>
          )}
        </button>
      </div>
      
      {/* Loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-white text-lg font-medium">AI 正在创作中...</p>
          <p className="text-white/60 text-sm mt-2">预计需要 30-60 秒</p>
        </div>
      )}
    </div>
  )
}
