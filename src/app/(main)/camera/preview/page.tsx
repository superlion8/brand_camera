"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/shared/Header"
import { useCameraStore } from "@/stores/cameraStore"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { StyleSelector } from "@/components/camera/StyleSelector"
import { ModelStyle } from "@/types"

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
    <div className="min-h-screen bg-primary flex flex-col">
      <Header 
        title="商品预览" 
        showBack 
        rightElement={
          <button onClick={handleRetake} className="text-accent text-sm font-medium">
            重拍
          </button>
        }
      />
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Product preview */}
        <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-surface">
          <Image
            src={capturedImage}
            alt="Product preview"
            fill
            className="object-cover"
          />
        </div>
        
        {/* Style selector */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400">模特风格</h3>
          <StyleSelector
            value={modelStyle}
            onChange={setModelStyle}
          />
        </div>
        
        {/* Model selector */}
        <AssetSelector
          title="选择模特"
          type="model"
          selected={selectedModel}
          onSelect={setSelectedModel}
          modelStyle={modelStyle}
        />
        
        {/* Background selector */}
        <AssetSelector
          title="选择背景"
          type="background"
          selected={selectedBackground}
          onSelect={setSelectedBackground}
        />
        
        {/* Vibe selector */}
        <AssetSelector
          title="选择 Vibe"
          type="vibe"
          selected={selectedVibe}
          onSelect={setSelectedVibe}
        />
      </div>
      
      {/* Generate button */}
      <div className="sticky bottom-0 p-4 pb-safe bg-gradient-to-t from-primary via-primary to-transparent">
        <Button
          onClick={handleGenerate}
          isLoading={isGenerating}
          className="w-full h-14 text-base"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Shoot It
        </Button>
      </div>
    </div>
  )
}

