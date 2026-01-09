"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, X } from 'lucide-react'
import { useQuota } from '@/hooks/useQuota'
import { useTranslation } from '@/stores/languageStore'

export function DailyRewardToast() {
  const { dailyReward, clearDailyReward } = useQuota()
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (dailyReward?.credited) {
      setShow(true)
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShow(false)
        clearDailyReward()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [dailyReward, clearDailyReward])

  const handleClose = () => {
    setShow(false)
    clearDailyReward()
  }

  return (
    <AnimatePresence>
      {show && dailyReward?.credited && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/30">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {dailyReward.isNewUser 
                  ? (t.dailyReward?.welcome || '🎉 欢迎新用户！') 
                  : (t.dailyReward?.title || '🎁 每日登录奖励')}
              </p>
              <p className="text-xs text-white/80">
                {t.dailyReward?.credited?.replace('{credits}', String(dailyReward.creditsAdded || 5)) 
                  || `+${dailyReward.creditsAdded || 5} credits`}
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
