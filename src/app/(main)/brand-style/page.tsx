'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Globe, 
  Instagram, 
  Video, 
  ImageIcon, 
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  Upload,
  X,
  Check,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTranslation } from '@/stores/languageStore'

export default function BrandStylePage() {
  const router = useRouter()
  const { isDesktop, isLoading: screenLoading } = useIsDesktop(1024)
  const { user, isLoading: authLoading } = useAuth()
  const { t } = useTranslation()

  // Form state - all hooks must be called before any conditional returns
  const [productPageUrl, setProductPageUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [productImage, setProductImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/brand-style')
    }
  }, [user, authLoading, router])

  // 显示加载状态（等待 auth 和 isMobile 确定后再渲染，避免闪烁）
  // 未登录时 useEffect 会重定向到登录页
  if (authLoading || screenLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">{t.common?.loading || '加载中...'}</p>
        </div>
      </div>
    )
  }

  // Validation
  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // At least one URL must be provided, plus product image
  const hasAtLeastOneUrl = 
    isValidUrl(productPageUrl) || 
    isValidUrl(instagramUrl) || 
    isValidUrl(videoUrl)
  
  const canSubmit = hasAtLeastOneUrl && productImage

  // Compress image to reduce size for sessionStorage
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Scale down if too large
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          // Convert to JPEG with compression
          const compressed = canvas.toDataURL('image/jpeg', quality)
          console.log('[Image] Compressed from', (e.target?.result as string).length, 'to', compressed.length)
          resolve(compressed)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  // Handle image upload with compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Compress image to avoid sessionStorage quota issues
      const compressed = await compressImage(file)
      setProductImage(compressed)
    }
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!canSubmit) return
    
    setIsSubmitting(true)
    
    // Store data in sessionStorage for the analyzing page
    sessionStorage.setItem('brandStyleInput', JSON.stringify({
      productPageUrl,
      instagramUrl,
      videoUrl,
      productImage
    }))
    
    router.push('/brand-style/analyzing')
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      {isDesktop ? (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-3xl mx-auto px-8 py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">{t.brandStyle.title}</h1>
                <p className="text-sm text-zinc-500">{t.brandStyle.subtitle}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center px-4 border-b bg-white shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <span className="font-semibold text-lg ml-2">{t.brandStyle.title}</span>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDesktop ? 'py-8' : 'p-4 pb-40'}`}>
        <div className={`space-y-6 ${isDesktop ? 'max-w-3xl mx-auto px-8' : ''}`}>
          
          {/* Intro Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg mb-1">{t.brandStyle.heroTitle}</h2>
                <p className="text-white/80 text-sm leading-relaxed">
                  {t.brandStyle.heroDesc}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Input Fields */}
          <div className="space-y-4">
            
            {/* 1. Product Page URL */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">{t.brandStyle.productPageUrl}</h3>
                  <p className="text-xs text-zinc-500">{t.brandStyle.productPageUrlDesc}</p>
                </div>
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="url"
                  value={productPageUrl}
                  onChange={(e) => setProductPageUrl(e.target.value)}
                  placeholder="https://www.example.com/product/..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-zinc-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
                />
                {productPageUrl && isValidUrl(productPageUrl) && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
            </motion.div>

            {/* 2. Instagram URL */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">{t.brandStyle.instagramUrl}</h3>
                  <p className="text-xs text-zinc-500">{t.brandStyle.instagramUrlDesc}</p>
                </div>
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-zinc-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all text-sm"
                />
                {instagramUrl && isValidUrl(instagramUrl) && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
            </motion.div>

            {/* 3. Video URL */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">{t.brandStyle.videoUrl}</h3>
                  <p className="text-xs text-zinc-500">{t.brandStyle.videoUrlDesc}</p>
                </div>
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm"
                />
                {videoUrl && isValidUrl(videoUrl) && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
            </motion.div>

            {/* 4. Product Image Upload */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-5 border border-zinc-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">{t.brandStyle.productImage}</h3>
                  <p className="text-xs text-zinc-500">{t.brandStyle.productImageDesc}</p>
                </div>
              </div>
              
              {!productImage ? (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="h-40 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-amber-500 hover:bg-amber-50/50 transition-colors">
                    <Upload className="w-8 h-8 text-zinc-400" />
                    <span className="text-sm text-zinc-500">{t.brandStyle.uploadProductImage}</span>
                  </div>
                </label>
              ) : (
                <div className="relative h-40 rounded-xl overflow-hidden bg-zinc-100">
                  <Image src={productImage} alt="Product" fill className="object-contain" />
                  <button
                    onClick={() => setProductImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-medium">{t.brandStyle?.uploaded || 'Uploaded'}</span>
                  </div>
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </div>

      {/* Submit Button */}
      {isDesktop ? (
        <div className="border-t bg-white p-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
                canSubmit && !isSubmitting
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t.brandStyle.submitting}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{t.brandStyle.startAnalysis}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t shadow-lg z-40">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              canSubmit && !isSubmitting
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t.brandStyle.submitting}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{t.brandStyle.startAnalysis}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

