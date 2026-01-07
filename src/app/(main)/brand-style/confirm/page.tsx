'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  ArrowRight,
  Check,
  Globe,
  Instagram,
  Video,
  Sparkles,
  Edit3,
  ImageIcon,
  X,
  Upload,
  RefreshCw
} from 'lucide-react'
import Image from 'next/image'
import { useIsMobile } from '@/hooks/useIsMobile'

interface AnalysisData {
  productPage: {
    images: string[]
    modelImage: string
    productImage: string | null
    brandSummary: string
    brandKeywords: string[]
  }
  instagram: {
    images: string[]
    bestModelImage: string
  }
  video: {
    prompt: string
    thumbnailUrl?: string
  }
  summary: {
    summary: string
    styleKeywords: string[]
  }
  productImage: string
}

type EditingField = 'webModel' | 'insModel' | 'productRef' | 'videoPrompt' | 'brandSummary' | null

export default function ConfirmPage() {
  const router = useRouter()
  const isMobile = useIsMobile(1024)
  const isDesktop = isMobile === false
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editingText, setEditingText] = useState('')
  const [editingKeywords, setEditingKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')

  // Load analysis data
  useEffect(() => {
    const stored = sessionStorage.getItem('brandStyleAnalysis')
    if (!stored) {
      router.replace('/brand-style')
      return
    }
    setAnalysisData(JSON.parse(stored))
  }, [router])

  // Save changes to sessionStorage
  const saveChanges = (newData: AnalysisData) => {
    setAnalysisData(newData)
    sessionStorage.setItem('brandStyleAnalysis', JSON.stringify(newData))
  }

  // Handle image selection from list
  const handleSelectImage = (field: 'webModel' | 'insModel' | 'productRef', imageUrl: string) => {
    if (!analysisData) return
    
    const newData = { ...analysisData }
    if (field === 'webModel') {
      newData.productPage.modelImage = imageUrl
    } else if (field === 'insModel') {
      newData.instagram.bestModelImage = imageUrl
    } else if (field === 'productRef') {
      newData.productPage.productImage = imageUrl
    }
    
    saveChanges(newData)
    setEditingField(null)
  }

  // Handle image upload
  const handleImageUpload = (field: 'webModel' | 'insModel' | 'productRef', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !analysisData) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      handleSelectImage(field, imageUrl)
    }
    reader.readAsDataURL(file)
  }

  // Handle text edit save
  const handleSaveText = () => {
    if (!analysisData) return

    const newData = { ...analysisData }
    if (editingField === 'videoPrompt') {
      newData.video.prompt = editingText
    } else if (editingField === 'brandSummary') {
      newData.summary.summary = editingText
      newData.summary.styleKeywords = editingKeywords
    }

    saveChanges(newData)
    setEditingField(null)
    setEditingText('')
    setEditingKeywords([])
  }

  // Start editing text
  const startEditingText = (field: 'videoPrompt' | 'brandSummary') => {
    if (!analysisData) return
    
    if (field === 'videoPrompt') {
      setEditingText(analysisData.video.prompt)
    } else if (field === 'brandSummary') {
      setEditingText(analysisData.summary.summary)
      setEditingKeywords([...analysisData.summary.styleKeywords])
    }
    setEditingField(field)
  }

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && !editingKeywords.includes(newKeyword.trim())) {
      setEditingKeywords([...editingKeywords, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    setEditingKeywords(editingKeywords.filter(k => k !== keyword))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    router.push('/brand-style/generating')
  }

  if (!analysisData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Get available images for selection
  const getAvailableImages = (field: 'webModel' | 'insModel' | 'productRef') => {
    if (field === 'webModel' || field === 'productRef') {
      return analysisData.productPage.images || []
    } else if (field === 'insModel') {
      return analysisData.instagram.images || []
    }
    return []
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-600" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-zinc-900">确认分析结果</h1>
                  <p className="text-sm text-zinc-500">点击各项内容可以修改，确认后开始生成</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">分析完成</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center justify-between px-4 border-b bg-white shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <span className="font-semibold text-lg ml-2">确认结果</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
            <span className="text-xs font-medium text-green-700">完成</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-40'}`}>
        <div className={`space-y-6 ${isDesktop ? 'max-w-4xl mx-auto px-8' : ''}`}>
          
          {/* Your Product */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white"
          >
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-5 h-5" />
              <h2 className="font-semibold">待生成商品</h2>
            </div>
            <div className="flex gap-4">
              <div className="relative w-24 h-32 rounded-xl overflow-hidden bg-white/20">
                <Image 
                  src={analysisData.productImage} 
                  alt="Product" 
                  fill 
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm leading-relaxed">
                  AI 将基于您的品牌风格，为这件商品生成：
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>2 张官网风格模特图</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>2 张 INS 风格模特图</span>
                  </li>
                  {analysisData.productPage.productImage && (
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>1 张商品展示图</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>1 条 UGC 风格短视频</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Analysis Results Grid */}
          <div className={`grid gap-4 ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* Web Model Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200 group cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
              onClick={() => setEditingField('webModel')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">官网模特参考</h3>
                    <p className="text-xs text-zinc-500">用于生成官网风格图</p>
                  </div>
                </div>
                <button className="text-blue-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <RefreshCw className="w-4 h-4" />
                  更换
                </button>
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                {analysisData.productPage.modelImage ? (
                  <Image 
                    src={analysisData.productPage.modelImage} 
                    alt="Web Model" 
                    fill 
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Globe className="w-8 h-8" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Instagram Model Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200 group cursor-pointer hover:border-pink-300 hover:shadow-md transition-all"
              onClick={() => setEditingField('insModel')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Instagram className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">INS 模特参考</h3>
                    <p className="text-xs text-zinc-500">用于生成 INS 风格图</p>
                  </div>
                </div>
                <button className="text-pink-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <RefreshCw className="w-4 h-4" />
                  更换
                </button>
              </div>
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100">
                {analysisData.instagram.bestModelImage ? (
                  <Image 
                    src={analysisData.instagram.bestModelImage} 
                    alt="Instagram Model" 
                    fill 
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Instagram className="w-8 h-8" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Product Image (if exists) */}
            {analysisData.productPage.productImage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-5 border border-zinc-200 group cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
                onClick={() => setEditingField('productRef')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900">商品图参考</h3>
                      <p className="text-xs text-zinc-500">用于生成纯商品展示图</p>
                    </div>
                  </div>
                  <button className="text-amber-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <RefreshCw className="w-4 h-4" />
                    更换
                  </button>
                </div>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100">
                  <Image 
                    src={analysisData.productPage.productImage} 
                    alt="Product Reference" 
                    fill 
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </motion.div>
            )}

            {/* Video Prompt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200 group cursor-pointer hover:border-red-300 hover:shadow-md transition-all"
              onClick={() => startEditingText('videoPrompt')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <Video className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">视频创作提示词</h3>
                    <p className="text-xs text-zinc-500">从 UGC 视频中反推</p>
                  </div>
                </div>
                <button className="text-red-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit3 className="w-4 h-4" />
                  编辑
                </button>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl">
                <p className="text-sm text-zinc-700 leading-relaxed line-clamp-4">
                  {analysisData.video.prompt}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Brand Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-5 border border-zinc-200 group cursor-pointer hover:border-violet-300 hover:shadow-md transition-all"
            onClick={() => startEditingText('brandSummary')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-semibold text-zinc-900">品牌风格摘要</h3>
              </div>
              <button className="text-violet-600 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 className="w-4 h-4" />
                编辑
              </button>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed mb-4">
              {analysisData.summary.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              {analysisData.summary.styleKeywords.map((keyword, i) => (
                <span 
                  key={i}
                  className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Generate Button */}
      {isDesktop ? (
        <div className="border-t bg-white p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg transition-all"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在准备生成...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>确认并开始生成</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t shadow-lg z-40">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>正在准备...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>开始生成</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Image Selection Modal */}
      <AnimatePresence>
        {(editingField === 'webModel' || editingField === 'insModel' || editingField === 'productRef') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingField(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  选择{editingField === 'webModel' ? '官网模特' : editingField === 'insModel' ? 'INS 模特' : '商品'}参考图
                </h3>
                <button
                  onClick={() => setEditingField(null)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Upload Button */}
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(editingField as 'webModel' | 'insModel' | 'productRef', e)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-20 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center gap-2 text-zinc-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    <span>上传新图片</span>
                  </button>
                </div>

                {/* Available Images */}
                <p className="text-sm text-zinc-500 mb-3">或从分析结果中选择：</p>
                <div className="grid grid-cols-3 gap-3">
                  {getAvailableImages(editingField as 'webModel' | 'insModel' | 'productRef').map((img, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectImage(editingField as 'webModel' | 'insModel' | 'productRef', img)}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-transparent hover:border-violet-500 transition-all"
                    >
                      <Image
                        src={img}
                        alt={`Option ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>

                {getAvailableImages(editingField as 'webModel' | 'insModel' | 'productRef').length === 0 && (
                  <p className="text-center text-zinc-400 py-8">暂无可选图片，请上传新图片</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text Edit Modal */}
      <AnimatePresence>
        {(editingField === 'videoPrompt' || editingField === 'brandSummary') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingField(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  编辑{editingField === 'videoPrompt' ? '视频提示词' : '品牌风格摘要'}
                </h3>
                <button
                  onClick={() => setEditingField(null)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={editingField === 'videoPrompt' ? 6 : 4}
                  className="w-full p-3 border border-zinc-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  placeholder={editingField === 'videoPrompt' ? '描述视频风格...' : '描述品牌风格...'}
                />

                {/* Keywords Editor for Brand Summary */}
                {editingField === 'brandSummary' && (
                  <div>
                    <p className="text-sm font-medium text-zinc-700 mb-2">风格关键词</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {editingKeywords.map((keyword, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            onClick={() => removeKeyword(keyword)}
                            className="w-4 h-4 rounded-full hover:bg-violet-200 flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                        placeholder="添加关键词..."
                        className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={addKeyword}
                        className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex gap-3">
                <button
                  onClick={() => setEditingField(null)}
                  className="flex-1 h-11 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveText}
                  className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
