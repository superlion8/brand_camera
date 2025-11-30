"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Camera, Briefcase, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "brand", href: "/brand-assets", label: "品牌资产", icon: Briefcase },
  { id: "camera", href: "/camera", label: "", icon: Camera, isSpecial: true },
  { id: "gallery", href: "/gallery", label: "图库", icon: ImageIcon },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  
  // Hide on camera pages
  if (pathname.startsWith("/camera")) {
    return null
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 pb-safe">
      <div className="grid grid-cols-3 h-16 max-w-lg mx-auto relative">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname.startsWith(tab.href)
          
          if (tab.isSpecial) {
            return (
              <div key={tab.id} className="relative flex items-center justify-center -mt-6 pointer-events-none">
                <button
                  onClick={() => router.push(tab.href)}
                  className="w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-lg shadow-black/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform pointer-events-auto"
                >
                  <Camera size={28} />
                </button>
              </div>
            )
          }
          
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-16 space-y-1 transition-colors duration-200",
                isActive 
                  ? "text-black dark:text-white font-medium" 
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
