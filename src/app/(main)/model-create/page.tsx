"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, X, ImagePlus, ChevronRight, Sparkles, FolderHeart, 
  Upload, Loader2, Camera, Sliders, RefreshCw, Download, Share2, Home, Check
} from "lucide-react"
import { useModelCreateStore } from "@/stores/modelCreateStore"
import { useAssetStore } from "@/stores/assetStore"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/stores/languageStore"
import { generateId } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { useImageDownload } from "@/hooks/useImageDownload"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"

// 创建模式类型
type CreateMode = 'reference' | 'selector' | null

// 页面状态
type PageState = 'mode-select' | 'reference-input' | 'selector-input' | 'generating' | 'result'

// 性别显示名映射
const GENDER_LABELS: Record<string, Record<string, string>> = {
  zh: { male: '男性', female: '女性' },
  en: { male: 'Male', female: 'Female' },
  ko: { male: '남성', female: '여성' },
}

// 年龄组显示名映射
const AGE_GROUP_LABELS: Record<string, Record<string, string>> = {
  zh: { 
    YoungAdult: '青年', 
    Adult: '成年', 
    Mature: '中年',
    Senior: '老年',
    Teen: '青少年',
  },
  en: { 
    YoungAdult: 'Young Adult', 
    Adult: 'Adult', 
    Mature: 'Mature',
    Senior: 'Senior',
    Teen: 'Teen',
  },
  ko: { 
    YoungAdult: '청년', 
    Adult: '성인', 
    Mature: '중년',
    Senior: '노년',
    Teen: '청소년',
  },
}

// 人种显示名映射
const ETHNICITY_LABELS: Record<string, Record<string, string>> = {
  zh: { 
    White: '白人', 
    Black: '黑人', 
    EastAsian: '东亚人',
    SouthAsian: '南亚人',
    SoutheastAsian: '东南亚人',
    MiddleEastern: '中东人',
    Latino_Hispanic: '拉丁裔',
    Mixed: '混血',
  },
  en: { 
    White: 'White', 
    Black: 'Black', 
    EastAsian: 'East Asian',
    SouthAsian: 'South Asian',
    SoutheastAsian: 'Southeast Asian',
    MiddleEastern: 'Middle Eastern',
    Latino_Hispanic: 'Latino/Hispanic',
    Mixed: 'Mixed',
  },
  ko: { 
    White: '백인', 
    Black: '흑인', 
    EastAsian: '동아시아인',
    SouthAsian: '남아시아인',
    SoutheastAsian: '동남아시아인',
    MiddleEastern: '중동인',
    Latino_Hispanic: '라틴계',
    Mixed: '혼혈',
  },
}

export default function ModelCreatePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  
  // Device detection
  const { isDesktop, isMobile, isLoading: screenLoading } = useIsDesktop(1024)
  
  // 页面状态
  const [pageState, setPageState] = useState<PageState>('mode-select')
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [userPrompt, setUserPrompt] = useState('')
  
  // 模式2：选择器状态
  const [selectorOptions, setSelectorOptions] = useState<{
    genders: string[]
    ageGroups: string[]
    ethnicities: string[]
  } | null>(null)
  const [selectedGender, setSelectedGender] = useState<string>('')
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('')
  const [selectedEthnicity, setSelectedEthnicity] = useState<string>('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  
  // 生成状态
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [analysisSummary, setAnalysisSummary] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [generationProgress, setGenerationProgress] = useState<string>('')
  
  // 放大查看
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  
  const { reset } = useModelCreateStore()
  const { userModels, addGeneration } = useAssetStore()
  const { t, language } = useTranslation()
  
  // 模特资产（用于选择参考图）
  const modelAssets = userModels
  
  // 获取当前语言的标签
  const lang = language || 'zh'
  const genderLabels = GENDER_LABELS[lang] || GENDER_LABELS.zh
  const ageGroupLabels = AGE_GROUP_LABELS[lang] || AGE_GROUP_LABELS.zh
  const ethnicityLabels = ETHNICITY_LABELS[lang] || ETHNICITY_LABELS.zh
  
  // 检测 iOS
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  
  // 压缩图片函数
  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          
          // 计算压缩比例，限制最大尺寸
          const MAX_DIMENSION = 2048
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width)
              width = MAX_DIMENSION
            } else {
              width = Math.round((width * MAX_DIMENSION) / height)
              height = MAX_DIMENSION
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(file)
            return
          }
          
          ctx.drawImage(img, 0, 0, width, height)
          
          // 动态调整质量以达到目标大小
          let quality = 0.85
          const targetSize = maxSizeMB * 1024 * 1024
          
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file)
                  return
                }
                
                if (blob.size > targetSize && quality > 0.3) {
                  quality -= 0.1
                  tryCompress()
                } else {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  })
                  console.log(`[Compress] ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
                  resolve(compressedFile)
                }
              },
              'image/jpeg',
              quality
            )
          }
          
          tryCompress()
        }
        img.onerror = () => resolve(file)
        img.src = e.target?.result as string
      }
      reader.onerror = () => resolve(file)
      reader.readAsDataURL(file)
    })
  }
  
  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login?redirect=/model-create')
        return
      }
      
      setIsCheckingAuth(false)
    }
    
    checkAuth()
  }, [router])
  
  // 加载选择器选项（模式2）
  const loadSelectorOptions = async () => {
    if (selectorOptions) return
    
    setIsLoadingOptions(true)
    setErrorMessage('')
    try {
      const response = await fetch('/api/model-create/match-models')
      
      if (!response.ok) {
        const text = await response.text()
        console.error('Load options error:', response.status, text)
        setErrorMessage(t.modelCreate?.loadOptionsFailed || '加载选项失败')
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setSelectorOptions(data.options)
      } else {
        setErrorMessage(data.error || t.modelCreate?.loadOptionsFailed || '加载选项失败')
      }
    } catch (err) {
      console.error('Failed to load selector options:', err)
      setErrorMessage(t.modelCreate?.loadOptionsFailed || '加载选项失败')
    } finally {
      setIsLoadingOptions(false)
    }
  }
  
  // 上传文件到 Supabase
  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/model-create/upload-product', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const text = await response.text()
        console.error('Upload error:', response.status, text)
        if (response.status === 413) {
          setErrorMessage('图片太大，请使用较小的图片')
        } else {
          setErrorMessage('上传失败，请重试')
        }
        return null
      }
      
      const data = await response.json()
      
      if (!data.success) {
        console.error('Upload failed:', data.error)
        setErrorMessage(data.error || '上传失败')
        return null
      }
      
      return data.url
    } catch (error) {
      console.error('Upload error:', error)
      setErrorMessage('上传失败，请重试')
      return null
    }
  }
  
  // 处理文件选择（参考图）
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || isUploading || files.length === 0) return
    
    let file = files[0]
    if (!file.type.startsWith('image/')) return
    
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      // 如果文件大于 2MB，先压缩
      if (file.size > 2 * 1024 * 1024) {
        setUploadProgress(20)
        console.log(`[Upload] Compressing large image: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
        file = await compressImage(file, 2)
      }
      
      setUploadProgress(50)
        const url = await uploadFileToStorage(file)
        if (url) {
        setReferenceImage(url)
      }
      setUploadProgress(100)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }
  
  // 从资产库添加
  const handleAddFromAssets = (imageUrl: string) => {
    setReferenceImage(imageUrl)
      setShowAssetPicker(false)
  }
  
  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }
  
  // 模式1：使用参考图生成
  const handleGenerateWithReference = async () => {
    if (!referenceImage) return
    
    setPageState('generating')
    setGeneratedImages([])
    setErrorMessage('')
    setGenerationProgress(t.modelCreate?.analyzingReference || '正在分析参考模特...')
    
    try {
      const response = await fetch('/api/model-create/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage,
          userPrompt,
        }),
      })
      
      // 检查响应状态
      if (!response.ok) {
        const text = await response.text()
        console.error('Generate API error:', response.status, text)
        let errorMsg = t.modelCreate?.generateFailed || '生成失败'
        try {
          const errData = JSON.parse(text)
          errorMsg = errData.error || errorMsg
        } catch {
          // 无法解析为 JSON
          if (response.status === 413) {
            errorMsg = '图片太大，请使用较小的图片'
          } else if (response.status === 401) {
            errorMsg = '请先登录'
          } else if (response.status >= 500) {
            errorMsg = '服务器繁忙，请稍后重试'
          }
        }
        setErrorMessage(errorMsg)
        setPageState('reference-input')
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setGeneratedImages(data.imageUrls || [data.imageUrl])
        setAnalysisSummary(data.analysisSummary || '')
        setPageState('result')
        
        // 更新本地状态
        if (data.dbId) {
          addGeneration({
            id: data.dbId,
            type: 'create_model',
            inputImageUrl: referenceImage,
            outputImageUrls: data.imageUrls || [data.imageUrl],
            createdAt: new Date().toISOString(),
          })
        }
      } else {
        setErrorMessage(data.error || t.modelCreate?.generateFailed || '生成失败')
        setPageState('reference-input')
      }
    } catch (err: any) {
      console.error('Generate error:', err)
      setErrorMessage(err.message || t.modelCreate?.generateFailed || '生成失败')
      setPageState('reference-input')
    }
  }
  
  // 安全解析 JSON 响应
  const safeParseResponse = async (response: Response, defaultError: string): Promise<{ ok: boolean; data?: any; error?: string }> => {
    if (!response.ok) {
      const text = await response.text()
      console.error('API error:', response.status, text)
      try {
        const errData = JSON.parse(text)
        return { ok: false, error: errData.error || defaultError }
      } catch {
        if (response.status === 413) {
          return { ok: false, error: '请求数据太大' }
        } else if (response.status === 401) {
          return { ok: false, error: '请先登录' }
        } else if (response.status >= 500) {
          return { ok: false, error: '服务器繁忙，请稍后重试' }
        }
        return { ok: false, error: defaultError }
      }
    }
    try {
      const data = await response.json()
      return { ok: true, data }
    } catch (e) {
      console.error('JSON parse error:', e)
      return { ok: false, error: '响应解析失败' }
    }
  }
  
  // 模式2：使用选择器生成
  const handleGenerateWithSelector = async () => {
    if (!selectedGender) {
      setErrorMessage(t.modelCreate?.genderRequired || '请选择性别')
      return
    }
    
    setPageState('generating')
    setGeneratedImages([])
    setErrorMessage('')
    setGenerationProgress(t.modelCreate?.matchingModels || '正在匹配模特...')
    
    try {
      // Step 1: 匹配模特
      const matchResponse = await fetch('/api/model-create/match-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: selectedGender,
          ageGroup: selectedAgeGroup || undefined,
          ethnicity: selectedEthnicity || undefined,
          userPrompt: userPrompt || undefined,
        }),
      })
      
      const matchResult = await safeParseResponse(matchResponse, t.modelCreate?.noMatchingModels || '匹配模特失败')
      
      if (!matchResult.ok || !matchResult.data?.success) {
        setErrorMessage(matchResult.error || matchResult.data?.error || t.modelCreate?.noMatchingModels || '没有找到符合条件的模特')
        setPageState('selector-input')
        return
      }
      
      const matchData = matchResult.data
      setGenerationProgress(t.modelCreate?.generatingModel || '正在生成模特...')
      
      // Step 2: 使用匹配的模特图生成新模特
      const generateResponse = await fetch('/api/model-create/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage: matchData.selectedModel.imageUrl,
          userPrompt,
        }),
      })
      
      const generateResult = await safeParseResponse(generateResponse, t.modelCreate?.generateFailed || '生成失败')
      
      if (!generateResult.ok || !generateResult.data?.success) {
        setErrorMessage(generateResult.error || generateResult.data?.error || t.modelCreate?.generateFailed || '生成失败')
        setPageState('selector-input')
        return
      }
      
      const generateData = generateResult.data
      setGeneratedImages(generateData.imageUrls || [generateData.imageUrl])
      setAnalysisSummary(generateData.analysisSummary || '')
      setPageState('result')
      
      // 更新本地状态
      if (generateData.dbId) {
        addGeneration({
          id: generateData.dbId,
          type: 'create_model',
          inputImageUrl: matchData.selectedModel.imageUrl,
          outputImageUrls: generateData.imageUrls || [generateData.imageUrl],
          createdAt: new Date().toISOString(),
        })
      }
    } catch (err: any) {
      console.error('Generate error:', err)
      setErrorMessage(err.message || t.modelCreate?.generateFailed || '生成失败')
      setPageState('selector-input')
    }
  }
  
  // 返回处理
  const handleBack = () => {
    if (pageState === 'result') {
      // 从结果页返回到输入页
      setPageState(createMode === 'reference' ? 'reference-input' : 'selector-input')
      setGeneratedImages([])
    } else if (pageState === 'reference-input' || pageState === 'selector-input') {
      // 从输入页返回到模式选择
      setPageState('mode-select')
      setCreateMode(null)
      setReferenceImage(null)
      setUserPrompt('')
      setSelectedGender('')
      setSelectedAgeGroup('')
      setSelectedEthnicity('')
      setErrorMessage('')
    } else {
      // 从模式选择返回首页
    reset()
    router.push('/')
    }
  }
  
  // 重新生成
  const handleRegenerate = () => {
    if (createMode === 'reference') {
      handleGenerateWithReference()
    } else {
      handleGenerateWithSelector()
    }
  }
  
  // 下载图片 - using shared hook
  const { downloadImage } = useImageDownload({ filenamePrefix: 'custom-model' })
  const handleDownload = (imageUrl: string, index: number) =>
    downloadImage(imageUrl, { filename: `custom-model-${index + 1}.png` })
  
  // 防止 hydration 闪烁
  if (screenLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  // 加载中
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-violet-600 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-zinc-500">{t.modelCreate?.loading || t.common?.loading || '加载中...'}</p>
        </div>
      </div>
    )
  }
  
  // 生成中页面
  if (pageState === 'generating') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center">
        <div className="text-center px-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate?.generatingModel || '生成中...'}</h2>
          <p className="text-sm text-zinc-500">{generationProgress}</p>
          <p className="text-xs text-zinc-400 mt-4">{t.modelCreate?.generatingDesc || 'AI 正在为你创建独一无二的模特形象'}</p>
        </div>
      </div>
    )
  }
  
  // 结果页面
  if (pageState === 'result' && generatedImages.length > 0) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-violet-100/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-zinc-900">{t.modelCreate?.generateComplete || '生成完成'}</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-32">
            {/* Summary */}
            {analysisSummary && (
              <div className="mb-6 p-4 bg-violet-50 rounded-xl">
                <p className="text-sm text-violet-700">{analysisSummary}</p>
              </div>
            )}
            
            {/* Images Grid */}
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map((imageUrl, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 shadow-lg group"
                >
                  {/* 点击放大 */}
                  <button
                    onClick={() => setZoomImage(imageUrl)}
                    className="absolute inset-0 z-10"
                  />
                  <Image
                    src={imageUrl}
                    alt={`${t.modelCreate?.generatedModel || '生成的模特'} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  {/* 序号 */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full z-20">
                    <span className="text-xs font-medium text-white">#{index + 1}</span>
                  </div>
                  
                  {/* 下载按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(imageUrl, index)
                    }}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isIOS ? (
                      <Share2 className="w-4 h-4 text-zinc-700" />
                    ) : (
                      <Download className="w-4 h-4 text-zinc-700" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom Actions */}
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <div className="flex gap-3">
            <button
              onClick={handleRegenerate}
              className="flex-1 py-3.5 rounded-xl font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.modelCreate?.regenerate || '重新生成'}</span>
            </button>
            <button
              onClick={() => router.push('/gallery?tab=model&subType=create_model')}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{t.modelCreate?.viewGallery || '查看成片'}</span>
            </button>
          </div>
        </div>
        
        {/* Zoom Modal */}
        <AnimatePresence>
          {zoomImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
              onClick={() => setZoomImage(null)}
            >
              <button
                onClick={() => setZoomImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="relative w-full max-w-lg aspect-[3/4] mx-4"
                onClick={e => e.stopPropagation()}
              >
                <Image
                  src={zoomImage}
                  alt={t.modelCreate?.generatedModel || '生成的模特'}
                  fill
                  className="object-contain"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  
  // 模式选择页面
  if (pageState === 'mode-select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-violet-100/50">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-700" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-zinc-900">{t.modelCreate?.title || '定制模特'}</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t.modelCreate?.selectMode || '选择创建方式'}</h1>
            <p className="text-sm text-zinc-500">{t.modelCreate?.selectModeDesc || '选择适合你的模特创建模式'}</p>
          </div>
          
          <div className="space-y-4 max-w-md mx-auto">
            {/* 模式1：上传参考图 */}
            <button
              onClick={() => {
                setCreateMode('reference')
                setPageState('reference-input')
              }}
              className="w-full p-6 bg-white rounded-2xl border-2 border-zinc-100 hover:border-violet-300 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                  <Camera className="w-7 h-7 text-violet-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-zinc-900 mb-1">{t.modelCreate?.modeReference || '上传参考模特'}</h3>
                  <p className="text-sm text-zinc-500">{t.modelCreate?.modeReferenceDesc || '上传一张模特照片，AI 将分析并生成相似风格的新模特'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-violet-600 transition-colors mt-4" />
              </div>
            </button>
            
            {/* 模式2：属性选择器 */}
            <button
              onClick={() => {
                setCreateMode('selector')
                setPageState('selector-input')
                loadSelectorOptions()
              }}
              className="w-full p-6 bg-white rounded-2xl border-2 border-zinc-100 hover:border-violet-300 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Sliders className="w-7 h-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-zinc-900 mb-1">{t.modelCreate?.modeSelector || '属性选择器'}</h3>
                  <p className="text-sm text-zinc-500">{t.modelCreate?.modeSelectorDesc || '选择性别、年龄、人种等属性，AI 将匹配并生成模特'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-purple-600 transition-colors mt-4" />
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // 模式1：上传参考图输入页
  if (pageState === 'reference-input') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-violet-100/50">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-violet-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-700" />
            </button>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-600" />
              <span className="font-bold text-zinc-900">{t.modelCreate?.uploadReference || '上传参考模特'}</span>
            </div>
            <div className="w-10" />
        </div>
      </div>
      
        {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 pb-32">
          {/* Title */}
          <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate?.uploadReferenceTitle || '上传参考模特图'}</h1>
              <p className="text-sm text-zinc-500">{t.modelCreate?.uploadReferenceDesc || '上传一张模特照片，AI 将分析并生成相似风格的新模特'}</p>
          </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {errorMessage}
              </div>
            )}
          
          {/* Upload Area */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all min-h-[280px] ${
              isDragging
                ? 'border-violet-500 bg-violet-50'
                : 'border-zinc-200 bg-white hover:border-violet-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="p-4">
                {referenceImage ? (
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 group">
                        <Image
                      src={referenceImage}
                      alt="Reference Model"
                          fill
                          className="object-cover"
                        />
                        <button
                      onClick={() => setReferenceImage(null)}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-violet-500" />
                  </div>
                  <div className="text-center">
                      <p className="text-sm font-medium text-zinc-700 mb-1">{t.modelCreate?.clickToUploadReference || '点击上传参考模特图'}</p>
                      <p className="text-xs text-zinc-400">{t.modelCreate?.orDragHere || '或拖拽图片到这里'}</p>
                  </div>
                </button>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                    <span className="text-sm font-medium text-violet-600">{t.modelCreate?.uploading || '上传中'} {uploadProgress}%</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-zinc-600" />
                    <span className="text-sm font-medium text-zinc-700">{t.modelCreate?.localUpload || '本地上传'}</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowAssetPicker(true)}
                disabled={isUploading}
                className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FolderHeart className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-medium text-zinc-700">{t.modelCreate?.selectFromAssets || '从资产库选择'}</span>
            </button>
          </div>
          
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          
            {/* User Prompt */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t.modelCreate?.extraDescription || '额外描述（可选）'}
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={t.modelCreate?.extraDescriptionPlaceholder || '例如：希望模特更加高冷、时尚感更强...'}
                className="w-full h-24 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
          </div>
        </div>
      </div>
      
        {/* Bottom Action */}
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
        <button
            onClick={handleGenerateWithReference}
            disabled={!referenceImage}
          className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
              referenceImage
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200'
              : 'bg-zinc-300 cursor-not-allowed'
          }`}
        >
            <Sparkles className="w-5 h-5" />
            <span>{t.modelCreate?.generateModel || '生成模特'}</span>
        </button>
      </div>
      
      {/* Asset Picker Modal */}
      <AnimatePresence>
        {showAssetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setShowAssetPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl max-h-[70vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100">
                  <h3 className="text-lg font-bold text-zinc-900">{t.modelCreate?.selectFromAssets || '从资产库选择'}</h3>
                <button
                  onClick={() => setShowAssetPicker(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-zinc-600" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                  {modelAssets && modelAssets.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                      {modelAssets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleAddFromAssets(asset.imageUrl)}
                          className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-violet-400"
                        >
                          <Image
                            src={asset.imageUrl}
                            alt={asset.name || '模特'}
                            fill
                            className="object-cover"
                          />
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FolderHeart className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">{t.modelCreate?.noProductsInAssets || '资产库为空'}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  
  // 模式2：属性选择器输入页
  if (pageState === 'selector-input') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-purple-100/50">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-purple-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-700" />
            </button>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              <span className="font-bold text-zinc-900">{t.modelCreate?.attributeSelector || '属性选择器'}</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-32">
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-zinc-900 mb-2">{t.modelCreate?.selectAttributes || '选择模特属性'}</h1>
              <p className="text-sm text-zinc-500">{t.modelCreate?.selectAttributesDesc || '选择性别、年龄、人种，AI 将匹配并生成模特'}</p>
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {errorMessage}
              </div>
            )}
            
            {isLoadingOptions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                <span className="ml-2 text-sm text-zinc-500">{t.modelCreate?.loadingOptions || '加载选项中...'}</span>
              </div>
            ) : selectorOptions ? (
              <div className="space-y-6">
                {/* 性别选择 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">
                    {t.modelCreate?.genderLabel || '性别'} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {selectorOptions.genders.map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setSelectedGender(gender)}
                        className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                          selectedGender === gender
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
                        }`}
                      >
                        {genderLabels[gender] || gender}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 年龄组选择 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">
                    {t.modelCreate?.ageGroupLabel || '年龄组（可选）'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedAgeGroup('')}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        selectedAgeGroup === ''
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
                      }`}
                    >
                      {t.modelCreate?.noLimit || '不限'}
                    </button>
                    {selectorOptions.ageGroups.map((age) => (
                      <button
                        key={age}
                        onClick={() => setSelectedAgeGroup(age)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          selectedAgeGroup === age
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
                        }`}
                      >
                        {ageGroupLabels[age] || age}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 人种选择 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">
                    {t.modelCreate?.ethnicityLabel || '人种（可选）'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEthnicity('')}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        selectedEthnicity === ''
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
                      }`}
                    >
                      {t.modelCreate?.noLimit || '不限'}
                    </button>
                    {selectorOptions.ethnicities.map((eth) => (
                      <button
                        key={eth}
                        onClick={() => setSelectedEthnicity(eth)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          selectedEthnicity === eth
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
                        }`}
                      >
                        {ethnicityLabels[eth] || eth}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* User Prompt */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    {t.modelCreate?.extraDescription || '额外描述（可选）'}
                  </label>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder={t.modelCreate?.extraDescriptionPlaceholder || '例如：希望模特更加高冷、时尚感更强...'}
                    className="w-full h-24 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-500">{t.modelCreate?.loadOptionsFailed || '加载选项失败，请重试'}</p>
                <button
                  onClick={loadSelectorOptions}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                >
                  {t.common?.retry || '重试'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Action */}
        {selectorOptions && (
          <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
            <button
              onClick={handleGenerateWithSelector}
              disabled={!selectedGender}
              className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                selectedGender
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-200'
                  : 'bg-zinc-300 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>{t.modelCreate?.generateModel || '生成模特'}</span>
            </button>
          </div>
        )}
    </div>
  )
  }
  
  return null
}
