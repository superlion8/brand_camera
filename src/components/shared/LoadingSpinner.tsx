"use client"

import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface LoadingSpinnerProps {
  className?: string
  message?: string
  progress?: number
}

export function LoadingSpinner({ className, message = "处理中...", progress }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-surface border-t-accent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-accent animate-pulse" />
        </div>
      </div>
      <p className="text-gray-400 text-sm">{message}</p>
      {progress !== undefined && (
        <div className="w-48 h-2 bg-surface rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-accent to-accent-light transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

