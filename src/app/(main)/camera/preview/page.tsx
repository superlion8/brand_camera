"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Wand2, Check, Loader2, User, Layout, Sparkles } from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { ModelStyle } from "@/types"

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能 (Auto)" },
  { value: "japanese", label: "日系 (Asian)" },
  { value: "korean", label: "韩系 (Korean)" },
  { value: "chinese", label: "中式 (Chinese)" },
  { value: "western", label: "欧美 (Western)" },
]

export default function PreviewPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"model" | "bg" | "vibe">("model")
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b bg-white dark:bg-zinc-900 shrink-0 z-20">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
        </button>
        <span className="font-semibold text-zinc-900 dark:text-white">Studio 配置</span>
        <button 
          onClick={handleRetake}
          className="text-blue-600 text-sm font-medium"
        >
          重拍
        </button>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview Image */}
        <div className="h-48 bg-zinc-100 dark:bg-zinc-900 relative shrink-0 flex justify-center items-center p-4">
          <div className="relative h-full aspect-[3/4] shadow-lg rounded-md overflow-hidden">
            <Image
              src={capturedImage}
              alt="Captured"
              fill
              className="object-cover"
            />
            {/* Overlays for selection feedback */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-1 p-1">
              {selectedModel && (
                <span className="badge badge-preset text-[10px] h-4 px-1 bg-white/80 backdrop-blur rounded">
                  模特: {selectedModel.name}
                </span>
              )}
              {modelStyle !== "auto" && !selectedModel && (
                <span className="badge badge-preset text-[10px] h-4 px-1 bg-white/80 backdrop-blur rounded text-zinc-700">
                  风格: {styleOptions.find(s => s.value === modelStyle)?.label}
                </span>
              )}
              {selectedBackground && (
                <span className="badge badge-preset text-[10px] h-4 px-1 bg-white/80 backdrop-blur rounded text-zinc-700">
                  背景: {selectedBackground.name}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex-1 bg-white dark:bg-zinc-950 rounded-t-xl -mt-4 shadow-up z-10 flex flex-col overflow-hidden relative">
          {/* Tab List */}
          <div className="px-4 pt-2 border-b">
            <div className="w-full grid grid-cols-3 h-12">
              <button
                onClick={() => setActiveTab("model")}
                className={`flex flex-col items-center justify-center gap-1 border-b-2 transition-colors pb-3 ${
                  activeTab === "model"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white border-black dark:border-white"
                    : "border-transparent text-zinc-500"
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-[10px]">模特</span>
              </button>
              <button
                onClick={() => setActiveTab("bg")}
                className={`flex flex-col items-center justify-center gap-1 border-b-2 transition-colors pb-3 ${
                  activeTab === "bg"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white border-black dark:border-white"
                    : "border-transparent text-zinc-500"
                }`}
              >
                <Layout className="w-4 h-4" />
                <span className="text-[10px]">背景</span>
              </button>
              <button
                onClick={() => setActiveTab("vibe")}
                className={`flex flex-col items-center justify-center gap-1 border-b-2 transition-colors pb-3 ${
                  activeTab === "vibe"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white border-black dark:border-white"
                    : "border-transparent text-zinc-500"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px]">氛围</span>
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
            {activeTab === "model" && (
              <div className="space-y-6">
                {/* Style Presets */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">人种风格 (如果不选具体模特)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {styleOptions.map(style => (
                      <button
                        key={style.value}
                        onClick={() => {
                          setModelStyle(style.value)
                          if (style.value !== "auto") setSelectedModel(null)
                        }}
                        className={`h-10 px-3 rounded-md text-sm font-medium border transition-colors text-left flex items-center justify-between ${
                          modelStyle === style.value
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {style.label}
                        {modelStyle === style.value && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Model Assets */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase">我的模特资产</h3>
                  <AssetSelector
                    type="model"
                    selected={selectedModel}
                    onSelect={(asset) => {
                      setSelectedModel(asset)
                      if (asset) setModelStyle("auto")
                    }}
                    modelStyle={modelStyle}
                    compact
                  />
                </div>
              </div>
            )}
            
            {activeTab === "bg" && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 mb-2">选择背景图以保持一致性</p>
                <AssetSelector
                  type="background"
                  selected={selectedBackground}
                  onSelect={setSelectedBackground}
                  compact
                />
              </div>
            )}
            
            {activeTab === "vibe" && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 mb-2">选择整体氛围风格</p>
                <AssetSelector
                  type="vibe"
                  selected={selectedVibe}
                  onSelect={setSelectedVibe}
                  compact
                />
              </div>
            )}
          </div>
          
          {/* Footer Action */}
          <div className="p-4 border-t bg-white dark:bg-zinc-900 shadow-up z-20">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full h-12 rounded-lg text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                isGenerating
                  ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>Shoot It (生成)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
          </div>
          
          <h3 className="text-white text-2xl font-bold mb-2">AI 正在拍摄...</h3>
          <div className="text-zinc-400 space-y-1 text-sm">
            <p>分析商品光影...</p>
            {selectedModel && <p>生成模特 {selectedModel.name} ...</p>}
            {modelStyle !== "auto" && !selectedModel && (
              <p>匹配{styleOptions.find(s => s.value === modelStyle)?.label}风格...</p>
            )}
            {selectedBackground && <p>渲染场景背景...</p>}
          </div>
        </div>
      )}
    </div>
  )
}
