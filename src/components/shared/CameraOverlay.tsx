"use client"

interface CameraOverlayProps {
  /** 提示文字 */
  hint?: string
  /** 是否显示网格 */
  showGrid?: boolean
  /** 是否显示对焦框 */
  showFocusFrame?: boolean
  /** 对焦框大小 */
  focusFrameSize?: "sm" | "md" | "lg"
  /** 额外的 className */
  className?: string
  /** 是否显示，默认 true */
  show?: boolean
}

/**
 * 相机覆盖层组件
 * 
 * 包含网格线、对焦框和提示文字
 */
export function CameraOverlay({
  hint,
  showGrid = true,
  showFocusFrame = true,
  focusFrameSize = "lg",
  className = "",
  show = true,
}: CameraOverlayProps) {
  if (!show) return null

  const frameSizeClass = {
    sm: "w-48 h-48",
    md: "w-56 h-56",
    lg: "w-64 h-64",
  }[focusFrameSize]

  return (
    <>
      {/* Grid */}
      {showGrid && (
        <div className={`absolute inset-0 pointer-events-none opacity-30 ${className}`}>
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>
        </div>
      )}
      
      {/* Focus Frame */}
      {showFocusFrame && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`${frameSizeClass} border border-white/50 rounded-lg relative`}>
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
          </div>
        </div>
      )}
      
      {/* Hint Text */}
      {hint && (
        <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md pointer-events-none">
          {hint}
        </div>
      )}
    </>
  )
}
