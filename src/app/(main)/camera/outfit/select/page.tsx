"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, Aperture, Users, Check, ChevronRight,
  Loader2, Shuffle, X, ZoomIn
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useLanguageStore } from "@/stores/languageStore"
import { usePresetStore } from "@/stores/presetStore"
import { useAssetStore } from "@/stores/assetStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { useQuota } from "@/hooks/useQuota"
import { QuotaExceededModal } from "@/components/shared/QuotaExceededModal"
import { triggerFlyToGallery } from "@/components/shared/FlyToGallery"
import { ProductCategory, OutfitItem } from "@/types/outfit"

type ShootMode = "pro_studio" | "buyer_show"

export default function OutfitSelectPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  const { user } = useAuth()
  const { checkQuota, showExceededModal, closeExceededModal } = useQuota()
  const presetStore = usePresetStore()
  const { userModels, userBackgrounds } = useAssetStore()
  const { addTask, updateTaskStatus, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  
  // 状态
  const [shootMode, setShootMode] = useState<ShootMode | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null)
  const [useRandomModel, setUseRandomModel] = useState(true)
  const [useRandomBg, setUseRandomBg] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [outfitData, setOutfitData] = useState<Record<ProductCategory, OutfitItem>>({} as any)
  
  // 加载预设资源
  useEffect(() => {
    presetStore.loadPresets()
  }, [])
  
  // 从 sessionStorage 读取搭配数据
  useEffect(() => {
    const dataStr = sessionStorage.getItem('outfitData')
    if (dataStr) {
      try {
        setOutfitData(JSON.parse(dataStr))
      } catch (e) {
        console.error('Failed to parse outfit data:', e)
        router.push('/camera/outfit')
      }
    } else {
      // 没有数据，返回上一步
      router.push('/camera/outfit')
    }
  }, [router])
  
  // 获取可用的模特和背景列表
  const availableModels = shootMode === 'pro_studio' 
    ? presetStore.studioModels 
    : [...presetStore.visibleModels, ...userModels.filter(m => m.type === 'model')]
  
  const availableBackgrounds = shootMode === 'pro_studio'
    ? presetStore.getAllStudioBackgrounds()
    : [...presetStore.visibleBackgrounds, ...userBackgrounds.filter(b => b.type === 'background')]
  
  // 开始生成
  const handleGenerate = async () => {
    if (!shootMode || !user) return
    
    // 检查配额
    const numImages = shootMode === 'pro_studio' ? 6 : 6
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return
    
    setIsGenerating(true)
    
    try {
      // 获取模特和背景
      let modelImage = selectedModel
      let bgImage = selectedBackground
      let modelIsRandom = useRandomModel
      let bgIsRandom = useRandomBg
      
      if (useRandomModel) {
        const randomModel = shootMode === 'pro_studio' 
          ? presetStore.getRandomStudioModel()
          : presetStore.getRandomModel()
        modelImage = randomModel?.imageUrl || null
      }
      
      if (useRandomBg) {
        const randomBg = shootMode === 'pro_studio'
          ? presetStore.getRandomStudioBackground()
          : presetStore.getRandomBackground()
        bgImage = randomBg?.imageUrl || null
      }
      
      // 获取所有商品图片
      const productImages = Object.entries(outfitData).map(([category, item]) => ({
        category,
        imageUrl: item.imageUrl,
        material: item.material,
        fit: item.fit
      }))
      
      // 创建任务
      const taskType = shootMode === 'pro_studio' ? 'pro_studio' : 'camera'
      
      // 添加任务 - addTask 返回 taskId
      const taskId = addTask(
        taskType,
        productImages[0]?.imageUrl || '[products]',
        {
          modelImage: modelImage || undefined,
          backgroundImage: bgImage || undefined,
          modelIsUserSelected: !modelIsRandom,
          bgIsUserSelected: !bgIsRandom,
        },
        numImages
      )
      
      // 初始化图片槽位
      initImageSlots(taskId, numImages)
      
      // 更新任务状态为生成中
      updateTaskStatus(taskId, 'generating')
      
      // 触发飞到图库动画
      triggerFlyToGallery()
      
      // 跳转到图库
      router.push('/gallery')
      
      // 后台开始生成
      generateImages(taskId, productImages, modelImage, bgImage, shootMode, modelIsRandom, bgIsRandom, numImages)
      
    } catch (error) {
      console.error('Generation failed:', error)
      setIsGenerating(false)
    }
  }
  
  // 生成图片（后台执行）
  const generateImages = async (
    taskId: string,
    products: Array<{ category: string; imageUrl: string; material?: string; fit?: string }>,
    modelImage: string | null,
    bgImage: string | null,
    mode: ShootMode,
    modelIsRandom: boolean,
    bgIsRandom: boolean,
    numImages: number
  ) => {
    const apiEndpoint = mode === 'pro_studio' ? '/api/generate-pro-studio' : '/api/generate-model'
    
    // 使用第一个商品作为主商品
    const mainProduct = products[0]
    
    for (let i = 0; i < numImages; i++) {
      try {
        updateImageSlot(taskId, i, { status: 'generating' })
        
        const genMode = i < 3 ? 'simple' : 'extended'
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImage: mainProduct.imageUrl,
            modelImage,
            backgroundImage: bgImage,
            mode: genMode,
            index: i,
            taskId,
            modelIsRandom,
            bgIsRandom,
            // 额外传递搭配信息
            outfitProducts: products
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          updateImageSlot(taskId, i, {
            status: 'completed',
            imageUrl: result.imageUrl,
            modelType: result.modelType,
            genMode
          })
        } else {
          updateImageSlot(taskId, i, {
            status: 'failed',
            error: result.error || 'Generation failed'
          })
        }
      } catch (error: any) {
        updateImageSlot(taskId, i, {
          status: 'failed',
          error: error.message || 'Network error'
        })
      }
    }
    
    updateTaskStatus(taskId, 'completed')
  }
  
  // 已选商品数量
  const productCount = Object.keys(outfitData).length
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-medium">{t.outfitSelect?.title || '选择风格'}</span>
          <div className="w-10" />
        </div>
      </div>
      
      {/* 已选商品预览 */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {Object.entries(outfitData).map(([category, item]) => (
            <div key={category} className="flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-zinc-800 relative">
              <Image src={item.imageUrl} alt={category} fill className="object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-1">
                <p className="text-white text-[8px] truncate text-center">{category}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-xs mt-2">
          {t.outfitSelect?.selectedItems || '已选择'} {productCount} {t.outfitSelect?.items || '件商品'}
        </p>
      </div>
      
      {/* 风格选择 */}
      <div className="px-4 py-4">
        <h3 className="text-white font-medium mb-3">{t.outfitSelect?.selectStyle || '选择拍摄风格'}</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 专业棚拍 */}
          <motion.button
            onClick={() => setShootMode('pro_studio')}
            className={`relative p-4 rounded-2xl border-2 transition-all ${
              shootMode === 'pro_studio'
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {shootMode === 'pro_studio' && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <Aperture className={`w-10 h-10 mb-2 ${shootMode === 'pro_studio' ? 'text-amber-500' : 'text-zinc-400'}`} />
            <p className={`font-medium ${shootMode === 'pro_studio' ? 'text-amber-500' : 'text-white'}`}>
              {t.outfitSelect?.proStudio || '专业棚拍'}
            </p>
            <p className="text-zinc-500 text-xs mt-1">{t.outfitSelect?.proStudioDesc || '高端影棚效果'}</p>
          </motion.button>
          
          {/* 买家秀 */}
          <motion.button
            onClick={() => setShootMode('buyer_show')}
            className={`relative p-4 rounded-2xl border-2 transition-all ${
              shootMode === 'buyer_show'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {shootMode === 'buyer_show' && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <Users className={`w-10 h-10 mb-2 ${shootMode === 'buyer_show' ? 'text-blue-500' : 'text-zinc-400'}`} />
            <p className={`font-medium ${shootMode === 'buyer_show' ? 'text-blue-500' : 'text-white'}`}>
              {t.outfitSelect?.buyerShow || '买家秀'}
            </p>
            <p className="text-zinc-500 text-xs mt-1">{t.outfitSelect?.buyerShowDesc || '真实场景效果'}</p>
          </motion.button>
        </div>
      </div>
      
      {/* 模特和背景选择 - 选择风格后显示 */}
      <AnimatePresence>
        {shootMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 py-4 space-y-4"
          >
            {/* 模特选择 */}
            <div className="bg-zinc-800/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">{t.outfitSelect?.selectModel || '选择模特'}</h4>
                <button
                  onClick={() => {
                    setUseRandomModel(!useRandomModel)
                    if (!useRandomModel) setSelectedModel(null)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    useRandomModel 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  {t.common?.random || '随机'}
                </button>
              </div>
              
              {!useRandomModel && (
                <button
                  onClick={() => setShowModelPicker(true)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  {selectedModel ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-600 relative">
                        <Image src={selectedModel} alt="Model" fill className="object-cover" />
                      </div>
                      <span className="text-white text-sm">{t.outfitSelect?.modelSelected || '已选择模特'}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-sm">{t.outfitSelect?.tapToSelectModel || '点击选择模特'}</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-zinc-500" />
                </button>
              )}
            </div>
            
            {/* 背景选择 */}
            <div className="bg-zinc-800/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">{t.outfitSelect?.selectBackground || '选择背景'}</h4>
                <button
                  onClick={() => {
                    setUseRandomBg(!useRandomBg)
                    if (!useRandomBg) setSelectedBackground(null)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    useRandomBg 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  {t.common?.random || '随机'}
                </button>
              </div>
              
              {!useRandomBg && (
                <button
                  onClick={() => setShowBgPicker(true)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  {selectedBackground ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-600 relative">
                        <Image src={selectedBackground} alt="Background" fill className="object-cover" />
                      </div>
                      <span className="text-white text-sm">{t.outfitSelect?.bgSelected || '已选择背景'}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-sm">{t.outfitSelect?.tapToSelectBg || '点击选择背景'}</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-zinc-500" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
        <button
          onClick={handleGenerate}
          disabled={!shootMode || isGenerating}
          className={`w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
            shootMode === 'pro_studio'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
              : shootMode === 'buyer_show'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                : 'bg-zinc-700 text-zinc-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t.outfitSelect?.generating || '生成中...'}</span>
            </>
          ) : (
            <span>{t.outfitSelect?.startGenerate || '开始生成'}</span>
          )}
        </button>
      </div>
      
      {/* 模特选择器 Modal */}
      <AnimatePresence>
        {showModelPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={() => setShowModelPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-white font-medium">{t.outfitSelect?.selectModel || '选择模特'}</span>
                <button onClick={() => setShowModelPicker(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
                <div className="grid grid-cols-3 gap-2">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.imageUrl)
                        setShowModelPicker(false)
                      }}
                      className={`aspect-[3/4] rounded-xl overflow-hidden relative ${
                        selectedModel === model.imageUrl ? 'ring-2 ring-amber-500' : ''
                      }`}
                    >
                      <Image src={model.imageUrl} alt="Model" fill className="object-cover" />
                      {selectedModel === model.imageUrl && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 背景选择器 Modal */}
      <AnimatePresence>
        {showBgPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={() => setShowBgPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-white font-medium">{t.outfitSelect?.selectBackground || '选择背景'}</span>
                <button onClick={() => setShowBgPicker(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
                <div className="grid grid-cols-3 gap-2">
                  {availableBackgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => {
                        setSelectedBackground(bg.imageUrl)
                        setShowBgPicker(false)
                      }}
                      className={`aspect-square rounded-xl overflow-hidden relative ${
                        selectedBackground === bg.imageUrl ? 'ring-2 ring-amber-500' : ''
                      }`}
                    >
                      <Image src={bg.imageUrl} alt="Background" fill className="object-cover" />
                      {selectedBackground === bg.imageUrl && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 配额不足弹窗 */}
      <QuotaExceededModal 
        isOpen={showExceededModal} 
        onClose={closeExceededModal} 
      />
    </div>
  )
}

