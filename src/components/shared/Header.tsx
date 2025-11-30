"use client"

import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  showBack?: boolean
  rightElement?: React.ReactNode
  className?: string
}

export function Header({ title, showBack = false, rightElement, className }: HeaderProps) {
  const router = useRouter()
  
  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-[#0D0D0D]/95 backdrop-blur-lg border-b border-border",
      className
    )}>
      <div className="flex items-center gap-2 w-20">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
      </div>
      
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      
      <div className="flex items-center justify-end w-20">
        {rightElement}
      </div>
    </header>
  )
}

