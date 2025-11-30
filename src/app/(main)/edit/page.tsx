"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Sparkles, X, ChevronLeft, Check } from "lucide-react"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { Asset, ModelStyle } from "@/types"
import { fileToBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能" },
  { value: "japanese", label: "日系" },
  { value: "korean", label: "韩系" },
  { value: "chinese", label: "中式" },
  { value: "western", label: "欧美" },
]

export default function EditPage() {
  const router = useRouter()
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
    <div className="min-h-screen bg-black">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 glass-dark border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4">
          <h1 className="text-white text-lg font-bold">图像编辑</h1>
          {inputImage && (
            <button 
              onClick={handleReset}
              className="text-accent text-sm font-medium"
            >
              重置
            </button>
          )}
        </div>
      </div>
      
      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Input image area */}
        <div className="space-y-3">
          <h3 className="text-white/60 text-xs font-semibold uppercase">原始图片</h3>
          
          {inputImage ? (
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5">
              <Image
                src={inputImage}
                alt="Input image"
                fill
                className="object-cover"
              />
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-3 text-white/40 active:border-accent active:text-accent transition-colors"
            >
              <Upload className="w-10 h-10" />
              <span className="text-sm font-medium">点击上传图片</span>
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
            
            {/* Custom prompt */}
            <div className="space-y-3">
              <h3 className="text-white/60 text-xs font-semibold uppercase">自定义提示词 (可选)</h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="描述你想要的效果..."
                className="w-full h-24 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 resize-none focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            
            {/* Result image */}
            {resultImage && (
              <div className="space-y-3">
                <h3 className="text-white/60 text-xs font-semibold uppercase">生成结果</h3>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5">
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
      </div>
      
      {/* Generate button */}
      {inputImage && (
        <div className="fixed bottom-20 left-0 right-0 p-4 glass-dark">
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
                <span>{resultImage ? "重新生成" : "开始编辑"}</span>
              </>
            )}
          </button>
        </div>
      )}
      
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
