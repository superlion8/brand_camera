"use client"

import { Plus, X } from "lucide-react"
import { ReactNode } from "react"

interface ProductPreviewAreaProps {
  /** 主商品图片 URL */
  mainImage: string | null
  /** 额外商品图片数组 */
  additionalImages?: string[]
  /** 最大额外商品数量 */
  maxAdditionalImages?: number
  /** 点击添加额外商品 */
  onAddProduct?: () => void
  /** 删除额外商品 */
  onRemoveProduct?: (index: number) => void
  /** 添加按钮文字 */
  addLabel?: string
  /** 选中的模特/背景等 badge 信息 */
  badges?: Array<{ label: string; value: string }>
  /** 底部额外内容（如选择按钮等） */
  bottomContent?: ReactNode
  /** 额外的 className */
  className?: string
}

/**
 * 商品预览区域组件
 * 
 * 显示主商品图片和额外商品缩略图
 * 支持添加/删除额外商品
 */
export function ProductPreviewArea({
  mainImage,
  additionalImages = [],
  maxAdditionalImages = 3,
  onAddProduct,
  onRemoveProduct,
  addLabel = "Add",
  badges = [],
  bottomContent,
  className = "",
}: ProductPreviewAreaProps) {
  const canAddMore = additionalImages.length < maxAdditionalImages

  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* Main Product Image */}
      {mainImage && (
        <img 
          src={mainImage} 
          alt="商品" 
          className="w-full h-full object-cover"
        />
      )}
      
      {/* Selection Badges */}
      {badges.length > 0 && (
        <div className="absolute top-16 left-0 right-0 flex justify-center gap-2 z-10 px-4 flex-wrap pointer-events-none">
          {badges.map((badge, index) => (
            <span 
              key={index}
              className="px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-md"
            >
              {badge.label}: {badge.value}
            </span>
          ))}
        </div>
      )}
      
      {/* Additional Products Area (Bottom Right) */}
      {(additionalImages.length > 0 || (canAddMore && onAddProduct)) && (
        <div className="absolute bottom-4 right-4 flex items-end gap-2">
          {/* Existing Additional Products */}
          {additionalImages.map((img, index) => (
            <div 
              key={index} 
              className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-lg group"
            >
              <img 
                src={img} 
                alt={`商品${index + 2}`} 
                className="w-full h-full object-cover"
              />
              {/* Delete Button */}
              {onRemoveProduct && (
                <button
                  onClick={() => onRemoveProduct(index)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
              {/* Index Label */}
              <div className="absolute bottom-0.5 left-0.5 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
                +{index + 1}
              </div>
            </div>
          ))}
          
          {/* Add More Button */}
          {canAddMore && onAddProduct && (
            <button
              onClick={onAddProduct}
              className="w-16 h-16 rounded-xl bg-black/60 backdrop-blur-md border-2 border-dashed border-white/40 flex flex-col items-center justify-center hover:bg-black/70 transition-colors"
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-[10px] text-white/80 mt-0.5">{addLabel}</span>
            </button>
          )}
        </div>
      )}
      
      {/* Bottom Content (e.g., action buttons) */}
      {bottomContent}
    </div>
  )
}
