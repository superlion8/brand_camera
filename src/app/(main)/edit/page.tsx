"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Wand2, X, Check, Loader2, Image as ImageIcon, Home, ArrowLeft, Lightbulb, Sun, Sparkles, Zap, Camera, FolderHeart, Upload, Images } from "lucide-react"
import { AssetSelector } from "@/components/camera/AssetSelector"
import { Asset, ModelStyle, ModelGender } from "@/types"
import { fileToBase64, compressBase64Image, fetchWithTimeout, generateId, ensureBase64 } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { PRESET_PRODUCTS } from "@/data/presets"
import Webcam from "react-webcam"
import { motion, AnimatePresence } from "framer-motion"

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

// Hex to HSV
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, v]
}

type EditMode = 'edit' | 'studio'

const styleOptions: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能" },
  { value: "korean", label: "韩模" },
  { value: "western", label: "外模" },
]

const genderOptions: { value: ModelGender; label: string }[] = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "girl", label: "女童" },
  { value: "boy", label: "男童" },
]

// Studio light types - compact
const LIGHT_TYPES = [
  { id: 'Softbox', label: '柔光', icon: Lightbulb },
  { id: 'Sunlight', label: '自然', icon: Sun },
  { id: 'Dramatic', label: '戏剧', icon: Sparkles },
  { id: 'Neon', label: '霓虹', icon: Zap },
]

const ASPECT_RATIOS = [
  { id: 'original', label: '原图' },
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
]

const LIGHT_DIRECTIONS = [
  { id: 'top-left', x: 0, y: 0 },
  { id: 'top', x: 1, y: 0 },
  { id: 'top-right', x: 2, y: 0 },
  { id: 'left', x: 0, y: 1 },
  { id: 'front', x: 1, y: 1 },
  { id: 'right', x: 2, y: 1 },
  { id: 'bottom-left', x: 0, y: 2 },
  { id: 'bottom', x: 1, y: 2 },
  { id: 'bottom-right', x: 2, y: 2 },
]

// Preset background colors - pairs for gradients
const PRESET_BG_COLORS = [
  { id: 'warm', colors: ['#FFE4B5', '#DEB887'], label: '暖金' },
  { id: 'cool', colors: ['#87CEEB', '#B0E0E6'], label: '冷蓝' },
  { id: 'neutral', colors: ['#D3D3D3', '#A9A9A9'], label: '中灰' },
  { id: 'rose', colors: ['#DDA0DD', '#DA70D6'], label: '玫瑰' },
]

export default function EditPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const webcamRef = useRef<Webcam>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [inputImage, setInputImage] = useState<string | null>(null)
  
  // Mode: edit or studio
  const [editMode, setEditMode] = useState<EditMode>('edit')
  
  // Ref to track generating state for async callbacks
  const [isGenerating, setIsGenerating] = useState(false)
  const isGeneratingRef = useRef(isGenerating)
  useEffect(() => { isGeneratingRef.current = isGenerating }, [isGenerating])
  
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  
  // Camera and upload states
  const [showCamera, setShowCamera] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showGalleryPanel, setShowGalleryPanel] = useState(false)
  const [productSourceTab, setProductSourceTab] = useState<'preset' | 'user'>('preset')
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  
  // Check for image passed from gallery page
  useEffect(() => {
    const editImage = sessionStorage.getItem('editImage')
    if (editImage) {
      setInputImage(editImage)
      sessionStorage.removeItem('editImage') // Clean up
    }
  }, [])
  
  // Edit mode state
  const [selectedModel, setSelectedModel] = useState<Asset | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<Asset | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<Asset | null>(null)
  const [modelStyle, setModelStyle] = useState<ModelStyle>("auto")
  const [modelGender, setModelGender] = useState<ModelGender | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [resultImages, setResultImages] = useState<string[]>([]) // For studio mode (2 images)
  const [activeTab, setActiveTab] = useState<"model" | "bg">("model")
  
  // Studio mode state
  const [lightType, setLightType] = useState('Softbox')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [lightDirection, setLightDirection] = useState('front')
  const [lightColor, setLightColor] = useState('#FFFFFF')
  
  // Color picker state (HSV)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [brightness, setBrightness] = useState(1)
  
  const { addGeneration, userProducts, generations } = useAssetStore()
  const { addTask, updateTaskStatus } = useGenerationTaskStore()
  
  // Update lightColor when HSV changes
  const updateColorFromHSV = useCallback((h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v)
    setLightColor(rgbToHex(r, g, b))
  }, [])
  
  // Handle saturation/brightness picker
  const handleSBPick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = colorPickerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    
    setSaturation(x)
    setBrightness(1 - y)
    updateColorFromHSV(hue, x, 1 - y)
  }, [hue, updateColorFromHSV])
  
  // Handle hue slider
  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseFloat(e.target.value)
    setHue(h)
    updateColorFromHSV(h, saturation, brightness)
  }, [saturation, brightness, updateColorFromHSV])
  
  // Set color from preset
  const setPresetColor = useCallback((hex: string) => {
    const [h, s, v] = hexToHsv(hex)
    setHue(h)
    setSaturation(s)
    setBrightness(v)
    setLightColor(hex)
  }, [])
  
  // Camera handlers
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setInputImage(imageSrc)
        setShowCamera(false)
        setResultImage(null)
      }
    }
  }, [])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
  }, [])
  
  const handleSelectFromAsset = useCallback(async (imageUrl: string) => {
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setInputImage(base64)
        setShowProductPanel(false)
        setResultImage(null)
      }
    } catch (e) {
      console.error('Failed to load asset:', e)
    }
  }, [])
  
  const handleSelectFromGallery = useCallback(async (imageUrl: string) => {
    try {
      const base64 = await ensureBase64(imageUrl)
      if (base64) {
        setInputImage(base64)
        setShowGalleryPanel(false)
        setResultImage(null)
      }
    } catch (e) {
      console.error('Failed to load gallery image:', e)
    }
  }, [])
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
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
    
    // Capture current state before async operations
    const currentInputImage = inputImage
    const currentEditMode = editMode
    const currentLightType = lightType
    const currentLightDirection = lightDirection
    const currentLightColor = lightColor
    const currentAspectRatio = aspectRatio
    const currentSelectedModel = selectedModel
    const currentSelectedBackground = selectedBackground
    const currentSelectedVibe = selectedVibe
    const currentModelStyle = modelStyle
    const currentModelGender = modelGender
    const currentCustomPrompt = customPrompt
    
    // Create task based on mode
    const taskType = currentEditMode === 'studio' ? 'studio' : 'edit'
    const params = currentEditMode === 'studio' 
      ? { lightType: currentLightType, lightDirection: currentLightDirection, lightColor: currentLightColor, aspectRatio: currentAspectRatio }
      : { modelStyle: currentModelStyle !== "auto" ? currentModelStyle : undefined, modelGender: currentModelGender || undefined, model: currentSelectedModel?.name, background: currentSelectedBackground?.name, vibe: currentSelectedVibe?.name }
    
    const taskId = addTask(taskType, currentInputImage, params)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    setIsGenerating(true)
    
    // Run generation in background
    if (currentEditMode === 'studio') {
      runStudioGeneration(taskId, currentInputImage, currentLightType, currentLightDirection, currentLightColor, currentAspectRatio)
    } else {
      runEditGeneration(taskId, currentInputImage, currentSelectedModel, currentSelectedBackground, currentSelectedVibe, currentModelStyle, currentModelGender, currentCustomPrompt)
    }
  }
  
  // Background studio generation
  const runStudioGeneration = async (
    taskId: string,
    inputImg: string,
    lightTypeVal: string,
    lightDirectionVal: string,
    lightColorVal: string,
    aspectRatioVal: string
  ) => {
    try {
      const compressedInput = await compressBase64Image(inputImg, 1024)
      
      const basePayload = {
        productImage: compressedInput,
        lightType: lightTypeVal,
        lightDirection: lightDirectionVal,
        lightColor: lightColorVal,
        aspectRatio: aspectRatioVal,
      }
      
      const staggerDelay = 1000
      
      const createDelayedRequest = (index: number, delayMs: number) => {
        return new Promise<Response>((resolve, reject) => {
          setTimeout(() => {
            console.log(`Starting Studio ${index + 1}...`)
            fetch("/api/generate-studio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...basePayload, index }),
            }).then(resolve).catch(reject)
          }, delayMs)
        })
      }
      
      const requests = [
        createDelayedRequest(0, 0),
        createDelayedRequest(1, staggerDelay),
      ]
      
      const responses = await Promise.allSettled(requests)
      
      const images: (string | null)[] = [null, null]
      
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          try {
            const result = await response.value.json()
            if (result.success && result.image) {
              images[result.index] = result.image
              console.log(`Studio ${result.index + 1}: ✓`)
            }
          } catch (e) {
            console.log('Parse error')
          }
        }
      }
      
      const finalImages = images.filter((img): img is string => img !== null)
      
      if (finalImages.length > 0) {
        updateTaskStatus(taskId, 'completed', finalImages)
        
        await addGeneration({
          id: taskId,
          type: "studio",
          inputImageUrl: inputImg,
          outputImageUrls: finalImages,
          createdAt: new Date().toISOString(),
          params: { lightType: lightTypeVal, lightDirection: lightDirectionVal, lightColor: lightColorVal, aspectRatio: aspectRatioVal },
        })
        
        if (isGeneratingRef.current) {
          setResultImages(finalImages)
          setResultImage(finalImages[0])
          setIsGenerating(false)
        }
      } else {
        updateTaskStatus(taskId, 'failed', undefined, '生成失败')
        if (isGeneratingRef.current) {
          alert('生成失败，请重试')
          setIsGenerating(false)
        }
      }
    } catch (error: any) {
      console.error("Studio error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || '生成失败')
      if (isGeneratingRef.current) {
        alert(error.message || "生成失败，请重试")
        setIsGenerating(false)
      }
    }
  }
  
  // Background edit generation
  const runEditGeneration = async (
    taskId: string,
    inputImg: string,
    model: Asset | null,
    background: Asset | null,
    vibe: Asset | null,
    style: ModelStyle,
    gender: ModelGender | null,
    prompt: string
  ) => {
    try {
      const compressedInput = await compressBase64Image(inputImg, 1024)
      
      const [modelBase64, bgBase64, vibeBase64] = await Promise.all([
        ensureBase64(model?.imageUrl),
        ensureBase64(background?.imageUrl),
        ensureBase64(vibe?.imageUrl),
      ])
      
      console.log("Sending edit request...")
      const response = await fetchWithTimeout("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputImage: compressedInput,
          modelImage: modelBase64,
          modelStyle: style,
          modelGender: gender,
          backgroundImage: bgBase64,
          vibeImage: vibeBase64,
          customPrompt: prompt,
        }),
      }, 120000)
      
      const data = await response.json()
      
      if (data.success && data.image) {
        updateTaskStatus(taskId, 'completed', [data.image])
        
        await addGeneration({
          id: taskId,
          type: "edit",
          inputImageUrl: inputImg,
          outputImageUrls: [data.image],
          createdAt: new Date().toISOString(),
          params: {
            modelStyle: style !== "auto" ? style : undefined,
            modelGender: gender || undefined,
            model: model?.name,
            background: background?.name,
            vibe: vibe?.name,
          },
        })
        
        if (isGeneratingRef.current) {
          setResultImage(data.image)
          setResultImages([data.image])
          setIsGenerating(false)
        }
      } else {
        throw new Error(data.error || "编辑失败")
      }
    } catch (error: any) {
      console.error("Edit error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || '编辑失败')
      if (isGeneratingRef.current) {
        if (error.name === 'AbortError') {
          alert("编辑超时，请重试。建议使用较小的图片。")
        } else {
          alert(error.message || "编辑失败，请重试")
        }
        setIsGenerating(false)
      }
    }
  }
  
  // Navigation handlers during processing
  const handleNewEditDuringProcessing = () => {
    setIsGenerating(false)
    setInputImage(null)
    setResultImage(null)
    setResultImages([])
  }
  
  const handleReturnHomeDuringProcessing = () => {
    setIsGenerating(false)
    router.push('/')
  }
  
  const handleReset = () => {
    setInputImage(null)
    setResultImage(null)
    setResultImages([])
    setSelectedModel(null)
    setSelectedBackground(null)
    setSelectedVibe(null)
    setModelStyle("auto")
    setModelGender(null)
    setCustomPrompt("")
    // Studio state
    setLightType('Softbox')
    setAspectRatio('original')
    setLightDirection('front')
    setLightColor('#FFFFFF')
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
        </div>
        {/* Mode Switcher */}
        <div className="ml-auto flex bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => setEditMode('edit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              editMode === 'edit'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 inline mr-1" />
            修图
          </button>
          <button
            onClick={() => setEditMode('studio')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              editMode === 'studio'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
            商品影棚
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Image Area */}
        <div className="bg-zinc-100 min-h-[240px] flex items-center justify-center relative p-4">
          {!inputImage ? (
            <div className="w-full max-w-sm space-y-2">
              {/* Camera */}
              <button
                onClick={() => setShowCamera(true)}
                className={`w-full h-16 rounded-xl flex items-center justify-center gap-3 transition-colors ${
                  editMode === 'studio' 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Camera className="w-5 h-5" />
                <span className="font-medium">拍摄</span>
              </button>
              
              <div className="grid grid-cols-3 gap-2">
                {/* Album */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">相册</span>
                </button>
                
                {/* Asset library */}
                <button
                  onClick={() => setShowProductPanel(true)}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FolderHeart className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">资产库</span>
                </button>
                
                {/* Gallery */}
                <button
                  onClick={() => setShowGalleryPanel(true)}
                  className="h-14 rounded-xl border-2 border-zinc-200 bg-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Images className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-700">图库</span>
                </button>
              </div>
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
          {editMode === 'edit' ? (
            <>
              {/* Edit Mode Controls */}
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
                    { id: "bg", label: "环境" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as "model" | "bg")}
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
                        showViewMore
                      />
                    </div>
                  )}
                  {activeTab === "bg" && (
                    <AssetSelector
                      type="background"
                      selected={selectedBackground}
                      onSelect={setSelectedBackground}
                      compact
                      showViewMore
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Studio Mode Controls */}
              {/* Light Type - Single row */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">光源类型</h3>
                <div className="flex gap-2">
                  {LIGHT_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setLightType(type.id)}
                        className={`flex-1 py-2.5 px-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          lightType === type.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${lightType === type.id ? 'text-amber-600' : 'text-zinc-400'}`} />
                        <span className={`text-xs font-medium ${lightType === type.id ? 'text-amber-700' : 'text-zinc-600'}`}>
                          {type.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Aspect Ratio */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">画面比例</h3>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        aspectRatio === ratio.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Light Direction */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">光源方向</h3>
                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                  <div className="grid grid-cols-3 gap-1.5 max-w-[140px] mx-auto">
                    {LIGHT_DIRECTIONS.map(dir => (
                      <button
                        key={dir.id}
                        onClick={() => setLightDirection(dir.id)}
                        className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                          dir.id === 'front'
                            ? 'bg-zinc-800 text-white'
                            : lightDirection === dir.id
                              ? 'bg-amber-400 shadow-md'
                              : 'bg-zinc-200 hover:bg-zinc-300'
                        }`}
                      >
                        {dir.id === 'front' ? (
                          <span className="text-xs">📦</span>
                        ) : lightDirection === dir.id ? (
                          <Sun className="w-4 h-4 text-amber-800" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Background Color - Advanced picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-700">背景颜色</h3>
                  <div className="flex items-center gap-2">
                    {/* Preset color pairs */}
                    {PRESET_BG_COLORS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setPresetColor(preset.colors[0])}
                        className="w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden"
                        style={{ 
                          background: `linear-gradient(135deg, ${preset.colors[0]} 50%, ${preset.colors[1]} 50%)`
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="bg-zinc-900 rounded-2xl p-3 space-y-3">
                  {/* Saturation/Brightness picker */}
                  <div
                    ref={colorPickerRef}
                    onClick={handleSBPick}
                    onMouseMove={(e) => e.buttons === 1 && handleSBPick(e)}
                    onTouchMove={handleSBPick}
                    className="relative h-32 rounded-xl cursor-crosshair overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${hue * 360}, 100%, 50%))
                      `
                    }}
                  >
                    {/* Picker indicator */}
                    <div
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        left: `calc(${saturation * 100}% - 8px)`,
                        top: `calc(${(1 - brightness) * 100}% - 8px)`,
                        backgroundColor: lightColor,
                      }}
                    />
                  </div>
                  
                  {/* Hue slider */}
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={hue}
                      onChange={handleHueChange}
                      className="w-full h-3 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      }}
                    />
                    {/* Custom thumb indicator */}
                    <div
                      className="absolute top-0 w-4 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                      style={{
                        left: `calc(${hue * 100}% - 8px)`,
                        backgroundColor: `hsl(${hue * 360}, 100%, 50%)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Generate Button - inside scrollable area */}
          <div className="pt-4 pb-24">
            <button
              onClick={handleGenerate}
              disabled={!inputImage || isGenerating}
              className={`w-full h-12 rounded-full text-base font-semibold gap-2 flex items-center justify-center transition-all ${
                !inputImage || isGenerating
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  : editMode === 'studio'
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
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
                  {editMode === 'studio' ? <Lightbulb className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                  <span>{editMode === 'studio' ? '生成影棚照片' : '开始生成'}</span>
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
            <div className={`absolute inset-0 blur-xl rounded-full animate-pulse ${editMode === 'studio' ? 'bg-amber-500/20' : 'bg-purple-500/20'}`} />
            <Loader2 className={`w-16 h-16 animate-spin relative z-10 ${editMode === 'studio' ? 'text-amber-500' : 'text-purple-500'}`} />
          </div>
          <h3 className="text-white text-xl font-bold mb-2">AI 正在处理...</h3>
          <p className="text-zinc-400 text-sm mb-8">应用您的指令和风格选择</p>
          
          {/* Navigation buttons during processing */}
          <div className="space-y-3 w-full max-w-xs">
            <p className="text-zinc-500 text-xs mb-4">生成将在后台继续，您可以：</p>
            <button
              onClick={handleNewEditDuringProcessing}
              className={`w-full h-12 rounded-full text-white font-medium flex items-center justify-center gap-2 transition-colors ${
                editMode === 'studio' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-purple-500 hover:bg-purple-600'
              }`}
            >
              <Wand2 className="w-5 h-5" />
              修新的图
            </button>
            <button
              onClick={handleReturnHomeDuringProcessing}
              className="w-full h-12 rounded-full bg-white/10 text-white/90 border border-white/20 font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <Home className="w-5 h-5" />
              返回主页
            </button>
          </div>
        </div>
      )}
      
      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Back button */}
            <button
              onClick={() => setShowCamera(false)}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 text-white backdrop-blur-md flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Camera view */}
            <div className="flex-1 relative">
              {hasCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">相机不可用</p>
                    <button
                      onClick={() => {
                        setShowCamera(false)
                        setTimeout(() => fileInputRef.current?.click(), 100)
                      }}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
                    >
                      从相册上传
                    </button>
                  </div>
                </div>
              )}
              
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
              
              {/* Focus frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                  <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 ${editMode === 'studio' ? 'border-amber-400' : 'border-blue-400'}`} />
                  <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 ${editMode === 'studio' ? 'border-amber-400' : 'border-blue-400'}`} />
                  <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 ${editMode === 'studio' ? 'border-amber-400' : 'border-blue-400'}`} />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 ${editMode === 'studio' ? 'border-amber-400' : 'border-blue-400'}`} />
                </div>
              </div>
            </div>
            
            {/* Capture button */}
            <div className="bg-black py-8 flex justify-center">
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 ${
                  editMode === 'studio' ? 'border-amber-400/50' : 'border-blue-400/50'
                }`}
              >
                <div className={`w-16 h-16 rounded-full ${editMode === 'studio' ? 'bg-amber-400' : 'bg-blue-400'}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Product Selection Panel */}
      <AnimatePresence>
        {showProductPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowProductPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">选择图片</span>
                <button
                  onClick={() => setShowProductPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Source Tabs */}
              <div className="px-4 py-2 border-b bg-white">
                <div className="flex bg-zinc-100 rounded-lg p-1">
                  <button
                    onClick={() => setProductSourceTab("preset")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "preset"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    官方示例 ({PRESET_PRODUCTS.length})
                  </button>
                  <button
                    onClick={() => setProductSourceTab("user")}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                      productSourceTab === "user"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    我的商品 ({userProducts.length})
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
                {productSourceTab === 'preset' ? (
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_PRODUCTS.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all bg-white"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <span className="absolute top-1 left-1 bg-blue-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                          官方
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {userProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectFromAsset(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all bg-white"
                      >
                        <Image src={product.imageUrl} alt={product.name || ''} fill className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <FolderHeart className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">暂无我的商品</p>
                    <p className="text-xs mt-1">在品牌资产中上传商品图片</p>
                    <button
                      onClick={() => {
                        setShowProductPanel(false)
                        router.push("/brand-assets")
                      }}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      去上传
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Gallery Selection Panel */}
      <AnimatePresence>
        {showGalleryPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowGalleryPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                <span className="font-semibold">从图库选择</span>
                <button
                  onClick={() => setShowGalleryPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
                {generations.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {generations
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .flatMap(gen => gen.outputImageUrls.map((url, idx) => ({ url, gen, idx })))
                      .map((item, index) => (
                        <button
                          key={`${item.gen.id}-${item.idx}`}
                          onClick={() => handleSelectFromGallery(item.url)}
                          className="aspect-square rounded-xl overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all bg-white"
                        >
                          <Image src={item.url} alt={`生成图 ${index + 1}`} fill className="object-cover" />
                          <span className={`absolute top-1 left-1 text-white text-[8px] px-1 py-0.5 rounded font-medium ${
                            item.gen.type === 'studio' ? 'bg-amber-500' :
                            item.idx < 2 ? 'bg-blue-500' : 'bg-purple-500'
                          }`}>
                            {item.gen.type === 'studio' ? '影棚' :
                             item.idx < 2 ? '产品' : '模特'}
                          </span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <Images className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">暂无生成记录</p>
                    <p className="text-xs mt-1">先去拍摄生成一些图片吧</p>
                    <button
                      onClick={() => {
                        setShowGalleryPanel(false)
                        router.push("/camera")
                      }}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      去拍摄
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
