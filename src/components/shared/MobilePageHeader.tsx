"use client"

import { Home, X, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { ReactNode } from "react"

export type HeaderVariant = "dark" | "light"
export type BackAction = "home" | "back" | "close" | "custom"

interface MobilePageHeaderProps {
  /** 返回按钮类型 */
  backAction?: BackAction
  /** 自定义返回处理 */
  onBack?: () => void
  /** 标题（可选，居中显示） */
  title?: string
  /** 标题图标（可选） */
  titleIcon?: ReactNode
  /** 标题主题色 class，如 'text-purple-400' */
  titleIconColor?: string
  /** 右侧内容（可选） */
  rightContent?: ReactNode
  /** 外观变体 */
  variant?: HeaderVariant
  /** 额外的 className */
  className?: string
  /** 是否显示，默认 true */
  show?: boolean
}

/**
 * 移动端页面顶部导航组件
 * 
 * 支持三种布局：
 * 1. 仅左侧按钮（默认）
 * 2. 左按钮 + 居中标题
 * 3. 左按钮 + 居中标题 + 右侧内容
 */
export function MobilePageHeader({
  backAction = "home",
  onBack,
  title,
  titleIcon,
  titleIconColor = "text-purple-400",
  rightContent,
  variant = "dark",
  className = "",
  show = true,
}: MobilePageHeaderProps) {
  const router = useRouter()

  if (!show) return null

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      switch (backAction) {
        case "home":
          router.push("/")
          break
        case "back":
          router.back()
          break
        case "close":
          // close 通常需要自定义 onBack
          router.back()
          break
        default:
          router.push("/")
      }
    }
  }

  const getBackIcon = () => {
    switch (backAction) {
      case "close":
        return <X className="w-6 h-6" />
      case "back":
        return <ArrowLeft className="w-5 h-5" />
      default:
        return <Home className="w-5 h-5" />
    }
  }

  const buttonStyles = variant === "dark"
    ? "bg-black/20 text-white hover:bg-black/40 backdrop-blur-md"
    : "bg-white/90 text-zinc-700 hover:bg-white backdrop-blur-md shadow-sm"

  const titleStyles = variant === "dark"
    ? "bg-black/20 backdrop-blur-md border border-white/10 text-white"
    : "bg-white/90 backdrop-blur-md border border-zinc-200 text-zinc-900"

  // 简单模式：仅左侧按钮
  if (!title && !rightContent) {
    return (
      <div className={`absolute top-4 left-4 z-20 ${className}`}>
        <button
          onClick={handleBack}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${buttonStyles}`}
        >
          {getBackIcon()}
        </button>
      </div>
    )
  }

  // 完整模式：左按钮 + 标题 + 右侧
  return (
    <div className={`absolute top-4 left-4 right-4 z-20 flex justify-between items-center ${className}`}>
      <button
        onClick={handleBack}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${buttonStyles}`}
      >
        {getBackIcon()}
      </button>
      
      {title && (
        <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${titleStyles}`}>
          {titleIcon && <span className={titleIconColor}>{titleIcon}</span>}
          <span className="text-xs font-medium">{title}</span>
        </div>
      )}
      
      {/* 右侧：内容或占位 */}
      {rightContent || <div className="w-10" />}
    </div>
  )
}
