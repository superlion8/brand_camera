"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Loader2, Image as ImageIcon, 
  X, Home, Check, ZoomIn,
  Camera, Sparkles, Users
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { fileToBase64, compressBase64Image, ensureBase64 } from "@/lib/utils"
import Image from "next/image"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { BottomNav } from "@/components/shared/BottomNav"
import { useAuth } from "@/components/providers/AuthProvider"
import { useLanguageStore } from "@/stores/languageStore"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAssetStore } from "@/stores/assetStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { Suspense } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { 
  isModelType as isBuyerShowType,  // 买家秀 (model_studio)
  isProStudioType,                  // 专业棚拍 (pro_studio)
  isGroupShootType,                 // 组图 (group_shoot)
  isModelRelatedType                // 所有模特相关类型
} from "@/lib/taskTypes"

type PageMode = "main" | "processing" | "results"
type StyleMode = "lifestyle" | "studio"  // 生活模式 / 棚拍模式
type ShootMode = "random"  // 只保留随意拍模式

// 生成图片数量
const GROUP_NUM_IMAGES = 4

// 包装组件以支持 Suspense
function GroupShootPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const t = useLanguageStore(state => state.t)
  const { checkQuota, showExceededModal, requiredCount, closeExceededModal, quota, refreshQuota } = useQuota()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots, tasks } = useGenerationTaskStore()
  const { generations } = useAssetStore()
  const { debugMode } = useSettingsStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Device detection
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  
  // State
  const [mode, setMode] = useState<PageMode>("main")
  const [styleMode, setStyleMode] = useState<StyleMode>("lifestyle")
  const [shootMode, setShootMode] = useState<ShootMode>("random")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [gallerySubType, setGallerySubType] = useState<'all' | 'buyer' | 'pro' | 'group'>('all')
  
  // Results state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // 从 URL 参数恢复模式和 taskId（刷新后恢复）
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'processing' || urlMode === 'results') {
      setMode(urlMode as PageMode)
      // 从 sessionStorage 恢复 taskId
      const savedTaskId = sessionStorage.getItem('groupTaskId')
      if (savedTaskId) {
        setCurrentTaskId(savedTaskId)
        
        // 如果是 results 模式且 tasks 为空（刷新后），从数据库恢复图片
        if (urlMode === 'results' && tasks.length === 0) {
          console.log('[GroupShoot] Recovering images from database for task:', savedTaskId)
          fetch(`/api/generations?taskId=${savedTaskId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                const gen = data.data
                const images = gen.output_image_urls || []
                if (images.length > 0) {
                  console.log('[GroupShoot] Recovered', images.length, 'images from database')
                  setGeneratedImages(images)
                } else {
                  console.log('[GroupShoot] No images found in database, returning to main')
                  setMode('main')
                  sessionStorage.removeItem('groupTaskId')
                }
              } else {
                console.log('[GroupShoot] Task not found in database, returning to main')
                setMode('main')
                sessionStorage.removeItem('groupTaskId')
              }
            })
            .catch(err => {
              console.error('[GroupShoot] Failed to recover images:', err)
              setMode('main')
              sessionStorage.removeItem('groupTaskId')
            })
        }
      }
    }
  }, [searchParams, tasks.length])

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setSelectedImage(base64)
    }
    e.target.value = ''
  }

  // 从成片选择 - 根据类型自动设置模式
  const handleSelectFromGallery = async (imageUrl: string, genType?: string) => {
    setShowGalleryPicker(false)
    // 直接使用 URL，后端会转换为 base64
    setSelectedImage(imageUrl)
    
    // 智能模式选择：根据来源图片的类型
    if (genType) {
      if (genType === 'pro_studio') {
        // 专业棚拍 → 棚拍模式
        setStyleMode('studio')
      } else if (genType === 'camera' || genType === 'camera_model') {
        // 买家秀 → 生活模式
        setStyleMode('lifestyle')
      }
    }
  }

  // 重新选择
  const handleReselect = () => {
    setSelectedImage(null)
    setGeneratedImages([])
    setMode("main")
  }

  // 开始生成
  const handleStartGeneration = async () => {
    if (!selectedImage) return

    const numImages = GROUP_NUM_IMAGES  // 固定4张图
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return

    triggerFlyToGallery()
    setMode("processing")

    // 创建任务
    const taskId = addTask('group_shoot', selectedImage, { shootMode, styleMode }, numImages)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, numImages)
    
    // 保存 taskId 到 sessionStorage（刷新后可恢复）
    sessionStorage.setItem('groupTaskId', taskId)
    
    // 更新 URL（便于刷新后恢复状态）
    router.replace('/camera/group?mode=processing')
    
    // 后台调用 quota/reserve 创建 pending 记录
    fetch('/api/quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        imageCount: numImages,
        taskType: 'group_shoot',
      }),
    }).then(() => {
      console.log('[GroupShoot] Reserved', numImages, 'images for task', taskId)
      refreshQuota()
    }).catch(e => {
      console.warn('[GroupShoot] Failed to reserve quota:', e)
    })

    // 不压缩，直接使用原图
    const compressedImage = selectedImage

    try {
      const response = await fetch('/api/generate-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startImage: compressedImage,
          mode: shootMode,
          styleMode: styleMode,
          taskId,
        }),
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      const results: string[] = []
      let firstCompleted = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'progress') {
                updateImageSlot(taskId, data.index, { status: 'generating' })
              } else if (data.type === 'image') {
                updateImageSlot(taskId, data.index, {
                  status: 'completed',
                  imageUrl: data.image,
                  modelType: data.modelType,
                  genMode: 'simple',
                })
                results[data.index] = data.image
                setGeneratedImages([...results])

                if (!firstCompleted) {
                  firstCompleted = true
                  setMode("results")
                  // 更新 URL 为 results 模式
                  router.replace('/camera/group?mode=results')
                }
              } else if (data.type === 'error') {
                updateImageSlot(taskId, data.index, {
                  status: 'failed',
                  error: data.error || '生成失败',
                })
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }

      // 统计成功数量并处理退款
      const currentTask = tasks.find(t => t.id === taskId)
      const successCount = currentTask?.imageSlots?.filter(s => s.status === 'completed').length || 0
      const failedCount = numImages - successCount

      if (failedCount > 0 && successCount > 0) {
        // 部分失败，退还失败数量
        console.log('[GroupShoot] Refunding', failedCount, 'failed images')
        try {
          await fetch('/api/quota/reserve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              actualImageCount: successCount,
              refundCount: failedCount,
            }),
          })
        } catch (e) {
          console.warn('[GroupShoot] Failed to refund:', e)
        }
      } else if (successCount === 0) {
        // 全部失败，全额退还
        console.log('[GroupShoot] All failed, refunding all', numImages, 'images')
        try {
          await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        } catch (e) {
          console.warn('[GroupShoot] Failed to refund on total failure:', e)
        }
      }

      updateTaskStatus(taskId, 'completed')
      // 清理 sessionStorage
      sessionStorage.removeItem('groupTaskId')
    } catch (error: any) {
      console.error('Generation error:', error)
      for (let i = 0; i < numImages; i++) {
        const task = tasks.find(t => t.id === taskId)
        const slot = task?.imageSlots?.[i]
        if (!slot || slot.status === 'pending' || slot.status === 'generating') {
          updateImageSlot(taskId, i, {
            status: 'failed',
            error: error.message || '网络错误',
          })
        }
      }
      updateTaskStatus(taskId, 'failed')

      // 异常情况，全额退还配额
      console.log('[GroupShoot] Error occurred, refunding reserved quota')
      try {
        await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
        refreshQuota()
      } catch (e) {
        console.warn('[GroupShoot] Failed to refund on error:', e)
      }

      // 清理 sessionStorage
      sessionStorage.removeItem('groupTaskId')
    }
  }

  // 获取模特分类的图库图片（买家秀+专业棚拍+组图）
  // 类型判断函数已从 @/lib/taskTypes 导入
  const modelGenerations = (generations || [])
    .filter(g => {
      if (!g) return false
      // 确保 outputImageUrls 是有效数组且有有效的 URL
      if (!Array.isArray(g.outputImageUrls)) return false
      const hasValidUrls = g.outputImageUrls.some(url => typeof url === 'string' && url.length > 0)
      if (!hasValidUrls) return false
      
      // 只显示模特相关的分类: 买家秀 + 专业棚拍 + 组图
      return isModelRelatedType(g.type)
    })
    .slice(0, 50) // 增加到50个

  // 从 sessionStorage 加载传入的图片
  useEffect(() => {
    const storedImage = sessionStorage.getItem('groupShootImage')
    if (storedImage) {
      sessionStorage.removeItem('groupShootImage')
      setSelectedImage(storedImage)
    }
  }, [])

  const numImages = GROUP_NUM_IMAGES  // 固定4张图

  return (
    <div className="h-full relative flex flex-col bg-zinc-50">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      <AnimatePresence mode="wait">
        {/* Main Page - 图片选择 + 模式选择 在同一页面 */}
        {mode === "main" && (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Header */}
            {isDesktop ? (
              <div className="bg-white border-b border-zinc-200">
                <div className="max-w-4xl mx-auto px-8 py-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => router.push("/")}
                      className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <Home className="w-5 h-5 text-zinc-600" />
                    </button>
                    <span className="font-semibold text-lg text-zinc-900">{t.home.groupShoot || '组图拍摄'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
                <button
                  onClick={() => router.push("/")}
                  className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <Home className="w-5 h-5 text-zinc-600" />
                </button>
                <span className="font-semibold text-lg ml-2">{t.home.groupShoot || '组图拍摄'}</span>
              </div>
            )}

            {isDesktop ? (
              /* PC 端双栏布局 */
              <div className="flex-1 overflow-y-auto bg-zinc-50 py-8">
                <div className="max-w-5xl mx-auto px-8">
                  <div className="flex gap-8">
                    {/* 左栏：图片上传 */}
                    <div className="w-[380px] shrink-0">
                      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                        <h3 className="font-semibold text-zinc-900 mb-4">{t.groupShootPage?.uploadImage || '上传图片'}</h3>
                        
                        {!selectedImage ? (
                          <div className="space-y-3">
                            {/* 上传按钮 */}
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 transition-colors"
                            >
                              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-blue-600" />
                              </div>
                              <span className="text-sm font-medium text-zinc-700">{t.groupShootPage?.fromAlbum || '从相册选择'}</span>
                              <span className="text-xs text-zinc-400">{t.common.clickToUploadOrDrag || '点击上传或拖拽图片'}</span>
                            </button>
                            
                            {/* 分隔符 */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-zinc-200"></div>
                              <span className="text-zinc-400 text-xs">{t.common.or || '或'}</span>
                              <div className="flex-1 h-px bg-zinc-200"></div>
                            </div>
                            
                            {/* 从成片选择 */}
                            <button
                              onClick={() => setShowGalleryPicker(true)}
                              className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                              {t.groupShootPage?.selectFromPhotos || '从成片选择'}
                            </button>
                          </div>
                        ) : (
                          /* 已选图片预览 */
                          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                            <Image src={selectedImage} alt="Selected" fill className="object-cover" />
                            <button
                              onClick={() => setSelectedImage(null)}
                              className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                            <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-green-500 rounded-full flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span className="text-white text-xs font-medium">{t.groupShootPage?.imageSelected || '已选择'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 右栏：风格选择 */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                        <h3 className="font-semibold text-zinc-900 mb-4">{t.groupShootPage?.selectStyle || '选择风格'}</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* 生活风格 */}
                          <button
                            onClick={() => setStyleMode('lifestyle')}
                            className={`rounded-xl overflow-hidden transition-all ${
                              styleMode === 'lifestyle'
                                ? 'ring-2 ring-blue-500 ring-offset-2'
                                : 'ring-1 ring-zinc-200 hover:ring-zinc-300'
                            }`}
                          >
                            <div className="aspect-[4/3] relative">
                              <Image src="/group-lifestyle-style.png" alt="Lifestyle" fill className="object-cover" />
                              {styleMode === 'lifestyle' && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="p-3 bg-white">
                              <div className="flex items-center gap-2">
                                <Users className={`w-4 h-4 ${styleMode === 'lifestyle' ? 'text-blue-600' : 'text-zinc-400'}`} />
                                <span className={`font-medium text-sm ${styleMode === 'lifestyle' ? 'text-blue-900' : 'text-zinc-700'}`}>
                                  {t.groupShootPage?.lifestyleMode || 'Lifestyle'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">{t.groupShootPage?.lifestyleDesc || 'ins风格生活照'}</p>
                            </div>
                          </button>
                          
                          {/* 棚拍风格 */}
                          <button
                            onClick={() => setStyleMode('studio')}
                            className={`rounded-xl overflow-hidden transition-all ${
                              styleMode === 'studio'
                                ? 'ring-2 ring-amber-500 ring-offset-2'
                                : 'ring-1 ring-zinc-200 hover:ring-zinc-300'
                            }`}
                          >
                            <div className="aspect-[4/3] relative">
                              <Image src="/group-studio-style.png" alt="Studio" fill className="object-cover" />
                              {styleMode === 'studio' && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="p-3 bg-white">
                              <div className="flex items-center gap-2">
                                <Sparkles className={`w-4 h-4 ${styleMode === 'studio' ? 'text-amber-600' : 'text-zinc-400'}`} />
                                <span className={`font-medium text-sm ${styleMode === 'studio' ? 'text-amber-900' : 'text-zinc-700'}`}>
                                  {t.groupShootPage?.studioMode || 'Studio'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">{t.groupShootPage?.studioDesc || '专业影棚pose'}</p>
                            </div>
                          </button>
                        </div>
                        
                        {/* 生成按钮 */}
                        <div className="mt-6 pt-6 border-t border-zinc-100">
                          <button
                            onClick={handleStartGeneration}
                            disabled={!selectedImage}
                            className={`w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                              selectedImage
                                ? styleMode === 'lifestyle'
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles className="w-5 h-5" />
                            <span>{t.camera.startShoot} ({numImages})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 移动端布局 */
              <div className="flex-1 overflow-y-auto bg-zinc-50 pb-32">
                {/* 图片上传区域 - 紧凑布局 */}
                <div className="p-4 space-y-2">
                  {!selectedImage ? (
                    <>
                      {/* 选择提示标题 */}
                      <p className="text-center text-zinc-500 text-xs">{t.groupShootPage?.chooseOneMethod || '选择一种方式添加图片'}</p>
                      
                      {/* 上传图片卡片 - 紧凑版 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 transition-all shadow-md shadow-blue-200 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-semibold">{t.groupShootPage?.uploadImage || '上传图片'}</p>
                            <p className="text-white/70 text-xs">{t.groupShootPage?.fromAlbum || '从相册选择'}</p>
                          </div>
                        </div>
                      </button>
                      
                      {/* "或" 分隔符 */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-zinc-200"></div>
                        <span className="text-zinc-400 text-xs">{t.common.or || '或'}</span>
                        <div className="flex-1 h-px bg-zinc-200"></div>
                      </div>
                      
                      {/* 从成片选择卡片 - 紧凑版 */}
                      <button
                        onClick={() => setShowGalleryPicker(true)}
                        className="w-full p-3 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-500 hover:to-cyan-600 transition-all shadow-md shadow-cyan-200 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-semibold">{t.groupShootPage?.selectFromPhotos || '从成片选择'}</p>
                            <p className="text-white/70 text-xs">{t.groupShootPage?.modelCategory || '模特分类'}</p>
                          </div>
                        </div>
                      </button>
                    </>
                  ) : (
                    /* 已选图片预览 */
                    <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-200">
                      <div className="flex items-center gap-4">
                        <div className="relative w-20 h-24 shrink-0">
                          <div className="w-full h-full rounded-xl overflow-hidden ring-2 ring-white/50">
                            <Image src={selectedImage} alt="Selected" fill className="object-cover" />
                          </div>
                          <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full">
                            <Check className="w-4 h-4 text-white" />
                            <span className="text-white font-medium text-sm">{t.groupShootPage?.imageSelected || '图片已选择'}</span>
                          </div>
                          <p className="text-white/70 text-xs mt-2">{t.groupShootPage?.clickToReselect || '点击 × 重新选择'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 风格选择 - 紧凑卡片 */}
                <div className="px-4 pb-2">
                  <div className="flex gap-2">
                    {/* 生活风格卡片 */}
                    <button
                      onClick={() => setStyleMode('lifestyle')}
                      className={`flex-1 rounded-xl overflow-hidden transition-all duration-200 ${
                        styleMode === 'lifestyle' 
                          ? 'ring-3 ring-blue-500 shadow-lg shadow-blue-500/20 scale-[1.01]' 
                          : 'ring-1 ring-zinc-200 opacity-50 hover:opacity-70'
                      }`}
                    >
                      <div className={`p-2.5 transition-colors ${styleMode === 'lifestyle' ? 'bg-gradient-to-b from-blue-100 to-blue-50' : 'bg-gradient-to-b from-zinc-100 to-white'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Users className={`w-4 h-4 ${styleMode === 'lifestyle' ? 'text-blue-600' : 'text-zinc-400'}`} />
                          <span className={`font-bold text-sm ${styleMode === 'lifestyle' ? 'text-blue-900' : 'text-zinc-500'}`}>
                            {t.groupShootPage?.lifestyleMode || '生活风格'}
                          </span>
                          {styleMode === 'lifestyle' && (
                            <span className="ml-auto bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">✓</span>
                          )}
                        </div>
                        <p className={`text-[10px] leading-tight ${styleMode === 'lifestyle' ? 'text-blue-600' : 'text-zinc-400'}`}>{t.groupShootPage?.lifestyleDesc || 'ins风格生活照'}</p>
                      </div>
                      <div className="aspect-[5/4] relative">
                        <Image 
                          src="/group-lifestyle-style.png" 
                          alt="Lifestyle" 
                          fill 
                          className="object-cover"
                        />
                      </div>
                    </button>
                    
                    {/* 棚拍风格卡片 */}
                    <button
                      onClick={() => setStyleMode('studio')}
                      className={`flex-1 rounded-xl overflow-hidden transition-all duration-200 ${
                        styleMode === 'studio' 
                          ? 'ring-3 ring-amber-500 shadow-lg shadow-amber-500/20 scale-[1.01]' 
                          : 'ring-1 ring-zinc-200 opacity-50 hover:opacity-70'
                      }`}
                    >
                      <div className={`p-2.5 transition-colors ${styleMode === 'studio' ? 'bg-gradient-to-b from-amber-100 to-amber-50' : 'bg-gradient-to-b from-zinc-100 to-white'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className={`w-4 h-4 ${styleMode === 'studio' ? 'text-amber-600' : 'text-zinc-400'}`} />
                          <span className={`font-bold text-sm ${styleMode === 'studio' ? 'text-amber-900' : 'text-zinc-500'}`}>
                            {t.groupShootPage?.studioMode || '棚拍风格'}
                          </span>
                          {styleMode === 'studio' && (
                            <span className="ml-auto bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">✓</span>
                          )}
                        </div>
                        <p className={`text-[10px] leading-tight ${styleMode === 'studio' ? 'text-amber-600' : 'text-zinc-400'}`}>{t.groupShootPage?.studioDesc || '专业影棚pose'}</p>
                      </div>
                      <div className="aspect-[5/4] relative bg-zinc-100">
                        <Image 
                          src="/group-studio-style.png" 
                          alt="Studio" 
                          fill 
                          className="object-cover"
                        />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile: Bottom Button */}
            {!isDesktop && (
              <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent max-w-md mx-auto z-40">
                <button
                  onClick={handleStartGeneration}
                  disabled={!selectedImage}
                  className={`w-full h-14 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                    selectedImage 
                      ? 'bg-white hover:bg-zinc-50 text-zinc-900 shadow-lg border border-zinc-200 active:scale-[0.98]'
                      : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${selectedImage ? 'text-amber-500' : ''}`} />
                  <span>{t.camera.startShoot} ({numImages})</span>
                </button>
              </div>
            )}

            {!isDesktop && <BottomNav forceShow />}
          </motion.div>
        )}

        {/* Processing Mode */}
        {mode === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
              isDesktop ? 'bg-zinc-50' : 'bg-zinc-950'
            }`}
          >
            <div className="relative mb-6">
              <div className={`absolute inset-0 blur-xl rounded-full animate-pulse ${
                styleMode === 'lifestyle' 
                  ? (isDesktop ? 'bg-blue-500/30' : 'bg-blue-500/20')
                  : (isDesktop ? 'bg-amber-500/30' : 'bg-amber-500/20')
              }`} />
              <Loader2 className={`w-16 h-16 animate-spin relative z-10 ${
                styleMode === 'lifestyle' 
                  ? (isDesktop ? 'text-blue-600' : 'text-blue-500')
                  : (isDesktop ? 'text-amber-600' : 'text-amber-500')
              }`} />
            </div>
            
            <h3 className={`text-2xl font-bold mb-2 ${isDesktop ? 'text-zinc-900' : 'text-white'}`}>
              {styleMode === 'lifestyle' 
                ? (t.groupShootPage?.creatingLifestyle || 'AI 正在创作ins风格组图...')
                : (t.groupShootPage?.creatingStudio || 'AI 正在创作专业展示图...')}
            </h3>
            <div className={`space-y-1 text-sm mb-8 ${isDesktop ? 'text-zinc-500' : 'text-zinc-400'}`}>
              <p>分析图片特征</p>
              <p>设计{styleMode === 'lifestyle' ? '生活化' : '电商展示'}pose</p>
              <p>生成{numImages}张多样化图片...</p>
            </div>
            
            {/* Progress dots */}
            <div className="flex gap-2">
              {Array.from({ length: numImages }).map((_, i) => {
                const task = tasks.find(t => t.id === currentTaskId)
                const slot = task?.imageSlots?.[i]
                const status = slot?.status || 'pending'
                return (
                  <div 
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'generating' ? `${styleMode === 'lifestyle' ? 'bg-blue-500' : 'bg-amber-500'} animate-pulse` :
                      status === 'failed' ? 'bg-red-500' :
                      isDesktop ? 'bg-zinc-300' : 'bg-zinc-600'
                    }`}
                  />
                )
              })}
            </div>
            
            {/* PC: Action buttons */}
            {isDesktop && (
              <div className="mt-8 space-y-3 w-full max-w-xs">
                <p className="text-zinc-400 text-xs mb-4">生成将在后台继续，您可以：</p>
                <button
                  onClick={handleReselect}
                  className={`w-full h-12 rounded-full font-medium flex items-center justify-center gap-2 transition-colors ${
                    styleMode === 'lifestyle' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  选择新图片
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="w-full h-12 rounded-full bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200 font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Home className="w-5 h-5" />
                  返回首页
                </button>
              </div>
            )}
            
            {!isDesktop && <BottomNav forceShow />}
          </motion.div>
        )}

        {/* Results Mode */}
        {mode === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 flex flex-col bg-zinc-50 overflow-hidden"
          >
            {/* Header */}
            {isDesktop ? (
              <div className="bg-white border-b border-zinc-200">
                <div className="max-w-4xl mx-auto px-8 py-4">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={handleReselect} 
                      className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span className="font-medium">返回</span>
                    </button>
                    <span className="font-semibold text-zinc-900">
                      {styleMode === 'lifestyle' ? (t.groupShootPage?.lifestyleMode || '生活风格') : (t.groupShootPage?.studioMode || '棚拍风格')}
                    </span>
                    <div className="w-20" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-14 flex items-center px-4 border-b bg-white z-10 shrink-0">
                <button 
                  onClick={handleReselect} 
                  className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold ml-2">
                  {styleMode === 'lifestyle' ? (t.groupShootPage?.lifestyleMode || '生活风格') : (t.groupShootPage?.studioMode || '棚拍风格')}
                </span>
              </div>
            )}

            <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-32'}`}>
              <div className={`${isDesktop ? 'max-w-4xl mx-auto px-8' : ''}`}>
                <div className={`grid gap-3 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {Array.from({ length: numImages }).map((_, i) => {
                    const task = tasks.find(t => t.id === currentTaskId)
                    const slot = task?.imageSlots?.[i]
                    const url = slot?.imageUrl || generatedImages[i]
                    const status = slot?.status || (url ? 'completed' : 'pending')
                    
                    const labels = [`Pose ${i + 1}`]
                    
                    if (status === 'pending' || status === 'generating') {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-100 rounded-xl flex flex-col items-center justify-center border border-zinc-200">
                          <Loader2 className={`w-6 h-6 animate-spin mb-2 ${
                            styleMode === 'lifestyle' ? 'text-blue-400' : 'text-amber-400'
                          }`} />
                          <span className="text-[10px] text-zinc-400">{labels[i] || `图${i+1}`} 生成中...</span>
                        </div>
                      )
                    }
                    
                    if (status === 'failed' || !url) {
                      return (
                        <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-xs">
                          {slot?.error || '生成失败'}
                        </div>
                      )
                    }
                    
                    return (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] bg-zinc-100 rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer"
                        onClick={() => setFullscreenImage(url)}
                      >
                        <Image src={url} alt="Result" fill className="object-cover" />
                        <div className="absolute top-2 left-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white ${
                            styleMode === 'lifestyle' ? 'bg-blue-500' : 'bg-amber-500'
                          }`}>
                            {labels[i] || `图${i+1}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* PC: Centered button */}
                {isDesktop && (
                  <div className="flex justify-center mt-8">
                    <button 
                      onClick={handleReselect}
                      className={`px-8 h-12 text-lg rounded-xl font-semibold transition-colors ${
                        styleMode === 'lifestyle' 
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                      }`}
                    >
                      拍摄下一组
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Debug Parameters - 只在调试模式显示 */}
            {debugMode && (
              <div className="mx-4 mb-4 p-4 bg-white rounded-xl border border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">生成参数 (调试模式)</h3>
                <div className="flex items-start gap-4">
                  {/* 输入图 */}
                  {selectedImage && (
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 cursor-pointer relative group"
                        onClick={() => setFullscreenImage(selectedImage)}
                      >
                        <img 
                          src={selectedImage} 
                          alt="输入图" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">输入图</p>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600 mt-0.5">
                        模特成片
                      </span>
                    </div>
                  )}
                  
                  {/* 模式信息 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">{t.groupShootPage?.styleMode || '风格模式'}:</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        styleMode === 'lifestyle'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {styleMode === 'lifestyle' ? (t.groupShootPage?.lifestyleMode || '生活风格') : (t.groupShootPage?.studioMode || '棚拍风格')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">拍摄模式:</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">
                        {t.groupShootPage?.randomShoot || '随意拍'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">生成数量:</span>
                      <span className="text-[10px] font-medium text-zinc-700">{numImages} 张</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">输入来源:</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-cyan-100 text-cyan-700">
                        从成片选择
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Mobile: Bottom button */}
            {!isDesktop && (
              <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t max-w-md mx-auto">
                <button 
                  onClick={handleReselect}
                  className={`w-full h-12 text-lg rounded-xl font-semibold transition-colors ${
                    styleMode === 'lifestyle' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                  }`}
                >
                  拍摄下一组
                </button>
              </div>
            )}
            
            {!isDesktop && <BottomNav forceShow />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Picker Modal - 只显示模特分类的成片 */}
      <AnimatePresence>
        {showGalleryPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowGalleryPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{t.groupShootPage?.selectFromPhotos || '从成片选择'}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{t.groupShootPage?.modelCategory || '选择模特成片'}</p>
                  </div>
                  <button onClick={() => setShowGalleryPicker(false)}>
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
                
                {/* 子分类 Tabs */}
                <div className="flex gap-2">
                  {[
                    { id: 'all', label: t.groupShootPage?.all || '全部' },
                    { id: 'buyer', label: t.groupShootPage?.buyerShow || '买家秀' },
                    { id: 'pro', label: t.groupShootPage?.proStudio || '专业棚拍' },
                    { id: 'group', label: t.groupShootPage?.groupPhoto || '组图' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setGallerySubType(tab.id as typeof gallerySubType)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        gallerySubType === tab.id
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  // 根据子分类过滤（与成片页面 API 逻辑保持一致）
                  const filteredGenerations = modelGenerations.filter(gen => {
                    if (gallerySubType === 'all') return true
                    if (gallerySubType === 'buyer') return isBuyerShowType(gen.type) // 买家秀
                    if (gallerySubType === 'pro') return isProStudioType(gen.type) // 专业棚拍
                    if (gallerySubType === 'group') return isGroupShootType(gen.type) // 组图
                    return true
                  })
                  
                  // 检查是否有数据在加载
                  const isLoading = !generations || generations.length === 0
                  
                  if (isLoading) {
                    return (
                      <div className="h-40 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-sm text-zinc-400">加载成片中...</p>
                      </div>
                    )
                  }
                  
                  if (filteredGenerations.length === 0) {
                    const subTypeLabel = gallerySubType === 'buyer' 
                      ? (t.groupShootPage?.buyerShow || '买家秀')
                      : gallerySubType === 'pro' 
                        ? (t.groupShootPage?.proStudio || '专业棚拍')
                        : gallerySubType === 'group' 
                          ? (t.groupShootPage?.groupPhoto || '组图')
                          : ''
                    return (
                      <div className="h-40 flex flex-col items-center justify-center text-zinc-400 text-sm gap-2">
                        <p>{t.groupShootPage?.noPhotos || '暂无成片'}{subTypeLabel && ` (${subTypeLabel})`}</p>
                        <p className="text-xs">{t.groupShootPage?.goShootFirst || '先去拍摄一些照片吧'}</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredGenerations.flatMap((gen, gi) => 
                        (gen.outputImageUrls || [])
                          .filter((url): url is string => typeof url === 'string' && url.length > 0)
                          .map((url, ui) => (
                            <button
                              key={`${gen.id || gi}-${ui}`}
                              onClick={() => handleSelectFromGallery(url, gen.type)}
                              className="aspect-square rounded-lg overflow-hidden relative hover:ring-2 hover:ring-blue-500 transition-all"
                            >
                              <Image src={url} alt="" fill className="object-cover" />
                              {/* 类型标签 */}
                              <div className="absolute bottom-1 left-1">
                                <span className={`px-1 py-0.5 rounded text-[8px] font-medium text-white ${
                                  isProStudioType(gen.type)
                                    ? 'bg-amber-500' 
                                    : isGroupShootType(gen.type)
                                      ? 'bg-cyan-500'
                                      : 'bg-blue-500'
                                }`}>
                                  {isProStudioType(gen.type) ? (t.groupShootPage?.proStudio || '棚拍') : isGroupShootType(gen.type) ? (t.groupShootPage?.groupPhoto || '组图') : (t.groupShootPage?.buyerShow || '买家秀')}
                                </span>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <QuotaExceededModal
        isOpen={showExceededModal}
        onClose={closeExceededModal}
        requiredCount={requiredCount}
        usedCount={quota?.usedCount || 0}
        totalQuota={quota?.totalQuota || 0}
      />
    </div>
  )
}

// 导出组件，包裹 Suspense 以支持 useSearchParams
export default function GroupShootPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
      <GroupShootPageContent />
    </Suspense>
  )
}
