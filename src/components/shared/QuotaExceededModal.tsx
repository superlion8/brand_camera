"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, X, Mail } from "lucide-react"

interface QuotaExceededModalProps {
  isOpen: boolean
  onClose: () => void
  usedCount?: number
  totalQuota?: number
}

export function QuotaExceededModal({ 
  isOpen, 
  onClose,
  usedCount = 30,
  totalQuota = 30,
}: QuotaExceededModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 text-center">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
              
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              
              <h2 className="text-xl font-bold text-zinc-900 mb-2">
                免费额度已用尽
              </h2>
              
              <p className="text-zinc-500 text-sm">
                您已使用 {usedCount}/{totalQuota} 张图片额度
              </p>
            </div>
            
            {/* Content */}
            <div className="px-6 pb-6">
              <div className="bg-zinc-50 rounded-xl p-4 mb-4">
                <p className="text-zinc-600 text-sm text-center leading-relaxed">
                  您的免费额度已用尽，请联系官方团队申请更多额度
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>已使用</span>
                  <span>{usedCount} / {totalQuota}</span>
                </div>
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
                    style={{ width: `${Math.min((usedCount / totalQuota) * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              {/* Contact button */}
              <a
                href="mailto:superlion80@gmail.com?subject=申请更多图片生成额度"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                联系官方团队
              </a>
              
              <button
                onClick={onClose}
                className="w-full h-12 mt-2 text-zinc-500 hover:text-zinc-700 text-sm font-medium transition-colors"
              >
                我知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

