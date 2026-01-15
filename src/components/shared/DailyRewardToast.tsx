"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, X, Loader2, Sparkles, Check } from 'lucide-react'
import { useQuota } from '@/hooks/useQuota'
import { useTranslation } from '@/stores/languageStore'

export function DailyRewardToast() {
  const { dailyReward, dailyRewardStatus, isClaimingReward, claimDailyReward, clearDailyReward } = useQuota()
  const { t } = useTranslation()
  const [showClaimPrompt, setShowClaimPrompt] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Show claim prompt when reward is available
  useEffect(() => {
    if (dailyRewardStatus?.canClaim && !dismissed) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShowClaimPrompt(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [dailyRewardStatus?.canClaim, dismissed])

  // Show success toast after claiming
  useEffect(() => {
    if (dailyReward?.credited) {
      setShowClaimPrompt(false)
      setShowSuccess(true)
      // Auto-hide success after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false)
        clearDailyReward()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [dailyReward, clearDailyReward])

  const handleClaim = async () => {
    await claimDailyReward()
  }

  const handleDismiss = () => {
    setShowClaimPrompt(false)
    setDismissed(true)
  }

  const handleCloseSuccess = () => {
    setShowSuccess(false)
    clearDailyReward()
  }

  return (
    <>
      {/* Claim Prompt - Shows when reward is available */}
      <AnimatePresence>
        {showClaimPrompt && dailyRewardStatus?.canClaim && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed top-16 lg:top-4 right-4 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)]"
          >
            <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-2xl shadow-lg shadow-green-500/30">
              <div className="w-9 h-9 lg:w-11 lg:h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {t.dailyReward?.available || '🎁 每日奖励可领取！'}
                </p>
                <p className="text-xs text-white/80 truncate">
                  {t.dailyReward?.clickToClaim?.replace('{credits}', String(dailyRewardStatus.rewardAmount)) 
                    || `点击领取 +${dailyRewardStatus.rewardAmount} credits`}
                </p>
              </div>
              <button 
                onClick={handleClaim}
                disabled={isClaimingReward}
                className="px-3 lg:px-4 py-1.5 lg:py-2 bg-white text-green-600 font-semibold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-70 flex items-center gap-1.5 shrink-0"
              >
                {isClaimingReward ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="hidden lg:inline">{t.dailyReward?.claim || '领取'}</span>
              </button>
              <button 
                onClick={handleDismiss}
                className="p-1 lg:p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast - Shows after claiming */}
      <AnimatePresence>
        {showSuccess && dailyReward?.credited && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed top-16 lg:top-4 right-4 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)]"
          >
            <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-5 py-2.5 lg:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl shadow-lg shadow-green-500/30">
              <div className="w-9 h-9 lg:w-10 lg:h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {dailyReward.isNewUser 
                    ? (t.dailyReward?.welcome || '🎉 欢迎！') 
                    : (t.dailyReward?.claimed || '✅ 领取成功！')}
                </p>
                <p className="text-xs text-white/80 truncate">
                  {t.dailyReward?.credited?.replace('{credits}', String(dailyReward.creditsAdded || 5)) 
                    || `+${dailyReward.creditsAdded || 5} credits 已到账`}
                </p>
              </div>
              <button 
                onClick={handleCloseSuccess}
                className="ml-1 lg:ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
