"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Wand2, X, Check, Loader2, Image as ImageIcon, Home, ArrowLeft } from "lucide-react"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { Asset, ModelStyle, ModelGender } from "@/types"
import { fileToBase64, compressBase64Image, fetchWithTimeout, generateId, ensureBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能" },
  { value: "japanese", label: "日系" },
  { value: "korean", label: "韩系" },
  { value: "chinese", label: "中式" },
  { value: "western", label: "欧美" },
]

const genderOptions: { value: ModelGender; label: string }[] = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
]

export default function EditPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputImage, setInputImage] = useState<string | null>(null)
  
  // Check for image passed from gallery page
  useEffect(() => {
    const editImage = sessionStorage.getItem('editImage')
    if (editImage) {
      setInputImage(editImage)
      sessionStorage.removeItem('editImage') // Clean up
    }
  }, [])
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<Asset | null>(null)
  const [modelStyle, setModelStyle] = useState<ModelStyle>("auto")
  const [modelGender, setModelGender] = useState<ModelGender | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"model" | "bg" | "vibe">("model")
  
  const { addGeneration } = useAssetStore()
  
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
      // Compress and prepare images before sending
      console.log("Preparing images...")
      const compressedInput = await compressBase64Image(inputImage, 1024)
      
      // Convert URLs to base64 if needed (for preset assets)
      const [modelBase64, bgBase64, vibeBase64] = await Promise.all([
        ensureBase64(selectedModel?.imageUrl),
        ensureBase64(selectedBackground?.imageUrl),
        ensureBase64(selectedVibe?.imageUrl),
      ])
      
      console.log("Sending edit request...")
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImage: compressedInput,
          modelImage: modelBase64,
          modelStyle,
          modelGender,
          backgroundImage: bgBase64,
          vibeImage: vibeBase64,
          customPrompt,
        }),
      }, 120000)
      
      const data = await response.json()
      
      if (data.success && data.image) {
        setResultImage(data.image)
        
        // Save to generation history
        const id = generateId()
        await addGeneration({
          id,
          type: "edit",
          inputImageUrl: inputImage,
          outputImageUrls: [data.image],
          createdAt: new Date().toISOString(),
          params: {
            modelStyle: modelStyle !== "auto" ? modelStyle : undefined,
            modelGender: modelGender || undefined,
            model: selectedModel?.name,
            background: selectedBackground?.name,
            vibe: selectedVibe?.name,
          },
        })
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
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="h-14 border-b bg-white flex items-center px-4 shrink-0">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
        >
          <Home className="w-5 h-5 text-zinc-600" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
          <span className="font-semibold text-lg text-zinc-900">图像编辑</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Image Area */}
        <div className="bg-zinc-100 min-h-[280px] flex items-center justify-center relative p-4">
          {!inputImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-56 h-56 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-200/50 transition-colors"
            >
              <ImageIcon className="w-10 h-10 mb-2" />
              <span className="text-sm">点击上传图片</span>
            </div>
          ) : (
            <div className="relative w-full max-w-xs">
              <Image 
                src={resultImage || inputImage} 
                alt="Preview"
                width={400}
                height={500}
                className="w-full rounded-xl shadow-lg"
              />
              {resultImage && (
                <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">已生成</span>
              )}
              {!resultImage && (
                <span className="absolute top-2 left-2 px-2 py-1 bg-zinc-500 text-white text-xs rounded font-medium">原图</span>
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
        <div className="p-4 space-y-5 bg-white rounded-t-2xl -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] relative z-10 min-h-[350px]">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">编辑指令</label>
            <textarea
              placeholder="例如：把背景换成海边，让光线更柔和..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>
          
          {/* Assets Selection Tabs */}
          <div className="w-full">
            <div className="flex gap-2 mb-3">
              {[
                { id: "model", label: "模特" },
                { id: "bg", label: "背景" },
                { id: "vibe", label: "氛围" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "model" | "bg" | "vibe")}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    activeTab === tab.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
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
                          className={`h-10 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center justify-between ${
                            modelGender === gender.value
                              ? "bg-blue-50 border-blue-500 text-blue-700"
                              : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
                          }`}
                        >
                          {gender.label}
                          {modelGender === gender.value && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Style Selection */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 mb-2 uppercase">模特风格</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {styleOptions.map(style => (
                        <button
                          key={style.value}
                          onClick={() => setModelStyle(style.value)}
                          className={`h-10 px-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center ${
                            modelStyle === style.value
                              ? "bg-blue-50 border-blue-500 text-blue-700"
                              : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
                          }`}
                        >
                          {style.label}
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
          
          {/* Generate Button - inside scrollable area */}
          <div className="pt-4 pb-24">
            <button
              onClick={handleGenerate}
              disabled={!inputImage || isGenerating}
              className={`w-full h-12 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                !inputImage || isGenerating
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
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
                  <span>开始生成</span>
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
          <h3 className="text-white text-xl font-bold mb-2">AI 正在编辑...</h3>
          <p className="text-zinc-400 text-sm">应用您的指令和风格选择</p>
        </div>
      )}
    </div>
  )
}
