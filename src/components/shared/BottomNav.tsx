"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, Wand2, FolderHeart, Images } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/camera", icon: Camera, label: "相机" },
  { href: "/edit", icon: Wand2, label: "编辑" },
  { href: "/brand-assets", icon: FolderHeart, label: "资产" },
  { href: "/gallery", icon: Images, label: "图库" },
]

export function BottomNav() {
  const pathname = usePathname()
  
  // Hide on camera pages
  if (pathname.startsWith("/camera")) {
    return null
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-dark border-t border-white/10">
      <div className="flex items-center justify-around h-16 pb-safe max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-all",
                isActive ? "text-accent" : "text-white/50 active:text-white/80"
              )}
            >
              <Icon className={cn(
                "w-6 h-6 transition-transform",
                isActive && "scale-110"
              )} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
