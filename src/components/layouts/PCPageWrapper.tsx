'use client'

import { ReactNode } from 'react'
import { Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/stores/languageStore'

interface PCPageWrapperProps {
  children: ReactNode
  title?: string
  subtitle?: string
  showHomeButton?: boolean
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  headerRight?: ReactNode
}

/**
 * PC Page Wrapper - 为 PC 端页面提供统一的布局框架
 * 
 * 特点：
 * - 页面标题区域
 * - 内容最大宽度限制
 * - 居中布局
 * - 响应式内边距
 */
export function PCPageWrapper({ 
  children, 
  title,
  subtitle,
  showHomeButton = true,
  maxWidth = 'lg',
  className,
  headerRight
}: PCPageWrapperProps) {
  const router = useRouter()

  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }

  return (
    <div className={cn('min-h-full bg-zinc-50', className)}>
      {/* Page Header */}
      {(title || showHomeButton) && (
        <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
          <div className={cn('mx-auto px-6 py-4', maxWidthClasses[maxWidth])}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {showHomeButton && (
                  <button 
                    onClick={() => router.push('/app')}
                    className="w-9 h-9 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <Home className="w-5 h-5 text-zinc-600" />
                  </button>
                )}
                {title && (
                  <div>
                    <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
                    {subtitle && (
                      <p className="text-sm text-zinc-500">{subtitle}</p>
                    )}
                  </div>
                )}
              </div>
              {headerRight && (
                <div className="flex items-center gap-3">
                  {headerRight}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className={cn('mx-auto px-6 py-8', maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </div>
  )
}

/**
 * PC Card - 统一的卡片样式
 */
export function PCCard({ 
  children, 
  title,
  className,
  headerRight,
  noPadding = false
}: { 
  children: ReactNode
  title?: string
  className?: string
  headerRight?: ReactNode
  noPadding?: boolean
}) {
  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm border border-zinc-100',
      className
    )}>
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h3 className="font-semibold text-zinc-900">{title}</h3>
          {headerRight}
        </div>
      )}
      <div className={cn(!noPadding && 'p-6')}>
        {children}
      </div>
    </div>
  )
}

/**
 * PC Section - 分区标题
 */
export function PCSection({ 
  title, 
  description,
  children,
  className 
}: { 
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * PC Two Column Layout - 双栏布局
 */
export function PCTwoColumn({ 
  left, 
  right,
  leftWidth = '400px',
  gap = '32px',
  className
}: { 
  left: ReactNode
  right: ReactNode
  leftWidth?: string
  gap?: string
  className?: string
}) {
  return (
    <div 
      className={cn('flex gap-8', className)}
      style={{ gap }}
    >
      <div style={{ width: leftWidth, flexShrink: 0 }}>
        {left}
      </div>
      <div className="flex-1 min-w-0">
        {right}
      </div>
    </div>
  )
}

/**
 * PC Image Upload Area - 统一的图片上传区域样式
 */
export function PCImageUploadArea({
  image,
  onUpload,
  onClear,
  aspectRatio = '3/4',
  placeholder,
  uploadText,
  clearText
}: {
  image: string | null
  onUpload: () => void
  onClear?: () => void
  aspectRatio?: string
  placeholder?: ReactNode
  uploadText?: string
  clearText?: string
}) {
  const { t } = useTranslation()
  
  const displayUploadText = uploadText || t.common?.upload || 'Upload'
  const displayClearText = clearText || t.common?.reselect || 'Reselect'
  
  if (image) {
    return (
      <div className="relative bg-zinc-100 rounded-2xl overflow-hidden">
        <div style={{ aspectRatio }} className="relative">
          <img 
            src={image} 
            alt="Preview" 
            className="absolute inset-0 w-full h-full object-contain bg-white"
          />
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 hover:bg-white text-zinc-700 text-sm font-medium rounded-xl shadow-lg transition-colors"
          >
            {displayClearText}
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onUpload}
      className="w-full bg-zinc-100 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-amber-400 hover:bg-amber-50/50 transition-all"
      style={{ aspectRatio }}
    >
      <div className="flex flex-col items-center justify-center h-full p-8">
        {placeholder || (
          <>
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <Home className="w-8 h-8 text-zinc-400" />
            </div>
            <span className="text-sm font-medium text-zinc-600">{displayUploadText}</span>
            <span className="text-xs text-zinc-400 mt-1">{t.common?.clickToUploadOrDrag || 'Click to upload or drag image'}</span>
          </>
        )}
      </div>
    </button>
  )
}

