"use client"

import { RefreshCw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVersionCheck } from '@/hooks/useVersionCheck'

export function UpdatePrompt() {
  const { hasNewVersion, refresh, dismiss } = useVersionCheck()
  
  return (
    <AnimatePresence>
      {hasNewVersion && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-20 left-4 right-4 z-[100] flex justify-center"
        >
          <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm w-full">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">发现新版本</p>
              <p className="text-zinc-400 text-xs">刷新获取最新功能</p>
            </div>
            <button
              onClick={refresh}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              刷新
            </button>
            <button
              onClick={dismiss}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

