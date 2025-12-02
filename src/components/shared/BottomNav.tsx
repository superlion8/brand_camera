"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Camera, Briefcase, Image as ImageIcon, Home, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "home", href: "/", label: "主页", icon: Home },
  { id: "brand", href: "/brand-assets", label: "资产", icon: Briefcase },
  { id: "camera", href: "/camera", label: "", icon: Camera, isSpecial: true },
  { id: "edit", href: "/edit", label: "修图", icon: Wand2 },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 pb-safe">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto relative">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          
          if (tab.isSpecial) {
            return (
              <div key={tab.id} className="relative flex items-center justify-center -mt-6 pointer-events-none">
                <button
                  onClick={() => router.push(tab.href)}
                  className="w-16 h-16 bg-zinc-900 text-white rounded-full shadow-lg shadow-black/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform pointer-events-auto"
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
                  ? "text-zinc-900 font-medium" 
                  : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
