'use client'

import { Loader2 } from 'lucide-react'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { useTranslation } from '@/stores/languageStore'

interface ScreenLoadingGuardProps {
  children: React.ReactNode
  /** Custom loading component */
  fallback?: React.ReactNode
}

/**
 * 防止因 isMobile 状态变化导致的页面闪烁
 * 在 SSR/hydration 期间显示 loading 状态
 */
export function ScreenLoadingGuard({ children, fallback }: ScreenLoadingGuardProps) {
  const { isLoading } = useIsDesktop()
  const { t } = useTranslation()
  
  if (isLoading) {
    return fallback ?? (
      <div className="h-full min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">{t.common?.loading || '加载中...'}</p>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
}

/**
 * HOC 版本，用于包装页面组件
 */
export function withScreenLoadingGuard<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ScreenLoadingGuard fallback={fallback}>
        <Component {...props} />
      </ScreenLoadingGuard>
    )
  }
}
