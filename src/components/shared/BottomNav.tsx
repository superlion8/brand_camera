"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, Wand2, FolderHeart, Images } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/camera", icon: Camera, label: "相机" },
  { href: "/edit", icon: Wand2, label: "编辑" },
  { href: "/brand-assets", icon: FolderHeart, label: "品牌资产" },
  { href: "/gallery", icon: Images, label: "图片资产" },
]

export function BottomNav() {
  const pathname = usePathname()
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0D0D0D]/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16 pb-safe max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                isActive ? "text-accent" : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(201,169,98,0.5)]")} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

