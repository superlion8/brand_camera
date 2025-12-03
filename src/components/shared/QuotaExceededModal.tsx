"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, X, Send, Loader2, CheckCircle } from "lucide-react"

interface QuotaExceededModalProps {
  isOpen: boolean
  onClose: () => void
  usedCount?: number
  totalQuota?: number
  requiredCount?: number
  userEmail?: string
}

export function QuotaExceededModal({ 
  isOpen, 
  onClose,
  usedCount = 0,
  totalQuota = 30,
  requiredCount,
  userEmail = '',
}: QuotaExceededModalProps) {
  const [email, setEmail] = useState(userEmail)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const remainingQuota = Math.max(0, totalQuota - usedCount)
  const isExhausted = remainingQuota === 0
  const isInsufficient = !isExhausted && requiredCount && remainingQuota < requiredCount

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('请填写邮箱')
      return
    }
    if (!reason.trim()) {
      setError('请填写申请理由')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/quota-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          reason: reason.trim(),
          feedback: feedback.trim(),
          currentQuota: totalQuota,
          usedCount,
        }),
      })

      if (!response.ok) {
        throw new Error('提交失败')
      }

      setIsSubmitted(true)
    } catch (err) {
      setError('提交失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setIsSubmitted(false)
    setError('')
    setReason('')
    setFeedback('')
    onClose()
  }
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isSubmitted ? (
              // Success state
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2">申请已提交</h2>
                <p className="text-zinc-500 text-sm mb-6">
                  我们会尽快审核您的申请，请耐心等待
                </p>
                <button
                  onClick={handleClose}
                  className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl transition-colors"
                >
                  我知道了
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="relative p-6 pb-4 text-center">
                  <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                  
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-zinc-900 mb-2">
                    {isExhausted ? '免费额度已用尽' : '额度不足'}
                  </h2>
                  
                  <p className="text-zinc-500 text-sm">
                    {isInsufficient 
                      ? `本次操作需要 ${requiredCount} 张额度，您仅剩 ${remainingQuota} 张`
                      : `您已使用 ${usedCount}/${totalQuota} 张图片额度`
                    }
                  </p>
                </div>
                
                {/* Progress bar */}
                <div className="px-6 mb-4">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>已使用 {usedCount}</span>
                    <span>剩余 {remainingQuota}</span>
                  </div>
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
                      style={{ width: `${Math.min((usedCount / totalQuota) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-end text-xs text-zinc-400 mt-1">
                    <span>总额度 {totalQuota}</span>
                  </div>
                </div>

                {/* Application Form */}
                <div className="px-6 pb-6">
                  <div className="bg-zinc-50 rounded-xl p-4 mb-4">
                    <p className="text-zinc-600 text-sm text-center leading-relaxed mb-4">
                      填写以下信息申请更多额度
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">注册邮箱 *</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">申请理由 *</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="请简要说明您需要更多额度的原因..."
                          rows={2}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">产品反馈（选填）</label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="您对产品有什么建议或反馈？"
                          rows={2}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
                    )}
                  </div>
                  
                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        提交申请
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleClose}
                    className="w-full h-12 mt-2 text-zinc-500 hover:text-zinc-700 text-sm font-medium transition-colors"
                  >
                    暂不申请
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
