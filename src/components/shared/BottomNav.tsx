"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, Wand2, Briefcase, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/camera", icon: Camera, label: "相机" },
  { href: "/edit", icon: Wand2, label: "修图" },
  { href: "/brand-assets", icon: Briefcase, label: "品牌资产" },
  { href: "/gallery", icon: ImageIcon, label: "图库" },
]

export function BottomNav() {
  const pathname = usePathname()
  
  // Hide on camera pages
  if (pathname.startsWith("/camera")) {
    return null
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 pb-safe">
      <div className="flex items-center justify-around h-full max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
                isActive 
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
