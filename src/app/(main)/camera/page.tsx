"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import Webcam from "react-webcam"
import { 
  ArrowLeft, ArrowRight, Check, Loader2, Image as ImageIcon, 
  SlidersHorizontal, X, Wand2, Camera, Home,
  Heart, Download, Pin, ZoomIn, FolderHeart, Plus, Upload
} from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useRouter } from "next/navigation"
import { fileToBase64, generateId, compressBase64Image, fetchWithTimeout, ensureBase64 } from "@/lib/utils"
import { Asset, ModelStyle, ModelGender } from "@/types"
import Image from "next/image"
import { PRESET_MODELS, PRESET_BACKGROUNDS, PRESET_PRODUCTS } from "@/data/presets"

const MODEL_GENDERS: { id: ModelGender; label: string }[] = [
  { id: "female", label: "女" },
  { id: "male", label: "男" },
  { id: "girl", label: "女童" },
  { id: "boy", label: "男童" },
]

type CameraMode = "camera" | "review" | "processing" | "results"

export default function CameraPage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null) // For second product image
  const modelUploadRef = useRef<HTMLInputElement>(null) // For model upload
  const bgUploadRef = useRef<HTMLInputElement>(null) // For background/environment upload
  
  // Mode and state
  const [mode, setMode] = useState<CameraMode>("camera")
  const modeRef = useRef<CameraMode>("camera") // Track mode for async callbacks
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedImage2, setCapturedImage2] = useState<string | null>(null) // Second product image
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedModelTypes, setGeneratedModelTypes] = useState<('pro' | 'flash')[]>([])
  const [generatedGenModes, setGeneratedGenModes] = useState<('extended' | 'simple')[]>([])
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([])
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null) // Track current task
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Keep modeRef in sync with mode
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  
  // Check camera permission on mount - use sessionStorage to avoid repeated prompts
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        // First check sessionStorage for cached permission state
        const cachedPermission = sessionStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
          setPermissionChecked(true)
          return
        }
        
        // Check if permission API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
            sessionStorage.setItem('cameraPermissionGranted', 'true')
          } else if (result.state === 'denied') {
            setHasCamera(false)
            sessionStorage.setItem('cameraPermissionGranted', 'false')
          }
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            if (result.state === 'granted') {
              setCameraReady(true)
              sessionStorage.setItem('cameraPermissionGranted', 'true')
            } else if (result.state === 'denied') {
              setHasCamera(false)
              sessionStorage.setItem('cameraPermissionGranted', 'false')
            }
          })
        }
      } catch (e) {
        // Permission API not supported, try to get stream directly
        console.log('Permission API not supported, trying direct stream access')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          // Permission granted, stop the stream (Webcam will create its own)
          stream.getTracks().forEach(track => track.stop())
          setCameraReady(true)
          sessionStorage.setItem('cameraPermissionGranted', 'true')
        } catch (streamError) {
          console.log('Camera access denied or unavailable')
          setHasCamera(false)
        }
      }
      setPermissionChecked(true)
    }
    
    checkCameraPermission()
  }, [])
  
  // Panel states
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showProduct2Panel, setShowProduct2Panel] = useState(false)
  const [activeCustomTab, setActiveCustomTab] = useState("model")
  const [productSourceTab, setProductSourceTab] = useState<"user" | "preset">("preset")
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  
  // Selections
  const [selectedBg, setSelectedBg] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedModelStyle, setSelectedModelStyle] = useState<ModelStyle | null>(null)
  const [selectedModelGender, setSelectedModelGender] = useState<ModelGender | null>(null)
  const [modelSubcategory, setModelSubcategory] = useState<'mine' | null>(null)
  const [bgSubcategory, setBgSubcategory] = useState<'mine' | null>(null)
  
  // Track if product images came from phone upload (not asset library)
  const [productFromPhone, setProductFromPhone] = useState(false)
  const [product2FromPhone, setProduct2FromPhone] = useState(false)
  
  const { addGeneration, addUserAsset, userModels, userBackgrounds, userProducts, addFavorite, removeFavorite, isFavorited, favorites } = useAssetStore()
  const { addTask, updateTaskStatus, tasks } = useGenerationTaskStore()
  const { debugMode } = useSettingsStore()
  
  // Helper to sort by pinned status
  const sortByPinned = (assets: Asset[]) => 
    [...assets].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
  
  // Filter assets by category - 'mine' shows only user assets
  const filteredModels = modelSubcategory === 'mine'
    ? sortByPinned(userModels)
    : [...sortByPinned(userModels), ...PRESET_MODELS]
  
  const filteredBackgrounds = bgSubcategory === 'mine'
    ? sortByPinned(userBackgrounds)
    : [...sortByPinned(userBackgrounds), ...PRESET_BACKGROUNDS]
  
  // Aliases for compatibility
  const allModels = filteredModels
  const allBackgrounds = filteredBackgrounds
  
  // Get selected assets from merged arrays
  const activeModel = allModels.find(m => m.id === selectedModel)
  const activeBg = allBackgrounds.find(b => b.id === selectedBg)
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "environment",
  }
  
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setProductFromPhone(true) // Mark as captured from camera (phone)
        setMode("review")
      }
    }
  }, [])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      setProductFromPhone(true) // Mark as uploaded from phone
      setMode("review")
    }
  }, [])
  
  // Upload second product image
  const handleUpload2 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage2(base64)
      setProduct2FromPhone(true) // Mark as uploaded from phone
    }
  }, [])
  
  // Upload model image directly in selector
  const handleModelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newAsset = {
        id: generateId(),
        type: 'model' as const,
        name: `模特 ${new Date().toLocaleDateString('zh-CN')}`,
        imageUrl: base64,
      }
      addUserAsset(newAsset)
      setSelectedModel(newAsset.id)
    }
    // Reset input so same file can be selected again
    if (e.target) e.target.value = ''
  }, [addUserAsset])
  
  // Upload background/environment image directly in selector
  const handleBgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      const newAsset = {
        id: generateId(),
        type: 'background' as const,
        name: `环境 ${new Date().toLocaleDateString('zh-CN')}`,
        imageUrl: base64,
      }
      addUserAsset(newAsset)
      setSelectedBg(newAsset.id)
    }
    // Reset input so same file can be selected again
    if (e.target) e.target.value = ''
  }, [addUserAsset])
  
  const handleCameraError = useCallback(() => {
    setHasCamera(false)
    setCameraReady(false)
  }, [])
  
  const handleCameraReady = useCallback(() => {
    setCameraReady(true)
    // Cache permission state for this session
    sessionStorage.setItem('cameraPermissionGranted', 'true')
  }, [])
  
  const handleRetake = () => {
    setCapturedImage(null)
    setCapturedImage2(null)
    setProductFromPhone(false)
    setProduct2FromPhone(false)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setMode("camera")
  }
  
  const handleShootIt = async () => {
    if (!capturedImage) return
    
    // Capture current selections BEFORE any async operations
    const currentModelStyle = selectedModelStyle
    const currentModelGender = selectedModelGender
    let currentModel = activeModel
    let currentBg = activeBg
    const currentProduct2 = capturedImage2
    const currentProductFromPhone = productFromPhone
    const currentProduct2FromPhone = product2FromPhone
    
    // If model not selected, randomly pick one from presets
    if (!currentModel && PRESET_MODELS.length > 0) {
      const randomModel = PRESET_MODELS[Math.floor(Math.random() * PRESET_MODELS.length)]
      currentModel = randomModel
      console.log('Randomly selected model:', randomModel.name)
    }
    
    // If background not selected, randomly pick one from presets
    if (!currentBg && PRESET_BACKGROUNDS.length > 0) {
      const randomBg = PRESET_BACKGROUNDS[Math.floor(Math.random() * PRESET_BACKGROUNDS.length)]
      currentBg = randomBg
      console.log('Randomly selected background:', randomBg.name)
    }
    
    // Create task and switch to processing mode
    const params = {
      modelStyle: currentModelStyle || undefined,
      modelGender: currentModelGender || undefined,
      model: currentModel?.name,
      background: currentBg?.name,
      hasProduct2: !!currentProduct2,
    }
    
    const taskId = addTask('camera', capturedImage, params)
    setCurrentTaskId(taskId)
    updateTaskStatus(taskId, 'generating')
    setMode("processing")
    
    // Start background generation with captured values
    runBackgroundGeneration(
      taskId, 
      capturedImage,
      currentProduct2,
      currentModelStyle,
      currentModelGender,
      currentModel,
      currentBg,
      currentProductFromPhone,
      currentProduct2FromPhone
    )
  }
  
  // Background generation function (runs async, doesn't block UI)
  // All parameters are passed explicitly to avoid closure issues
  const runBackgroundGeneration = async (
    taskId: string, 
    inputImage: string,
    inputImage2: string | null,
    modelStyle: ModelStyle | null,
    modelGender: ModelGender | null,
    model: Asset | undefined,
    background: Asset | undefined,
    fromPhone: boolean,
    fromPhone2: boolean
  ) => {
    try {
      // Compress and prepare images before sending
      console.log("Preparing images...")
      console.log("Model selected:", model?.name, "URL:", model?.imageUrl?.substring(0, 50))
      console.log("Background selected:", background?.name)
      console.log("Has second product:", !!inputImage2)
      
      const compressedProduct = await compressBase64Image(inputImage, 1024)
      const compressedProduct2 = inputImage2 ? await compressBase64Image(inputImage2, 1024) : null
      
      // Convert URLs to base64 if needed (for preset assets)
      const [modelBase64, bgBase64] = await Promise.all([
        ensureBase64(model?.imageUrl),
        ensureBase64(background?.imageUrl),
      ])
      
      console.log("Model base64 ready:", !!modelBase64, modelBase64 ? modelBase64.substring(0, 30) + "..." : "null")
      console.log("Background base64 ready:", !!bgBase64)
      
      // DEBUG MODE: 2 images (1 simple + 1 extended) for faster debugging
      // TODO: Change back to 6 images (3 simple + 3 extended) for production
      const NUM_IMAGES = 2 // Change to 6 for production
      const NUM_SIMPLE = 1 // Change to 3 for production
      
      console.log(`Sending ${NUM_IMAGES} staggered generation requests (1s apart)...`)
      
      const basePayload = {
        productImage: compressedProduct,
        productImage2: compressedProduct2,
        modelImage: modelBase64,
        modelStyle: modelStyle,
        modelGender: modelGender,
        backgroundImage: bgBase64,
      }
      
      const staggerDelay = 1000 // 1 second between each request
      
      // Check if both model and background are selected for simple mode
      const canUseSimpleMode = !!modelBase64 && !!bgBase64
      
      // Helper to create a delayed request for model images
      const createModelRequest = (index: number, delayMs: number, simpleMode: boolean) => {
        return new Promise<Response>((resolve, reject) => {
          setTimeout(() => {
            const mode = simpleMode ? '极简模式' : '扩展模式'
            console.log(`Starting Model ${index + 1} (${mode})...`)
            fetch("/api/generate-single", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include', // Ensure cookies are sent
              body: JSON.stringify({ ...basePayload, type: 'model', index, simpleMode }),
            }).then(resolve).catch(reject)
          }, delayMs)
        })
      }
      
      // Create model image requests:
      // First NUM_SIMPLE: 极简模式 (simple mode) - only if model and background are selected
      // Rest: 扩展模式 (extended mode)
      const requests = []
      for (let i = 0; i < NUM_IMAGES; i++) {
        const isSimple = i < NUM_SIMPLE && canUseSimpleMode
        requests.push(createModelRequest(i, staggerDelay * i, isSimple))
      }
      
      // Wait for all to complete (don't fail if some fail)
      const responses = await Promise.allSettled(requests)
      
      // Process results - all are model images
      const allImages: (string | null)[] = Array(NUM_IMAGES).fill(null)
      const allModelTypes: (('pro' | 'flash') | null)[] = Array(NUM_IMAGES).fill(null)
      const allPrompts: (string | null)[] = Array(NUM_IMAGES).fill(null)
      const allGenModes: (('extended' | 'simple') | null)[] = Array(NUM_IMAGES).fill(null)
      let maxDuration = 0
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]
        if (response.status === 'fulfilled') {
          const httpResponse = response.value
          try {
            // Check HTTP status first
            if (!httpResponse.ok) {
              const errorData = await httpResponse.json().catch(() => ({ error: `HTTP ${httpResponse.status}` }))
              console.log(`Task ${i + 1}: ✗ HTTP ${httpResponse.status} (${errorData.error || 'Unknown error'})`)
              continue
            }
            
            const result = await httpResponse.json()
            if (result.success && result.image) {
              // Direct mapping: index maps to position
              const targetIndex = result.index
              if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < NUM_IMAGES) {
                allImages[targetIndex] = result.image
                allModelTypes[targetIndex] = result.modelType
                allPrompts[targetIndex] = result.prompt || null
                allGenModes[targetIndex] = result.generationMode || 'extended'
                maxDuration = Math.max(maxDuration, result.duration || 0)
                const modeLabel = result.generationMode === 'simple' ? '极简模式' : '扩展模式'
                console.log(`Model ${targetIndex + 1}: ✓ (${result.modelType}, ${modeLabel}, ${result.duration}ms)`)
              } else {
                console.log(`Task ${i + 1}: ✗ (invalid index: ${targetIndex})`)
              }
            } else {
              console.log(`Task ${i + 1}: ✗ (${result.error || 'No image in response'})`)
            }
          } catch (e: any) {
            console.log(`Task ${i + 1}: ✗ (parse error: ${e.message})`)
          }
        } else {
          console.log(`Task ${i + 1}: ✗ (promise rejected: ${response.reason})`)
        }
      }
      
      // Filter out nulls and create final arrays
      const finalImages = allImages.filter((img): img is string => img !== null)
      const finalModelTypes = allModelTypes.filter((t): t is 'pro' | 'flash' => t !== null)
      const finalGenModes = allGenModes.filter((m): m is 'extended' | 'simple' => m !== null)
      
      // Per-image prompts
      const finalPrompts = allPrompts.filter((p): p is string => p !== null)
      
      // Create combined data object
      const data = {
        success: finalImages.length > 0,
        images: finalImages,
        modelTypes: finalModelTypes,
        genModes: finalGenModes, // Track generation modes
        prompts: finalPrompts, // Per-image prompts
        stats: {
          total: NUM_IMAGES,
          successful: finalImages.length,
          duration: maxDuration,
        }
      }
      
      console.log(`Generation complete: ${finalImages.length}/6 images in ~${maxDuration}ms`)
      console.log('Final images array:', finalImages.map((_, i) => allImages[i] ? `✓[${i}]` : `✗[${i}]`).join(' '))
      
      if (data.success && data.images.length > 0) {
        
        // Update task with results
        updateTaskStatus(taskId, 'completed', data.images)
        
        // Save phone-uploaded product images to asset library
        if (fromPhone && inputImage) {
          console.log('Saving phone-uploaded product to asset library...')
          addUserAsset({
            id: generateId(),
            type: 'product',
            name: `商品 ${new Date().toLocaleDateString('zh-CN')}`,
            imageUrl: inputImage,
          })
        }
        if (fromPhone2 && inputImage2) {
          console.log('Saving phone-uploaded product 2 to asset library...')
          addUserAsset({
            id: generateId(),
            type: 'product',
            name: `商品 ${new Date().toLocaleDateString('zh-CN')}`,
            imageUrl: inputImage2,
          })
        }
        
        // Save to IndexedDB/history
        const id = taskId
        await addGeneration({
          id,
          type: "camera_model",
          inputImageUrl: inputImage,
          inputImage2Url: inputImage2 || undefined,
          outputImageUrls: data.images,
          outputModelTypes: data.modelTypes, // Pro or Flash for each image
          outputGenModes: data.genModes, // Simple or Extended for each image
          prompts: data.prompts, // Per-image prompts
          createdAt: new Date().toISOString(),
          params: { 
            modelStyle: modelStyle || undefined,
            modelGender: modelGender || undefined,
            model: model?.name,
            background: background?.name,
            modelImage: model?.imageUrl,
            backgroundImage: background?.imageUrl,
          },
        })
        
        // If still on processing mode for this task, show results
        // Use modeRef.current to get the latest mode value (avoid stale closure)
        if (modeRef.current === "processing") {
          setGeneratedImages(data.images)
          setGeneratedModelTypes(data.modelTypes || [])
          setGeneratedGenModes(data.genModes || [])
          setGeneratedPrompts(data.prompts || [])
          setCurrentGenerationId(id)
          setMode("results")
        }
      } else {
        // All tasks failed - log more details
        const failedCount = responses.filter(r => r.status === 'rejected').length
        const httpErrorCount = responses.filter(r => r.status === 'fulfilled' && !r.value.ok).length
        console.error(`All tasks failed. Rejected: ${failedCount}, HTTP errors: ${httpErrorCount}`)
        throw new Error(`生成失败 (${failedCount}个请求失败, ${httpErrorCount}个HTTP错误)，请重试`)
      }
    } catch (error: any) {
      console.error("Generation error:", error)
      updateTaskStatus(taskId, 'failed', undefined, error.message || "生成失败")
      
      // Only alert if still on processing screen
      // Use modeRef.current to get the latest mode value
      if (modeRef.current === "processing") {
        if (error.name === 'AbortError') {
          alert("生成超时，请重试。建议使用较小的图片。")
        } else {
          alert(error.message || "生成失败，请重试")
        }
        setMode("review")
      }
    }
  }
  
  // Handle return during processing - allow going home
  const handleReturnDuringProcessing = () => {
    router.push("/")
  }
  
  // Handle taking new photo during processing
  const handleNewPhotoDuringProcessing = () => {
    setCapturedImage(null)
    setGeneratedImages([])
    setGeneratedModelTypes([])
    setGeneratedGenModes([])
    setGeneratedPrompts([])
    setMode("camera")
  }
  
  const handleReturn = () => {
    router.push("/")
  }
  
  // Handle favorite toggle for result images
  const handleResultFavorite = async (imageIndex: number) => {
    if (!currentGenerationId) return
    
    const currentlyFavorited = isFavorited(currentGenerationId, imageIndex)
    
    if (currentlyFavorited) {
      const fav = favorites.find(
        (f) => f.generationId === currentGenerationId && f.imageIndex === imageIndex
      )
      if (fav) {
        await removeFavorite(fav.id)
      }
    } else {
      await addFavorite({
        generationId: currentGenerationId,
        imageIndex,
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  // Handle go to edit with image
  const handleGoToEdit = (imageUrl: string) => {
    sessionStorage.setItem('editImage', imageUrl)
    router.push("/edit")
  }
  
  // Handle download
  const handleDownload = async (url: string) => {
    try {
      let blob: Blob
      
      if (url.startsWith('data:')) {
        // Handle base64 data URL
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        // Handle regular URL
        const response = await fetch(url)
        blob = await response.blob()
      }
      
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `brand-camera-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download failed:", error)
      // Fallback to direct link
      const link = document.createElement("a")
      link.href = url
      link.download = `brand-camera-${Date.now()}.jpg`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  // Asset grid component with upload card
  const AssetGrid = ({ 
    items, 
    selectedId, 
    onSelect,
    onUpload,
    uploadLabel = "上传"
  }: { 
    items: Asset[]
    selectedId: string | null
    onSelect: (id: string) => void
    onUpload?: () => void
    uploadLabel?: string
  }) => (
    <div className="grid grid-cols-3 gap-3 p-1 pb-20">
      {/* Upload card as first item */}
      {onUpload && (
        <button
          onClick={onUpload}
          className="aspect-square rounded-lg overflow-hidden relative border-2 border-dashed border-zinc-300 hover:border-blue-500 transition-all flex flex-col items-center justify-center bg-zinc-100 hover:bg-zinc-50"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs text-zinc-600 font-medium">{uploadLabel}</span>
        </button>
      )}
      {items.map(asset => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`aspect-square rounded-lg overflow-hidden relative border-2 transition-all group ${
            selectedId === asset.id 
              ? "border-blue-600 ring-2 ring-blue-200" 
              : "border-transparent hover:border-zinc-200"
          }`}
        >
          <Image src={asset.imageUrl} alt={asset.name || ""} fill className="object-cover" />
          {selectedId === asset.id && (
            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          )}
          {asset.isPinned && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm z-10">
              <Pin className="w-2.5 h-2.5" />
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
            <p className="text-[10px] text-white truncate text-center">{asset.name}</p>
          </div>
        </button>
      ))}
    </div>
  )
  
  return (
    <div className="h-full relative flex flex-col bg-black">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload}
      />
      <input 
        type="file" 
        ref={fileInputRef2} 
        className="hidden" 
        accept="image/*" 
        onChange={handleUpload2}
      />
      <input 
        type="file" 
        ref={modelUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleModelUpload}
      />
      <input 
        type="file" 
        ref={bgUploadRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleBgUpload}
      />

      <AnimatePresence mode="wait">
        {(mode === "camera" || mode === "review") && (
          <motion.div 
            key="camera-view"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 relative overflow-hidden flex flex-col"
          >
            {/* Top Return Button */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={mode === "review" ? handleRetake : handleReturn}
                className="w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                {mode === "review" ? <X className="w-6 h-6" /> : <Home className="w-5 h-5" />}
              </button>
            </div>

            {/* Viewfinder / Captured Image */}
            <div className="flex-1 relative">
              {mode === "camera" && hasCamera && permissionChecked ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={videoConstraints}
                  onUserMedia={handleCameraReady}
                  onUserMediaError={handleCameraError}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : mode === "camera" && !permissionChecked ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                    <p className="text-sm">正在初始化相机...</p>
                  </div>
                </div>
              ) : mode === "camera" && !hasCamera ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center text-zinc-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">相机不可用</p>
                    <p className="text-xs mt-1">请使用下方上传按钮</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex">
                  {/* Main product image */}
                  <div className={`relative ${capturedImage2 ? 'w-1/2' : 'w-full'} h-full`}>
                    <img 
                      src={capturedImage || ""} 
                      alt="商品 1" 
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-md">
                      商品 1
                    </span>
                  </div>
                  
                  {/* Second product image or add button */}
                  {capturedImage2 ? (
                    <div className="relative w-1/2 h-full border-l-2 border-white/30">
                      <img 
                        src={capturedImage2} 
                        alt="商品 2" 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-md">
                        商品 2
                      </span>
                      <button
                        onClick={() => setCapturedImage2(null)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : mode === "review" && (
                    <button
                      onClick={() => setShowProduct2Panel(true)}
                      className="absolute bottom-4 right-4 px-3 py-2 bg-white/90 text-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-md"
                    >
                      <Plus className="w-4 h-4" />
                      添加商品 2
                    </button>
                  )}
                </div>
              )}
              
              {/* Selection Badges Overlay */}
              <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
                {selectedModelGender && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    性别: {MODEL_GENDERS.find(g => g.id === selectedModelGender)?.label}
                  </span>
                )}
                {selectedModelStyle && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    风格: {MODEL_STYLES.find(s => s.id === selectedModelStyle)?.label}
                  </span>
                )}
                {activeModel && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    模特: {activeModel.name}
                  </span>
                )}
                {activeBg && (
                  <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md">
                    环境: {activeBg.name}
                  </span>
                )}
              </div>

              {mode === "camera" && (
                <>
                  {/* Grid Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Focus Frame */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border border-white/50 rounded-lg relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                    </div>
                  </div>
                  
                  <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
                    拍摄您的商品
                  </div>
                </>
              )}
            </div>

            {/* Bottom Controls Area */}
            <div className="bg-black flex flex-col justify-end pb-safe pt-6 px-6 relative z-20 shrink-0 min-h-[9rem]">
              {mode === "review" ? (
                <div className="space-y-4 pb-4">
                  {/* Custom button in review mode */}
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setShowCustomPanel(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors border border-white/20"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="text-sm font-medium">自定义模特和背景</span>
                    </button>
                  </div>
                  
                  {/* Shoot It button */}
                  <div className="w-full flex justify-center">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleShootIt}
                      className="w-full max-w-xs h-14 rounded-full text-lg font-semibold gap-2 bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      Shoot It
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-8 pb-4">
                  {/* Album - Left of shutter */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">相册</span>
                  </button>

                  {/* Shutter */}
                  <button 
                    onClick={handleCapture}
                    disabled={!hasCamera}
                    className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="w-[72px] h-[72px] bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
                  </button>

                  {/* Asset Library - Right of shutter */}
                  <button 
                    onClick={() => setShowProductPanel(true)}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <FolderHeart className="w-6 h-6" />
                    </div>
                    <span className="text-[10px]">资产库</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Slide-up Panel: Custom */}
            <AnimatePresence>
              {showCustomPanel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowCustomPanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold text-lg">自定义配置</span>
                      <button 
                        onClick={() => setShowCustomPanel(false)} 
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                      >
                        下一步
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
                      {[
                        { id: "model", label: "模特" },
                        { id: "bg", label: "环境" }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setActiveCustomTab(tab.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                            activeCustomTab === tab.id 
                              ? "bg-black text-white" 
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      {activeCustomTab === "model" && (
                        <div className="space-y-4">
                          {/* Model Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setModelSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !modelSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              全部
                            </button>
                            <button
                              onClick={() => setModelSubcategory(modelSubcategory === 'mine' ? null : 'mine')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                modelSubcategory === 'mine'
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              我的
                              {userModels.length > 0 && <span className="ml-1 text-zinc-400">({userModels.length})</span>}
                            </button>
                          </div>
                          <AssetGrid 
                            items={allModels} 
                            selectedId={selectedModel} 
                            onSelect={(id) => {
                              setSelectedModel(selectedModel === id ? null : id)
                            }}
                            onUpload={() => modelUploadRef.current?.click()}
                            uploadLabel="上传模特"
                          />
                        </div>
                      )}
                      {activeCustomTab === "bg" && (
                        <div className="space-y-4">
                          {/* Background Subcategory Tabs */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setBgSubcategory(null)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                !bgSubcategory
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              全部
                            </button>
                            <button
                              onClick={() => setBgSubcategory(bgSubcategory === 'mine' ? null : 'mine')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                bgSubcategory === 'mine'
                                  ? "bg-zinc-900 text-white"
                                  : "bg-white text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              我的
                              {userBackgrounds.length > 0 && <span className="ml-1 text-zinc-400">({userBackgrounds.length})</span>}
                            </button>
                          </div>
                          <AssetGrid 
                            items={allBackgrounds} 
                            selectedId={selectedBg} 
                            onSelect={(id) => setSelectedBg(selectedBg === id ? null : id)}
                            onUpload={() => bgUploadRef.current?.click()}
                            uploadLabel="上传环境"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            
            {/* Slide-up Panel: Product Assets */}
            <AnimatePresence>
              {showProductPanel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowProductPanel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">选择商品</span>
                      <button 
                        onClick={() => setShowProductPanel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Source Tabs */}
                    <div className="px-4 py-2 border-b bg-white dark:bg-zinc-900">
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                          onClick={() => setProductSourceTab("preset")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "preset"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          官方示例
                          <span className="ml-1 text-zinc-400">({PRESET_PRODUCTS.length})</span>
                        </button>
                        <button
                          onClick={() => setProductSourceTab("user")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "user"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          我的商品
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      {productSourceTab === "preset" ? (
                        <div className="grid grid-cols-3 gap-3 pb-20 relative">
                          {isLoadingAssets && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                          )}
                          {PRESET_PRODUCTS.map(product => (
                            <button
                              key={product.id}
                              disabled={isLoadingAssets}
                              onClick={async () => {
                                // Need to convert URL to base64 for preset products
                                setIsLoadingAssets(true)
                                try {
                                  const base64 = await ensureBase64(product.imageUrl)
                                  if (base64) {
                                    setCapturedImage(base64)
                                    setProductFromPhone(false) // From asset library, not phone
                                    setMode("review")
                                    setShowProductPanel(false)
                                  }
                                } catch (e) {
                                  console.error("Failed to load preset product:", e)
                                } finally {
                                  setIsLoadingAssets(false)
                                }
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                官方
                              </span>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : userProducts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 pb-20">
                          {userProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                setCapturedImage(product.imageUrl)
                                setProductFromPhone(false) // From asset library, not phone
                                setMode("review")
                                setShowProductPanel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
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
                            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
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
            
            {/* Slide-up Panel: Product 2 Assets */}
            <AnimatePresence>
              {showProduct2Panel && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setShowProduct2Panel(false)}
                  />
                  <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute bottom-0 left-0 right-0 h-[60%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
                  >
                    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
                      <span className="font-semibold">添加商品 2</span>
                      <button 
                        onClick={() => setShowProduct2Panel(false)} 
                        className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Upload from album option */}
                    <div className="px-4 py-3 border-b">
                      <button
                        onClick={() => {
                          setShowProduct2Panel(false)
                          fileInputRef2.current?.click()
                        }}
                        className="w-full h-12 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        <ImageIcon className="w-5 h-5" />
                        从相册上传
                      </button>
                    </div>
                    
                    {/* Source Tabs */}
                    <div className="px-4 py-2 border-b bg-white dark:bg-zinc-900">
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                          onClick={() => setProductSourceTab("preset")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "preset"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          官方示例
                          <span className="ml-1 text-zinc-400">({PRESET_PRODUCTS.length})</span>
                        </button>
                        <button
                          onClick={() => setProductSourceTab("user")}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            productSourceTab === "user"
                              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          我的商品
                          {userProducts.length > 0 && (
                            <span className="ml-1 text-zinc-400">({userProducts.length})</span>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
                      {productSourceTab === "preset" ? (
                        <div className="grid grid-cols-3 gap-3 pb-20 relative">
                          {isLoadingAssets && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                          )}
                          {PRESET_PRODUCTS.map(product => (
                            <button
                              key={product.id}
                              disabled={isLoadingAssets}
                              onClick={async () => {
                                // Need to convert URL to base64 for preset products
                                setIsLoadingAssets(true)
                                try {
                                  const base64 = await ensureBase64(product.imageUrl)
                                  if (base64) {
                                    setCapturedImage2(base64)
                                    setProduct2FromPhone(false) // From asset library, not phone
                                    setShowProduct2Panel(false)
                                  }
                                } catch (e) {
                                  console.error("Failed to load preset product:", e)
                                } finally {
                                  setIsLoadingAssets(false)
                                }
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                                官方
                              </span>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                <p className="text-[10px] text-white truncate text-center">{product.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : userProducts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 pb-20">
                          {userProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => {
                                setCapturedImage2(product.imageUrl)
                                setProduct2FromPhone(false) // From asset library, not phone
                                setShowProduct2Panel(false)
                              }}
                              className="aspect-square rounded-lg overflow-hidden relative border-2 border-transparent hover:border-blue-500 transition-all"
                            >
                              <Image src={product.imageUrl} alt={product.name || ""} fill className="object-cover" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
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
                              setShowProduct2Panel(false)
                              router.push("/brand-assets")
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
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
          </motion.div>
        )}

        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            
            <h3 className="text-white text-2xl font-bold mb-2">AI 正在拍摄...</h3>
            <div className="text-zinc-400 space-y-1 text-sm mb-8">
              <p>分析商品光影...</p>
              {activeModel && <p>生成模特 {activeModel.name} ...</p>}
              {selectedModelStyle && !activeModel && (
                <p>匹配{MODEL_STYLES.find(s => s.id === selectedModelStyle)?.label}风格...</p>
              )}
              {activeBg && <p>渲染场景背景...</p>}
            </div>
            
            {/* Action buttons during processing */}
            <div className="space-y-3 w-full max-w-xs">
              <p className="text-zinc-500 text-xs mb-4">生成将在后台继续，您可以：</p>
              <button
                onClick={handleNewPhotoDuringProcessing}
                className="w-full h-12 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
              >
                <Camera className="w-5 h-5" />
                拍摄新商品
              </button>
              <button
                onClick={handleReturnDuringProcessing}
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                返回主页
              </button>
            </div>
          </motion.div>
        )}

        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            <div className="h-14 flex items-center px-4 border-b bg-white z-10">
              <button 
                onClick={handleRetake} 
                className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold ml-2">本次成片</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-10">
              {/* Simple Mode Images (极简模式) - indices 0, 1, 2 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-green-500 rounded-full" />
                    极简模式
                  </h3>
                  <span className="text-[10px] text-zinc-400">直接生成</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {generatedImages.slice(0, 3).map((url, i) => (
                    <div 
                      key={i} 
                      className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                      onClick={() => setSelectedResultIndex(i)}
                    >
                      <Image src={url} alt="Result" fill className="object-cover" />
                      {/* Favorite button */}
                      <button 
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                          currentGenerationId && isFavorited(currentGenerationId, i) 
                            ? "bg-red-500 text-white" 
                            : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResultFavorite(i)
                        }}
                      >
                        <Heart className={`w-3.5 h-3.5 ${currentGenerationId && isFavorited(currentGenerationId, i) ? "fill-current" : ""}`} />
                      </button>
                      {/* Type badge */}
                      <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500 text-white">
                          极简
                        </span>
                        {generatedModelTypes[i] === 'flash' && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-amber-500 text-white">
                            2.5
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extended Mode Images (扩展模式) - indices 3, 4, 5 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-600 rounded-full" />
                    扩展模式
                  </h3>
                  <span className="text-[10px] text-zinc-400">摄影指令 + 生成</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {generatedImages.slice(3, 6).map((url, i) => {
                    const actualIndex = i + 3
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setSelectedResultIndex(actualIndex)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        {/* Favorite button */}
                        <button 
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                            currentGenerationId && isFavorited(currentGenerationId, actualIndex) 
                              ? "bg-red-500 text-white" 
                              : "bg-white/90 backdrop-blur text-zinc-500 hover:text-red-500"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResultFavorite(actualIndex)
                          }}
                        >
                          <Heart className={`w-3.5 h-3.5 ${currentGenerationId && isFavorited(currentGenerationId, actualIndex) ? "fill-current" : ""}`} />
                        </button>
                        {/* Type badge */}
                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500 text-white">
                            扩展
                          </span>
                          {generatedModelTypes[actualIndex] === 'flash' && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-amber-500 text-white">
                              2.5
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t shadow-up">
              <button 
                onClick={handleRetake}
                className="w-full h-12 text-lg rounded-lg bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                拍摄下一组
              </button>
            </div>
            
            {/* Result Detail Dialog */}
            {selectedResultIndex !== null && generatedImages[selectedResultIndex] && (
              <div className="fixed inset-0 z-50 bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="h-14 flex items-center justify-between px-4 bg-white border-b shrink-0">
                    <button
                      onClick={() => setSelectedResultIndex(null)}
                      className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-700" />
                    </button>
                    <span className="font-semibold text-zinc-900">详情</span>
                    <div className="w-10" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-zinc-100">
                    <div 
                      className="relative aspect-[4/5] bg-zinc-900 cursor-pointer group"
                      onClick={() => setFullscreenImage(generatedImages[selectedResultIndex])}
                    >
                      <Image 
                        src={generatedImages[selectedResultIndex]} 
                        alt="Detail" 
                        fill 
                        className="object-contain" 
                      />
                      {/* Zoom hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <ZoomIn className="w-6 h-6 text-zinc-700" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 pb-8 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {/* Generation mode badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              selectedResultIndex < 3 
                                ? "bg-green-100 text-green-700" 
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {selectedResultIndex < 3 ? "极简模式" : "扩展模式"}
                            </span>
                            {generatedModelTypes[selectedResultIndex] === 'flash' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                                Gemini 2.5
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            刚刚生成
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResultFavorite(selectedResultIndex)}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                              currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex)
                                ? "bg-red-50 border-red-200 text-red-500"
                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${currentGenerationId && isFavorited(currentGenerationId, selectedResultIndex) ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleDownload(generatedImages[selectedResultIndex])}
                            className="w-10 h-10 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Generation Parameters - Only show in debug mode */}
                      {debugMode && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                        
                        {/* This image's prompt */}
                        {generatedPrompts[selectedResultIndex] && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-zinc-500 mb-2">Prompt</p>
                            <div className="bg-zinc-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                              <pre className="text-[11px] text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
                                {generatedPrompts[selectedResultIndex]}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {/* Reference images */}
                        <div className="space-y-3">
                          {/* Reference images grid */}
                          <div className="grid grid-cols-4 gap-2">
                            {/* Input Product Image */}
                            {capturedImage && (
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                                  <img 
                                    src={capturedImage} 
                                    alt="商品" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1">商品</p>
                              </div>
                            )}
                            
                            {/* Model Image */}
                            {activeModel?.imageUrl && (
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                                  <Image 
                                    src={activeModel.imageUrl} 
                                    alt="模特" 
                                    width={56}
                                    height={56}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{activeModel.name || '模特'}</p>
                              </div>
                            )}
                            
                            {/* Background Image */}
                            {activeBg?.imageUrl && (
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100">
                                  <Image 
                                    src={activeBg.imageUrl} 
                                    alt="背景" 
                                    width={56}
                                    height={56}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[56px]">{activeBg.name || '背景'}</p>
                              </div>
                            )}
                            
                          </div>
                          
                          {/* Style params */}
                          {(selectedModelStyle && selectedModelStyle !== 'auto') || selectedModelGender ? (
                            <div className="flex gap-2 flex-wrap">
                              {selectedModelStyle && selectedModelStyle !== 'auto' && (
                                <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                  风格: {selectedModelStyle === 'korean' ? '韩系' : selectedModelStyle === 'western' ? '欧美' : selectedModelStyle}
                                </span>
                              )}
                              {selectedModelGender && (
                                <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] text-zinc-600">
                                  性别: {selectedModelGender === 'male' ? '男' : selectedModelGender === 'female' ? '女' : selectedModelGender === 'boy' ? '男童' : '女童'}
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      )}

                      <button 
                        onClick={() => {
                          setSelectedResultIndex(null)
                          handleGoToEdit(generatedImages[selectedResultIndex])
                        }}
                        className="w-full h-12 mt-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        去修图
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          >
            {/* Close button */}
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Image with zoom */}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              doubleClick={{ mode: "reset" }}
              panning={{ velocityDisabled: true }}
              onPinchingStop={(ref) => {
                // Reset to scale 1 if zoomed out too much
                if (ref.state.scale < 1) {
                  ref.resetTransform()
                }
              }}
            >
              {({ resetTransform }) => (
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full"
                  >
                    <Image
                      src={fullscreenImage}
                      alt="Fullscreen"
                      fill
                      className="object-contain"
                      quality={100}
                      draggable={false}
                    />
                  </motion.div>
                </TransformComponent>
              )}
            </TransformWrapper>
            
            {/* Tap to close hint */}
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="text-white/60 text-sm">双指缩放 · 双击重置 · 点击 × 关闭</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
