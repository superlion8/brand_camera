"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, Wand2, X, Check, Loader2, User, Layout, Sparkles, Image as ImageIcon } from "lucide-react"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { Asset, ModelStyle, ModelGender } from "@/types"
import { fileToBase64, compressBase64Image, fetchWithTimeout } from "@/lib/utils"
import { useRouter } from "next/navigation"

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能 (Auto)" },
  { value: "japanese", label: "日系 (Asian)" },
  { value: "korean", label: "韩系 (Korean)" },
  { value: "chinese", label: "中式 (Chinese)" },
  { value: "western", label: "欧美 (Western)" },
]

const genderOptions: { value: ModelGender; label: string }[] = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
]

export default function EditPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputImage, setInputImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<Asset | null>(null)
  const [modelStyle, setModelStyle] = useState<ModelStyle>("auto")
  const [modelGender, setModelGender] = useState<ModelGender | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"model" | "bg" | "vibe">("model")
  
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
      // Compress image before sending
      console.log("Compressing image...")
      const compressedInput = await compressBase64Image(inputImage, 1024)
      
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImage: compressedInput,
          modelImage: selectedModel?.imageUrl,
          modelStyle,
          modelGender,
          backgroundImage: selectedBackground?.imageUrl,
          vibeImage: selectedVibe?.imageUrl,
          customPrompt,
        }),
      }, 120000) // 120 second timeout
      
      const data = await response.json()
      
      if (data.success && data.image) {
        setResultImage(data.image)
      } else {
        throw new Error(data.error || "编辑失败")
      }
    } catch (error: any) {
      console.error("Edit error:", error)
      if (error.name === 'AbortError') {
        alert("编辑超时，请重试。建议使用较小的图片。")
      } else {
        alert(error.message || "编辑失败，请重试")
      }
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
    setModelGender(null)
    setCustomPrompt("")
  }
  
  return (
    <div className="h-full flex flex-col bg-zinc-50 bg-white">
      {/* Header */}
      <div className="h-14 border-b bg-white bg-white flex items-center justify-center shrink-0 font-semibold text-zinc-900 text-zinc-900">
        图像编辑
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Image Area */}
        <div className="bg-zinc-100 bg-white min-h-[300px] flex items-center justify-center relative p-4">
          {!inputImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-64 h-64 border-2 border-dashed border-zinc-300 border-zinc-200 rounded-xl flex flex-col items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-200/50 hover:bg-zinc-100/50 transition-colors"
            >
              <ImageIcon className="w-10 h-10 mb-2" />
              <span>点击上传图片</span>
            </div>
          ) : (
            <div className="relative w-full max-w-sm">
              <Image 
                src={resultImage || inputImage} 
                alt="Preview"
                width={400}
                height={500}
                className="w-full rounded-lg shadow-lg"
              />
              {resultImage && (
                <span className="absolute top-2 right-2 badge badge-generated">已生成</span>
              )}
              {!resultImage && (
                <span className="absolute top-2 right-2 badge badge-original">原图</span>
              )}
              
              <button
                onClick={handleReset}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-lg shadow transition-colors"
              >
                重选
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
        
        {/* Controls */}
        <div className="p-4 space-y-6 bg-white bg-white rounded-t-xl -mt-4 shadow-up relative z-10 min-h-[400px]">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 text-zinc-500">编辑指令 (Prompt)</label>
            <textarea
              placeholder="例如：把背景换成海边，让光线更柔和..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 bg-zinc-50 bg-white border border-zinc-200 border-zinc-200 rounded-lg text-zinc-900 text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          
          {/* Assets Selection Tabs */}
          <div className="w-full">
            <div className="w-full grid grid-cols-3 border-b">
              <button
                onClick={() => setActiveTab("model")}
                className={`py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "model"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500"
                }`}
              >
                模特
              </button>
              <button
                onClick={() => setActiveTab("bg")}
                className={`py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "bg"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500"
                }`}
              >
                背景
              </button>
              <button
                onClick={() => setActiveTab("vibe")}
                className={`py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "vibe"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500"
                }`}
              >
                氛围
              </button>
            </div>
            
            <div className="mt-4 bg-zinc-50 bg-white p-4 rounded-lg border border-zinc-200 border-zinc-200">
              {activeTab === "model" && (
                <div className="space-y-4">
                  {/* Gender Selection */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 mb-2 uppercase">模特性别</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {genderOptions.map(gender => (
                        <button
                          key={gender.value}
                          onClick={() => setModelGender(modelGender === gender.value ? null : gender.value)}
                          className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors text-left flex items-center justify-between ${
                            modelGender === gender.value
                              ? "bg-purple-50 bg-purple-50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                              : "bg-white bg-zinc-100 border-zinc-200 border-zinc-200 text-zinc-700 text-zinc-500 hover:bg-zinc-50 hover:bg-zinc-100"
                          }`}
                        >
                          <span className="text-xs">{gender.label}</span>
                          {modelGender === gender.value && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Style Selection */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 mb-2 uppercase">模特风格</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {styleOptions.map(style => (
                        <button
                          key={style.value}
                          onClick={() => setModelStyle(style.value)}
                          className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors text-left flex items-center justify-between ${
                            modelStyle === style.value
                              ? "bg-purple-50 bg-purple-50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                              : "bg-white bg-zinc-100 border-zinc-200 border-zinc-200 text-zinc-700 text-zinc-500 hover:bg-zinc-50 hover:bg-zinc-100"
                          }`}
                        >
                          <span className="text-xs">{style.label}</span>
                          {modelStyle === style.value && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <AssetSelector
                    type="model"
                    selected={selectedModel}
                    onSelect={setSelectedModel}
                    modelStyle={modelStyle}
                    compact
                  />
                </div>
              )}
              {activeTab === "bg" && (
                <AssetSelector
                  type="background"
                  selected={selectedBackground}
                  onSelect={setSelectedBackground}
                  compact
                />
              )}
              {activeTab === "vibe" && (
                <AssetSelector
                  type="vibe"
                  selected={selectedVibe}
                  onSelect={setSelectedVibe}
                  compact
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t bg-white bg-white shrink-0">
        <button
          onClick={handleGenerate}
          disabled={!inputImage || isGenerating}
          className={`w-full h-12 rounded-lg text-lg font-semibold gap-2 flex items-center justify-center transition-all ${
            !inputImage || isGenerating
              ? "bg-zinc-300 bg-zinc-200 text-zinc-500 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
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
              <span>Generate (生成)</span>
            </>
          )}
        </button>
      </div>
      
      {/* Loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
          </div>
          <h3 className="text-white text-xl font-bold mb-2">AI 正在重绘...</h3>
          <p className="text-zinc-400 text-sm">应用您的 Prompt 与 风格选择</p>
        </div>
      )}
    </div>
  )
}
