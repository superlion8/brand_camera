"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Camera, Briefcase, Image as ImageIcon, Home, Wand2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/stores/languageStore"
import { useGenerationTaskStore } from "@/stores/generationTaskStore"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { tasks } = useGenerationTaskStore()
  
  // Check if there are any active (pending/generating) tasks
  const hasActiveTasks = tasks.some(task => task.status === 'pending' || task.status === 'generating')
  
  const tabs = [
    { id: "home", href: "/", label: t.nav.home, icon: Home },
    { id: "brand", href: "/brand-assets", label: t.nav.assets, icon: Briefcase },
    { id: "camera", href: "/camera", label: "", icon: Camera, isSpecial: true },
    { id: "edit", href: "/edit", label: t.nav.edit, icon: Wand2 },
    { id: "gallery", href: "/gallery", label: t.nav.gallery, icon: ImageIcon },
  ]
  
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
          const showLoading = tab.id === "gallery" && hasActiveTasks
          
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
                "flex flex-col items-center justify-center w-full h-16 space-y-1 transition-colors duration-200 relative",
                isActive 
                  ? "text-zinc-900 font-medium" 
                  : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {showLoading && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Loader2 size={8} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
