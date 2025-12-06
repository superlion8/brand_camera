"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Webcam from "react-webcam"
import { 
  ArrowLeft, Camera, Image as ImageIcon, Loader2, 
  Upload, FolderHeart, X, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { fileToBase64, compressBase64Image } from "@/lib/utils"
import Image from "next/image"
import { useAssetStore } from "@/stores/assetStore"
import { useLanguageStore } from "@/stores/languageStore"
import { ProductAnalysis } from "@/types/outfit"
import { Asset } from "@/types"

export default function ShootPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 状态
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  
  // 资产库数据
  const { userProducts: products } = useAssetStore()
  
  // 检查摄像头权限
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const cachedPermission = localStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
          setPermissionChecked(true)
          return
        }
        
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
            localStorage.setItem('cameraPermissionGranted', 'true')
          } else if (result.state === 'denied') {
            setHasCamera(false)
            localStorage.setItem('cameraPermissionGranted', 'false')
          }
        }
      } catch (e) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(track => track.stop())
          setCameraReady(true)
          localStorage.setItem('cameraPermissionGranted', 'true')
        } catch {
          setHasCamera(false)
        }
      }
      setPermissionChecked(true)
    }
    
    checkCameraPermission()
  }, [])
  
  // 拍照
  const handleCapture = () => {
    if (webcamRef.current) {
      // 获取视频的实际分辨率，保持正确的宽高比
      const video = webcamRef.current.video
      const videoWidth = video?.videoWidth || 1920
      const videoHeight = video?.videoHeight || 1080
      
      const imageSrc = webcamRef.current.getScreenshot({ width: videoWidth, height: videoHeight })
      if (imageSrc) {
        analyzeProduct(imageSrc)
      }
    }
  }
  
  // 从相册上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const base64 = await fileToBase64(file)
      // 不压缩，直接使用原图
      analyzeProduct(base64)
    } catch (error) {
      console.error('File upload failed:', error)
    }
    
    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // 从资产库选择
  const handleAssetSelect = async (imageUrl: string) => {
    setShowAssetPicker(false)
    
    // 如果是网络图片，转换为 base64
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        analyzeProduct(base64)
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('Failed to load asset:', error)
      setAnalyzeError(t.errors?.uploadFailed || '加载失败，请重试')
    }
  }
  
  // 分析商品
  const analyzeProduct = async (imageBase64: string) => {
    setCapturedImage(imageBase64)
    setIsAnalyzing(true)
    setAnalyzeError(null)
    
    try {
      const response = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '分析失败')
      }
      
      // 保存分析结果到 sessionStorage
      const analysis: ProductAnalysis = {
        type: result.data.type,
        material: result.data.material,
        fit: result.data.fit,
        imageUrl: imageBase64
      }
      
      sessionStorage.setItem('productAnalysis', JSON.stringify(analysis))
      
      // 跳转到人形图界面
      router.push('/camera/outfit')
      
    } catch (error: any) {
      console.error('Analyze failed:', error)
      setAnalyzeError(error.message || '分析失败，请重试')
      setIsAnalyzing(false)
    }
  }
  
  // 重新拍摄
  const handleRetake = () => {
    setCapturedImage(null)
    setAnalyzeError(null)
    setIsAnalyzing(false)
  }
  
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-medium text-lg">
          {t.shoot?.title || '拍摄商品'}
        </span>
        <div className="w-10" /> {/* Spacer */}
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 relative">
        {/* 分析中的遮罩 */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
              <p className="text-white font-medium">{t.shoot?.analyzing || '正在分析商品...'}</p>
              <p className="text-white/60 text-sm mt-2">{t.shoot?.pleaseWait || '请稍候'}</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 错误提示 */}
        <AnimatePresence>
          {analyzeError && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-white font-medium text-center mb-2">{t.shoot?.analyzeFailed || '分析失败'}</p>
              <p className="text-white/60 text-sm text-center mb-6">{analyzeError}</p>
              <button
                onClick={handleRetake}
                className="px-6 py-3 bg-white text-black rounded-full font-medium"
              >
                {t.shoot?.retry || '重新拍摄'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 已拍摄的图片预览 */}
        {capturedImage ? (
          <div className="absolute inset-0">
            <Image
              src={capturedImage}
              alt="Captured"
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <>
            {/* 摄像头区域 */}
            {hasCamera && cameraReady ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "environment",
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                }}
                className="absolute inset-0 w-full h-full object-cover"
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() => setHasCamera(false)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="text-center p-6">
                  <Camera className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400 mb-4">
                    {!permissionChecked 
                      ? (t.shoot?.checkingCamera || '检查摄像头权限...')
                      : (t.shoot?.noCameraAccess || '无法访问摄像头')}
                  </p>
                  {permissionChecked && !hasCamera && (
                    <p className="text-zinc-500 text-sm">
                      {t.shoot?.useAlbum || '请使用相册上传'}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* 提示框 */}
            <div className="absolute top-24 left-4 right-4 z-10">
              <div className="bg-black/60 backdrop-blur rounded-xl p-4 text-center">
                <p className="text-white font-medium">
                  {t.shoot?.hint || '请拍摄一件商品'}
                </p>
                <p className="text-white/60 text-sm mt-1">
                  {t.shoot?.hintSub || '我们会自动识别商品类型'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 底部控制区 */}
      {!isAnalyzing && !analyzeError && !capturedImage && (
        <div className="absolute bottom-0 left-0 right-0 pb-10 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="flex items-center justify-center gap-8">
            {/* 相册上传 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <ImageIcon className="w-6 h-6 text-white" />
            </button>
            
            {/* 拍摄按钮 */}
            <button
              onClick={handleCapture}
              disabled={!hasCamera || !cameraReady}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full border-4 border-zinc-900" />
            </button>
            
            {/* 资产库 */}
            <button
              onClick={() => setShowAssetPicker(true)}
              className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <FolderHeart className="w-6 h-6 text-white" />
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}
      
      {/* 资产库选择器 */}
      <AnimatePresence>
        {showAssetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={() => setShowAssetPicker(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[70vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-white font-medium">{t.shoot?.selectFromAssets || '从资产库选择'}</span>
                <button
                  onClick={() => setShowAssetPicker(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[calc(70vh-60px)]">
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderHeart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-500">{t.shoot?.noProducts || '暂无商品'}</p>
                    <p className="text-zinc-600 text-sm mt-1">{t.shoot?.uploadFirst || '请先上传商品到资产库'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleAssetSelect(product.imageUrl)}
                        className="aspect-square rounded-xl overflow-hidden bg-zinc-800 relative group"
                      >
                        <Image
                          src={product.imageUrl}
                          alt={product.name || 'Product'}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
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

