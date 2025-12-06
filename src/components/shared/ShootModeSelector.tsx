"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Aperture, Users, Box } from "lucide-react"
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
    },
    { 
      id: "buyer-show", 
      label: t.home.modelStudio || "买家秀", 
      icon: <Users className="w-6 h-6 text-white" />, 
      href: "/camera",
    },
    { 
      id: "product-studio", 
      label: t.home.productStudio || "商品棚拍", 
      icon: <Box className="w-6 h-6 text-white" />, 
      href: "/studio",
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
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          {/* 底部渐变 */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-purple-900/30 to-transparent pointer-events-none" />

          {/* 弧形排列的三个按钮 - 精确计算位置 */}
          <div className="absolute bottom-24 left-0 right-0">
            {/* 容器相对定位，子元素绝对定位 */}
            <div className="relative h-40 max-w-xs mx-auto">
              {/* 左边按钮 - 专业棚拍 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 30 }}
                transition={{ delay: 0, type: "spring", stiffness: 300, damping: 20 }}
                className="absolute bottom-0 left-4 flex flex-col items-center gap-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleSelect(modes[0].href); }}
              >
                <motion.div 
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 rounded-full bg-zinc-800/90 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl"
                >
                  {modes[0].icon}
                </motion.div>
                <span className="text-white text-xs font-medium drop-shadow-lg text-center">
                  {modes[0].label}
                </span>
              </motion.div>

              {/* 中间按钮 - 买家秀 (顶部，形成弧形最高点) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 30 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleSelect(modes[1].href); }}
              >
                <motion.div 
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 rounded-full bg-zinc-800/90 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl"
                >
                  {modes[1].icon}
                </motion.div>
                <span className="text-white text-xs font-medium drop-shadow-lg text-center">
                  {modes[1].label}
                </span>
              </motion.div>

              {/* 右边按钮 - 商品棚拍 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 30 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                className="absolute bottom-0 right-4 flex flex-col items-center gap-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleSelect(modes[2].href); }}
              >
                <motion.div 
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 rounded-full bg-zinc-800/90 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl"
                >
                  {modes[2].icon}
                </motion.div>
                <span className="text-white text-xs font-medium drop-shadow-lg text-center">
                  {modes[2].label}
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

