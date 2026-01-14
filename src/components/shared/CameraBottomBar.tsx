"use client"

import { ImageIcon, FolderHeart, Camera } from "lucide-react"
import { ReactNode } from "react"

export type ShutterVariant = "default" | "gradient-pink" | "gradient-purple" | "gradient-amber"

interface CameraBottomBarProps {
  /** 相册按钮点击 */
  onAlbumClick: () => void
  /** 快门按钮点击 */
  onShutterClick: () => void
  /** 资源库按钮点击 */
  onAssetClick: () => void
  /** 快门是否禁用 */
  shutterDisabled?: boolean
  /** 快门样式变体 */
  shutterVariant?: ShutterVariant
  /** 相册标签 */
  albumLabel?: string
  /** 资源库标签 */
  assetLabel?: string
  /** 左侧按钮自定义图标 */
  leftIcon?: ReactNode
  /** 右侧按钮自定义图标 */
  rightIcon?: ReactNode
  /** 额外的 className */
  className?: string
  /** 是否显示，默认 true */
  show?: boolean
}

const shutterStyles: Record<ShutterVariant, { border: string; inner: string; innerActive: string }> = {
  default: {
    border: "border-white/30",
    inner: "bg-white",
    innerActive: "group-active:bg-gray-200",
  },
  "gradient-pink": {
    border: "border-pink-400/50",
    inner: "bg-gradient-to-r from-pink-400 to-purple-400",
    innerActive: "group-active:from-pink-500 group-active:to-purple-500",
  },
  "gradient-purple": {
    border: "border-purple-400/50",
    inner: "bg-gradient-to-r from-purple-400 to-pink-400",
    innerActive: "group-active:from-purple-500 group-active:to-pink-500",
  },
  "gradient-amber": {
    border: "border-amber-400/50",
    inner: "bg-gradient-to-r from-amber-400 to-orange-400",
    innerActive: "group-active:from-amber-500 group-active:to-orange-500",
  },
}

/**
 * 移动端相机模式底部控制栏
 * 
 * 三按钮布局：相册 | 快门 | 资源库
 */
export function CameraBottomBar({
  onAlbumClick,
  onShutterClick,
  onAssetClick,
  shutterDisabled = false,
  shutterVariant = "default",
  albumLabel = "相册",
  assetLabel = "资源库",
  leftIcon,
  rightIcon,
  className = "",
  show = true,
}: CameraBottomBarProps) {
  if (!show) return null

  const shutter = shutterStyles[shutterVariant]

  return (
    <div className={`flex items-center justify-center gap-8 pb-4 ${className}`}>
      {/* Left: Album */}
      <button 
        onClick={onAlbumClick}
        className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          {leftIcon || <ImageIcon className="w-6 h-6" />}
        </div>
        <span className="text-[10px]">{albumLabel}</span>
      </button>

      {/* Center: Shutter */}
      <button 
        onClick={onShutterClick}
        disabled={shutterDisabled}
        className={`w-20 h-20 rounded-full border-4 ${shutter.border} flex items-center justify-center relative group active:scale-95 transition-transform disabled:opacity-50`}
      >
        <div className={`w-[72px] h-[72px] ${shutter.inner} rounded-full ${shutter.innerActive} transition-colors border-2 border-black`} />
      </button>

      {/* Right: Asset Library */}
      <button 
        onClick={onAssetClick}
        className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
      >
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          {rightIcon || <FolderHeart className="w-6 h-6" />}
        </div>
        <span className="text-[10px]">{assetLabel}</span>
      </button>
    </div>
  )
}
