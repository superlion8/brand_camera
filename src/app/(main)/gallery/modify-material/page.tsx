"use client"

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, Check, ChevronDown, Sparkles, AlertCircle, Wand2, Home, X, Image as ImageIcon } from 'lucide-react'
import { useTranslation } from '@/stores/languageStore'
import { useQuota } from '@/hooks/useQuota'
import { useGenerationTaskStore } from '@/stores/generationTaskStore'

// 分析结果类型
interface AnalysisResult {
  index: number
  success: boolean
  imageUrl?: string
  data?: {
    product_category: string
    fit_attributes: {
      shape: string[]
      fit: string[]
      visual_fabric_vibe: string[]
    }
    material_attributes: {
      fiber_composition: string[]
      visual_luster: string[]
      weave_structure: string[]
    }
  }
  error?: string
}

// 商品编辑状态
interface ProductEditState {
  enabled: boolean
  category: string
  imageUrl: string
  // 版型属性
  shape: string
  shapeCustom: string
  fit: string
  fitCustom: string
  visual_fabric_vibe: string
  visual_fabric_vibeCustom: string
  // 材质属性
  fiber_composition: string
  fiber_compositionCustom: string
  visual_luster: string
  visual_lusterCustom: string
  weave_structure: string
  weave_structureCustom: string
  // 原始选项
  options: {
    shape: string[]
    fit: string[]
    visual_fabric_vibe: string[]
    fiber_composition: string[]
    visual_luster: string[]
    weave_structure: string[]
  }
}

// 下拉选择组件
function AttributeSelect({
  label,
  value,
  customValue,
  options,
  onChange,
  onCustomChange,
  disabled
}: {
  label: string
  value: string
  customValue: string
  options: string[]
  onChange: (v: string) => void
  onCustomChange: (v: string) => void
  disabled?: boolean
}) {
  const isCustom = value === 'custom'
  
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full h-9 px-3 pr-8 text-sm rounded-lg border appearance-none ${
            disabled 
              ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' 
              : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <option value="custom">✏️ 自定义</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      </div>
      {isCustom && !disabled && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="请输入..."
          className="w-full h-9 px-3 text-sm rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      )}
    </div>
  )
}

// 商品卡片组件
function ProductCard({
  state,
  onToggle,
  onUpdate
}: {
  state: ProductEditState
  onToggle: () => void
  onUpdate: (updates: Partial<ProductEditState>) => void
}) {
  const { t } = useTranslation()
  
  return (
    <div className={`rounded-xl border-2 transition-all ${
      state.enabled 
        ? 'border-blue-500 bg-blue-50/50' 
        : 'border-zinc-200 bg-white'
    }`}>
      {/* Header */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
          <Image
            src={state.imageUrl}
            alt={state.category}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-800">{state.category}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {state.enabled ? t.modifyMaterial?.modifyEnabled || '已启用修改' : t.modifyMaterial?.clickToEnable || '点击启用修改'}
          </p>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          state.enabled ? 'bg-blue-500' : 'bg-zinc-200'
        }`}>
          {state.enabled && <Check className="w-4 h-4 text-white" />}
        </div>
      </div>
      
      {/* Edit Options */}
      <AnimatePresence>
        {state.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* 版型属性 */}
              <div>
                <p className="text-xs font-semibold text-zinc-600 mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {t.modifyMaterial?.fitAttributes || '版型属性'}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <AttributeSelect
                    label={t.modifyMaterial?.shape || '整体廓形'}
                    value={state.shape}
                    customValue={state.shapeCustom}
                    options={state.options.shape}
                    onChange={(v) => onUpdate({ shape: v })}
                    onCustomChange={(v) => onUpdate({ shapeCustom: v })}
                  />
                  <AttributeSelect
                    label={t.modifyMaterial?.fit || '合身度'}
                    value={state.fit}
                    customValue={state.fitCustom}
                    options={state.options.fit}
                    onChange={(v) => onUpdate({ fit: v })}
                    onCustomChange={(v) => onUpdate({ fitCustom: v })}
                  />
                  <AttributeSelect
                    label={t.modifyMaterial?.visualFabricVibe || '视觉体感'}
                    value={state.visual_fabric_vibe}
                    customValue={state.visual_fabric_vibeCustom}
                    options={state.options.visual_fabric_vibe}
                    onChange={(v) => onUpdate({ visual_fabric_vibe: v })}
                    onCustomChange={(v) => onUpdate({ visual_fabric_vibeCustom: v })}
                  />
                </div>
              </div>
              
              {/* 材质属性 */}
              <div>
                <p className="text-xs font-semibold text-zinc-600 mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {t.modifyMaterial?.materialAttributes || '材质属性'}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <AttributeSelect
                    label={t.modifyMaterial?.fiberComposition || '材质成分'}
                    value={state.fiber_composition}
                    customValue={state.fiber_compositionCustom}
                    options={state.options.fiber_composition}
                    onChange={(v) => onUpdate({ fiber_composition: v })}
                    onCustomChange={(v) => onUpdate({ fiber_compositionCustom: v })}
                  />
                  <AttributeSelect
                    label={t.modifyMaterial?.visualLuster || '视觉光泽'}
                    value={state.visual_luster}
                    customValue={state.visual_lusterCustom}
                    options={state.options.visual_luster}
                    onChange={(v) => onUpdate({ visual_luster: v })}
                    onCustomChange={(v) => onUpdate({ visual_lusterCustom: v })}
                  />
                  <AttributeSelect
                    label={t.modifyMaterial?.weaveStructure || '工艺结构'}
                    value={state.weave_structure}
                    customValue={state.weave_structureCustom}
                    options={state.options.weave_structure}
                    onChange={(v) => onUpdate({ weave_structure: v })}
                    onCustomChange={(v) => onUpdate({ weave_structureCustom: v })}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ModifyMaterialContent() {
  const router = useRouter()
  const { t } = useTranslation()
  const { checkQuota, refreshQuota } = useQuota()
  const { addTask, updateTaskStatus, initImageSlots, updateImageSlot } = useGenerationTaskStore()
  
  const [phase, setPhase] = useState<'select' | 'loading' | 'analyzing' | 'editing' | 'generating' | 'result'>('select')
  const [outputImage, setOutputImage] = useState<string>('')
  const [inputImages, setInputImages] = useState<string[]>([])
  const [productStates, setProductStates] = useState<ProductEditState[]>([])
  const [resultImages, setResultImages] = useState<string[]>([]) // 改为数组，存储2张图
  const [generatingProgress, setGeneratingProgress] = useState<number>(0) // 生成进度
  const [error, setError] = useState<string>('')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  
  // 图片选择相关状态
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [galleryItems, setGalleryItems] = useState<any[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 用于追踪当前 phase 的 ref（避免闭包问题）
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  
  // 加载数据
  useEffect(() => {
    const output = sessionStorage.getItem('modifyMaterial_outputImage')
    const inputsStr = sessionStorage.getItem('modifyMaterial_inputImages')
    
    // 如果没有 sessionStorage 数据，显示选择界面
    if (!output) {
      setPhase('select')
      return
    }
    
    setOutputImage(output)
    setPhase('loading')
    
    let inputs: string[] = []
    if (inputsStr) {
      try {
        inputs = JSON.parse(inputsStr)
      } catch (e) {
        console.error('Failed to parse input images')
      }
    }
    setInputImages(inputs)
    
    // 清除 sessionStorage（避免刷新时重复使用）
    sessionStorage.removeItem('modifyMaterial_outputImage')
    sessionStorage.removeItem('modifyMaterial_inputImages')
    
    // 开始分析
    if (inputs.length > 0) {
      setPhase('analyzing')
      analyzeProducts(inputs)
    } else {
      setError(t.modifyMaterial?.noInputImages || '没有找到原始商品图片，请上传商品图')
      setPhase('editing')
    }
  }, [router, t])
  
  // 加载成片列表
  const loadGalleryItems = async () => {
    setIsLoadingGallery(true)
    try {
      const response = await fetch('/api/gallery?type=all&page=1')
      const data = await response.json()
      if (data.success) {
        setGalleryItems(data.data.items || [])
      }
    } catch (err) {
      console.error('Failed to load gallery:', err)
    } finally {
      setIsLoadingGallery(false)
    }
  }
  
  // 从成片选择图片
  const handleSelectFromGallery = (item: any) => {
    setShowGalleryPicker(false)
    setOutputImage(item.imageUrl)
    
    // 收集原始商品图
    const inputs: string[] = []
    if (item.generation?.params?.productImages?.length > 0) {
      inputs.push(...item.generation.params.productImages)
    } else if (item.generation?.inputImageUrl) {
      inputs.push(item.generation.inputImageUrl)
    }
    setInputImages(inputs)
    
    // 开始分析
    if (inputs.length > 0) {
      setPhase('analyzing')
      analyzeProducts(inputs)
    } else {
      setError(t.modifyMaterial?.noInputImages || '该图片没有关联的商品图，请手动上传')
      setPhase('editing')
    }
  }
  
  // 上传图片
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setOutputImage(base64)
      setInputImages([]) // 上传的图片没有关联的商品图
      setError(t.modifyMaterial?.noInputImages || '请上传原始商品图用于分析材质')
      setPhase('editing')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  
  // 分析商品
  const analyzeProducts = async (images: string[]) => {
    try {
      const response = await fetch('/api/analyze-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      })
      
      if (!response.ok) {
        throw new Error('分析失败')
      }
      
      const data = await response.json()
      
      if (!data.success || !data.results) {
        throw new Error(data.error || '分析失败')
      }
      
      // 转换分析结果为编辑状态
      const states: ProductEditState[] = data.results
        .filter((r: AnalysisResult) => r.success && r.data)
        .map((r: AnalysisResult) => ({
          enabled: false,
          category: r.data!.product_category,
          imageUrl: r.imageUrl || images[r.index],
          // 默认选择第一个选项
          shape: r.data!.fit_attributes.shape[0] || '',
          shapeCustom: '',
          fit: r.data!.fit_attributes.fit[0] || '',
          fitCustom: '',
          visual_fabric_vibe: r.data!.fit_attributes.visual_fabric_vibe[0] || '',
          visual_fabric_vibeCustom: '',
          fiber_composition: r.data!.material_attributes.fiber_composition[0] || '',
          fiber_compositionCustom: '',
          visual_luster: r.data!.material_attributes.visual_luster[0] || '',
          visual_lusterCustom: '',
          weave_structure: r.data!.material_attributes.weave_structure[0] || '',
          weave_structureCustom: '',
          options: {
            shape: r.data!.fit_attributes.shape,
            fit: r.data!.fit_attributes.fit,
            visual_fabric_vibe: r.data!.fit_attributes.visual_fabric_vibe,
            fiber_composition: r.data!.material_attributes.fiber_composition,
            visual_luster: r.data!.material_attributes.visual_luster,
            weave_structure: r.data!.material_attributes.weave_structure,
          }
        }))
      
      setProductStates(states)
      setPhase('editing')
      
    } catch (err: any) {
      console.error('Analysis error:', err)
      setError(err.message || '分析失败')
      setPhase('editing')
    }
  }
  
  // 获取属性值（处理自定义）
  const getValue = (state: ProductEditState, key: string): string => {
    const value = state[key as keyof ProductEditState] as string
    const customValue = state[`${key}Custom` as keyof ProductEditState] as string
    return value === 'custom' ? customValue : value
  }
  
  // 开始生成（生成2张图）
  const handleGenerate = async () => {
    const enabledStates = productStates.filter(s => s.enabled)
    
    if (enabledStates.length === 0) {
      setError(t.modifyMaterial?.selectAtLeastOne || '请至少选择一个商品进行修改')
      return
    }
    
    // 检查配额（2张图）
    const hasQuota = await checkQuota(2)
    if (!hasQuota) return
    
    // 构建请求数据
    const targets = enabledStates.map(state => ({
      category: state.category,
      params: {
        shape: getValue(state, 'shape'),
        fit: getValue(state, 'fit'),
        visual_fabric_vibe: getValue(state, 'visual_fabric_vibe'),
        fiber_composition: getValue(state, 'fiber_composition'),
        visual_luster: getValue(state, 'visual_luster'),
        weave_structure: getValue(state, 'weave_structure'),
      }
    }))
    
    // 创建任务（显示在 gallery loading 卡片）
    const taskId = addTask('edit', outputImage, { 
      type: 'modify_material',
      targets: targets.map(t => t.category).join(', ')
    }, 2)
    setCurrentTaskId(taskId)
    initImageSlots(taskId, 2)
    
    setPhase('generating')
    setError('')
    setGeneratingProgress(0)
    setResultImages([])
    
    // 在数据库中创建 pending 记录
    try {
      await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          imageCount: 2,
          taskType: 'modify_material',
        }),
      })
      console.log('[ModifyMaterial] Reserved quota for task', taskId)
      refreshQuota()
    } catch (e) {
      console.warn('[ModifyMaterial] Failed to reserve quota:', e)
    }
    
    const results: string[] = []
    
    // 生成2张图
    for (let i = 0; i < 2; i++) {
      try {
        setGeneratingProgress(i + 1)
        updateImageSlot(taskId, i, { status: 'generating' })
        
        const response = await fetch('/api/modify-material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outputImage,
            referenceImages: inputImages,
            targets,
            taskId,
            index: i,
          })
        })
        
        const data = await response.json()
        
        if (data.success && data.image) {
          results.push(data.image)
          updateImageSlot(taskId, i, { 
            status: 'completed', 
            imageUrl: data.image,
            modelType: data.modelType 
          })
          console.log(`[ModifyMaterial] Image ${i + 1} completed`)
        } else {
          console.error(`[ModifyMaterial] Image ${i + 1} failed:`, data.error)
          updateImageSlot(taskId, i, { status: 'failed', error: data.error })
        }
      } catch (err: any) {
        console.error(`[ModifyMaterial] Image ${i + 1} error:`, err.message)
        updateImageSlot(taskId, i, { status: 'failed', error: err.message })
      }
    }
    
    if (results.length === 0) {
      setError(t.modifyMaterial?.generateFailed || '生成失败，请重试')
      updateTaskStatus(taskId, 'failed')
      setPhase('editing')
      return
    }
    
    updateTaskStatus(taskId, 'completed')
    setResultImages(results)
    setPhase('result')
  }
  
  // 更新商品状态
  const updateProductState = (index: number, updates: Partial<ProductEditState>) => {
    setProductStates(prev => prev.map((s, i) => 
      i === index ? { ...s, ...updates } : s
    ))
  }
  
  // 渲染图片选择界面
  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-zinc-50">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-100">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <h1 className="text-lg font-semibold">{t.modifyMaterial?.title || '改材质版型'}</h1>
        </div>
        
        <div className="p-4 space-y-6">
          {/* 说明 */}
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-sm text-purple-800">
              {t.modifyMaterial?.selectDesc || '选择一张已生成的模特图，AI 将分析服装材质并允许您修改'}
            </p>
          </div>
          
          {/* 上传图片 */}
          <div>
            <p className="text-sm font-medium text-zinc-700 mb-3">{t.modifyMaterial?.uploadImage || '上传图片'}</p>
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm text-zinc-500">{t.modifyMaterial?.uploadImage || '上传图片'}</span>
            </button>
          </div>
          
          {/* 分隔线 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-xs text-zinc-400">{t.common?.or || '或'}</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>
          
          {/* 从成片选择 */}
          <div>
            <p className="text-sm font-medium text-zinc-700 mb-3">{t.modifyMaterial?.selectFromGallery || '从成片选择'}</p>
            <button
              onClick={() => {
                setShowGalleryPicker(true)
                loadGalleryItems()
              }}
              className="w-full h-32 rounded-xl border-2 border-dashed border-zinc-300 hover:border-purple-400 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm text-zinc-500">{t.modifyMaterial?.selectFromGallery || '从成片选择'}</span>
            </button>
          </div>
        </div>
        
        {/* Gallery Picker Modal */}
        <AnimatePresence>
          {showGalleryPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-end"
              onClick={() => setShowGalleryPicker(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full bg-white rounded-t-2xl max-h-[80vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="font-semibold">{t.modifyMaterial?.selectImage || '选择图片'}</h3>
                  <button onClick={() => setShowGalleryPicker(false)} className="p-2 rounded-full hover:bg-zinc-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  {isLoadingGallery ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : galleryItems.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                      {t.gallery?.noImages || '暂无图片'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {galleryItems.map((item, i) => (
                        <button
                          key={item.id || i}
                          onClick={() => handleSelectFromGallery(item)}
                          className="aspect-square rounded-lg overflow-hidden bg-zinc-100 hover:ring-2 hover:ring-purple-500 transition-all"
                        >
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={200}
                            height={200}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
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
  
  // 渲染加载/分析状态
  if (phase === 'loading' || phase === 'analyzing') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-blue-500" />
        </motion.div>
        <p className="mt-4 text-zinc-600 font-medium">
          {t.modifyMaterial?.analyzing || '正在分析商品特征...'}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {t.modifyMaterial?.pleaseWait || '请稍候'}
        </p>
      </div>
    )
  }
  
  // 渲染生成中状态（参考商品影棚风格）
  if (phase === 'generating') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 pb-24">
        {/* 带 glow 效果的 Loader */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
        </div>
        
        {/* 标题和描述 */}
        <h3 className="text-xl font-bold text-zinc-800 mb-2">
          {t.modifyMaterial?.generating || '正在生成修改后的图片...'}
        </h3>
        <p className="text-zinc-500 text-sm mb-2">
          {generatingProgress}/2 {t.modifyMaterial?.mayTakeTime || '这可能需要一些时间'}
        </p>
        
        {/* 进度条 */}
        <div className="w-48 h-2 bg-zinc-200 rounded-full overflow-hidden mb-8">
          <motion.div
            className="h-full bg-purple-500"
            initial={{ width: '0%' }}
            animate={{ width: `${(generatingProgress / 2) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        {/* 导航按钮（参考商品影棚） */}
        <div className="space-y-3 w-full max-w-xs">
          <p className="text-zinc-400 text-xs text-center mb-4">
            {t.modifyMaterial?.continueInBackground || '可继续操作，生成在后台进行'}
          </p>
          <button
            onClick={() => router.push('/gallery')}
            className="w-full h-12 rounded-full bg-purple-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.modifyMaterial?.backToGallery || '返回成片'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full h-12 rounded-full bg-zinc-100 text-zinc-700 font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <Home className="w-5 h-5" />
            {t.modifyMaterial?.returnHome || '返回首页'}
          </button>
        </div>
      </div>
    )
  }
  
  // 渲染结果页（显示2张图）
  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-zinc-200">
          <div className="flex items-center h-14 px-4">
            <button 
              onClick={() => router.push('/gallery')}
              className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="flex-1 text-center font-semibold">
              {t.modifyMaterial?.result || '修改结果'} ({resultImages.length})
            </h1>
            <div className="w-10" />
          </div>
        </div>
        
        {/* Result Images - 2张图并排显示 */}
        <div className="flex-1 p-4 pb-24 overflow-y-auto">
          {/* 原图 */}
          <div className="mb-4">
            <p className="text-sm font-medium text-zinc-600 mb-2">{t.modifyMaterial?.before || '修改前'}</p>
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-200">
              <Image
                src={outputImage}
                alt="Original"
                fill
                className="object-cover"
              />
            </div>
          </div>
          
          {/* 生成的图片 */}
          <p className="text-sm font-medium text-zinc-600 mb-2">{t.modifyMaterial?.after || '修改后'}</p>
          <div className="grid grid-cols-2 gap-3">
            {resultImages.map((img, idx) => (
              <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-200">
                <Image
                  src={img}
                  alt={`Result ${idx + 1}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded-full text-xs text-white">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Actions - 参考 studio 的吸底样式 */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto z-40">
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPhase('editing')
                setResultImages([])
              }}
              className="flex-1 h-12 rounded-full border-2 border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors"
            >
              {t.modifyMaterial?.modifyAgain || '再次修改'}
            </button>
            <button
              onClick={() => router.push('/gallery')}
              className="flex-1 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-200 transition-colors"
            >
              {t.modifyMaterial?.backToGallery || '返回成片'}
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // 渲染编辑页
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-zinc-200">
        <div className="flex items-center h-14 px-4">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold">
            {t.modifyMaterial?.title || '改材质版型'}
          </h1>
          <div className="w-10" />
        </div>
      </div>
      
      {/* Content - pb-40 给底部按钮留空间 */}
      <div className="flex-1 overflow-y-auto pb-40">
        {/* Output Image Preview */}
        <div className="p-4">
          <p className="text-sm font-medium text-zinc-600 mb-2">
            {t.modifyMaterial?.targetImage || '目标图片'}
          </p>
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-200">
            <Image
              src={outputImage}
              alt="Target"
              fill
              className="object-cover"
            />
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {/* Product Cards */}
        <div className="px-4 space-y-4">
          <p className="text-sm font-medium text-zinc-600">
            {t.modifyMaterial?.selectProducts || '选择要修改的商品'}
          </p>
          
          {productStates.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <p>{t.modifyMaterial?.noProductsFound || '未检测到商品'}</p>
            </div>
          ) : (
            productStates.map((state, index) => (
              <ProductCard
                key={index}
                state={state}
                onToggle={() => updateProductState(index, { enabled: !state.enabled })}
                onUpdate={(updates) => updateProductState(index, updates)}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Bottom Action - 参考 studio 的吸底样式 */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent max-w-md mx-auto z-40">
        <button
          onClick={handleGenerate}
          disabled={!productStates.some(s => s.enabled)}
          className={`w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
            productStates.some(s => s.enabled)
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-200'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <Wand2 className="w-5 h-5" />
          {t.modifyMaterial?.startModify || '开始修改'}
        </button>
      </div>
    </div>
  )
}

export default function ModifyMaterialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <ModifyMaterialContent />
    </Suspense>
  )
}

