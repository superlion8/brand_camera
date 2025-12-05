"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Aperture, Users, Box } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslation } from "@/stores/languageStore"

interface ShootModeSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export function ShootModeSelector({ isOpen, onClose }: ShootModeSelectorProps) {
  const router = useRouter()
  const { t } = useTranslation()
  
  const modes = [
    { 
      id: "pro-studio", 
      label: t.home.proStudio || "专业棚拍", 
      icon: <Aperture className="w-6 h-6 text-white" />, 
      href: "/pro-studio",
      position: "bottom-[130px] left-[15%]",
    },
    { 
      id: "buyer-show", 
      label: t.home.modelStudio || "买家秀", 
      icon: <Users className="w-6 h-6 text-white" />, 
      href: "/camera",
      position: "bottom-[180px] left-1/2 -translate-x-1/2",
    },
    { 
      id: "product-studio", 
      label: t.home.productStudio || "商品棚拍", 
      icon: <Box className="w-6 h-6 text-white" />, 
      href: "/studio",
      position: "bottom-[130px] right-[15%]",
    },
  ]

  const handleSelect = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-end pb-8"
          onClick={onClose}
        >
          {/* Background Gradient/Glow (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Menu Items */}
          <div className="absolute inset-0" onClick={e => e.stopPropagation()}>
            {modes.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 50 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                className={`absolute ${m.position} flex flex-col items-center gap-2 group cursor-pointer z-20`}
                onClick={() => handleSelect(m.href)}
              >
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg transition-colors group-hover:bg-zinc-700/80"
                >
                  {m.icon}
                </motion.div>
                <span className="text-white text-xs font-medium tracking-wide drop-shadow-lg">
                  {m.label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Close Button */}
          <motion.button
            initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-zinc-700/80 transition-colors z-20 relative shadow-lg"
          >
            <X className="w-6 h-6" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

