"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Plus, X, ImagePlus, ChevronRight, Sparkles, FolderHeart, Upload } from "lucide-react"
import { useModelCreateStore } from "@/stores/modelCreateStore"
import { useAssetStore } from "@/stores/assetStore"
import { createClient } from "@/lib/supabase/client"

export default function ModelCreateStep1() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  const { productImages, addProductImage, removeProductImage, reset } = useModelCreateStore()
  const { userProducts } = useAssetStore()
  
  // 产品资产
  const productAssets = userProducts
  
  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // 未登录，跳转到登录页
        router.push('/login?redirect=/model-create')
        return
      }
      
      setIsCheckingAuth(false)
    }
    
    checkAuth()
  }, [router])
  
  // 处理文件选择
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    
    const remainingSlots = 4 - productImages.length
    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    
    for (const file of filesToProcess) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          if (result) {
            addProductImage(result)
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }
  
  // 从资产库添加
  const handleAddFromAssets = (imageUrl: string) => {
    if (productImages.length < 4) {
      addProductImage(imageUrl)
    }
    if (productImages.length >= 3) {
      setShowAssetPicker(false)
    }
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
  
  // 下一步
  const handleNext = () => {
    if (productImages.length >= 1) {
      router.push('/model-create/brands')
    }
  }
  
  // 返回首页并重置
  const handleBack = () => {
    reset()
    router.push('/')
  }
  
  // 加载中
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-violet-600 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-zinc-500">加载中...</p>
        </div>
      </div>
    )
  }
  
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
            <span className="font-bold text-zinc-900">创建专属模特</span>
          </div>
          <div className="w-10" />
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  step === 1 ? 'bg-violet-600' : 'bg-zinc-200'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span className="text-violet-600 font-medium">上传商品</span>
            <span>选品牌</span>
            <span>选模特</span>
            <span>生成</span>
          </div>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 pb-32">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-zinc-900 mb-2">上传你的商品</h1>
            <p className="text-sm text-zinc-500">
              上传 1-4 件商品，AI 将分析并为你推荐最合适的模特
            </p>
          </div>
          
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
            {/* Image Grid */}
            <div className="p-4">
              {productImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {/* Uploaded Images */}
                  <AnimatePresence mode="popLayout">
                    {productImages.map((image, index) => (
                      <motion.div
                        key={`image-${index}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                        className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 group"
                      >
                        <Image
                          src={image}
                          alt={`商品 ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          onClick={() => removeProductImage(index)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                          商品 {index + 1}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {/* Add Button */}
                  {productImages.length < 4 && (
                    <motion.button
                      layout
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-violet-50 hover:border-violet-300 transition-colors flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-violet-600" />
                      </div>
                      <span className="text-sm text-zinc-500">添加商品</span>
                      <span className="text-xs text-zinc-400">
                        {productImages.length}/4
                      </span>
                    </motion.button>
                  )}
                </div>
              ) : (
                /* Empty State - Full clickable area */
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-violet-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-700 mb-1">点击上传商品图片</p>
                    <p className="text-xs text-zinc-400">或拖拽图片到这里</p>
                  </div>
                  <span className="text-xs text-zinc-400">0/4</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-zinc-600" />
              <span className="text-sm font-medium text-zinc-700">本地上传</span>
            </button>
            <button
              onClick={() => setShowAssetPicker(true)}
              className="flex-1 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <FolderHeart className="w-4 h-4 text-zinc-600" />
              <span className="text-sm font-medium text-zinc-700">从资产库选择</span>
            </button>
          </div>
          
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          
          {/* Tips */}
          <div className="mt-6 p-4 bg-violet-50 rounded-xl">
            <h3 className="text-sm font-medium text-violet-900 mb-2">💡 小提示</h3>
            <ul className="text-xs text-violet-700 space-y-1.5">
              <li>• 建议上传清晰的商品平铺图或挂拍图</li>
              <li>• 多件商品可以帮助 AI 更准确地理解你的品牌风格</li>
              <li>• 支持 JPG、PNG 格式，单张图片不超过 10MB</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Bottom Action - Fixed */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100">
        <button
          onClick={handleNext}
          disabled={productImages.length === 0}
          className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
            productImages.length > 0
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200'
              : 'bg-zinc-300 cursor-not-allowed'
          }`}
        >
          <span>下一步：选择品牌</span>
          <ChevronRight className="w-5 h-5" />
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
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100">
                <h3 className="text-lg font-bold text-zinc-900">从资产库选择</h3>
                <button
                  onClick={() => setShowAssetPicker(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-zinc-600" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {productAssets.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {productAssets.map((asset) => {
                      const isSelected = productImages.includes(asset.imageUrl)
                      const canSelect = productImages.length < 4 || isSelected
                      return (
                        <button
                          key={asset.id}
                          onClick={() => {
                            if (isSelected) {
                              const index = productImages.indexOf(asset.imageUrl)
                              if (index !== -1) removeProductImage(index)
                            } else if (canSelect) {
                              handleAddFromAssets(asset.imageUrl)
                            }
                          }}
                          disabled={!canSelect}
                          className={`relative aspect-square rounded-lg overflow-hidden ${
                            isSelected ? 'ring-2 ring-violet-600' : ''
                          } ${!canSelect ? 'opacity-50' : ''}`}
                        >
                          <Image
                            src={asset.imageUrl}
                            alt={asset.name || '商品'}
                            fill
                            className="object-cover"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FolderHeart className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">资产库中没有商品图片</p>
                    <p className="text-xs text-zinc-400 mt-1">请先上传商品到资产库</p>
                  </div>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-100">
                <button
                  onClick={() => setShowAssetPicker(false)}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-medium"
                >
                  完成选择 ({productImages.length}/4)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
