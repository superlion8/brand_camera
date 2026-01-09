"use client"

import { Coins, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreditCostBadgeProps {
  /** Number of credits this action will consume */
  cost: number
  /** Type of content being generated */
  type?: 'image' | 'video'
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional CSS classes */
  className?: string
}

/**
 * Badge component to display credit cost on generation buttons
 * 
 * Usage:
 * <button>
 *   开始生成
 *   <CreditCostBadge cost={4} />
 * </button>
 */
export function CreditCostBadge({ 
  cost, 
  type = 'image',
  size = 'sm',
  className 
}: CreditCostBadgeProps) {
  const Icon = type === 'video' ? Video : Coins
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
  }
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }
  
  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'bg-amber-100 text-amber-700',
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{cost}</span>
    </span>
  )
}

/**
 * Inline version for use inside button text
 */
export function CreditCostInline({ 
  cost,
  type = 'image',
  className 
}: Omit<CreditCostBadgeProps, 'size'>) {
  const Icon = type === 'video' ? Video : Coins
  
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-0.5 ml-1.5 opacity-80',
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs">{cost}</span>
    </span>
  )
}
