'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Mail, ArrowLeft, Smartphone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguageStore } from '@/stores/languageStore'

type AuthMode = 'select' | 'email-otp' | 'verify-otp' | 'phone-sms' | 'verify-sms'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

// 检测是否在 WebView 中
function isWebView(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('micromessenger') ||
    ua.includes('weibo') ||
    ua.includes('qq/') ||
    ua.includes('mqqbrowser') ||
    ua.includes('alipay') ||
    ua.includes('dingtalk') ||
    ua.includes('toutiao') ||
    ua.includes('bytedance') ||
    (ua.includes('wv') && ua.includes('android')) ||
    (ua.includes('iphone') && !ua.includes('safari'))
  )
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const t = useLanguageStore(state => state.t)
  
  const [mode, setMode] = useState<AuthMode>('select')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [inWebView, setInWebView] = useState(false)
  const [isChina, setIsChina] = useState(false)
  const [smsCountdown, setSmsCountdown] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (open) {
      setInWebView(isWebView())
      fetch('/api/geo')
        .then(res => res.json())
        .then(data => setIsChina(data.isChina === true))
        .catch(() => {
          const lang = navigator.language || ''
          setIsChina(lang.toLowerCase().includes('zh-cn'))
        })
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setMode('select')
      setEmail('')
      setPhone('')
      setOtpCode('')
      setSmsCode('')
      setError(null)
      setMessage(null)
    }
  }, [open])

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const currentPath = window.location.pathname
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(currentPath)}`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error('Google login error:', err)
      setError(err.message || t.errors?.loginFailed || 'Login failed')
      setIsGoogleLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setMessage(t.login?.codeSent || 'Code sent!')
      setMode('verify-otp')
    } catch (err: any) {
      console.error('Send OTP error:', err)
      setError(err.message || t.errors?.codeSendFailed || 'Failed to send code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      })
      if (error) throw error
      // Success - close modal and trigger callback
      onClose()
      onSuccess?.()
    } catch (err: any) {
      console.error('Verify OTP error:', err)
      let errorMessage = err.message
      if (err.message.includes('Token has expired')) {
        errorMessage = t.errors?.codeExpired || 'Code expired'
      } else if (err.message.includes('Invalid')) {
        errorMessage = t.errors?.invalidCode || 'Invalid code'
      }
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed')
      setMessage(t.login?.smsSent || 'Code sent!')
      setMode('verify-sms')
      setSmsCountdown(60)
      countdownRef.current = setInterval(() => {
        setSmsCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      console.error('Send SMS error:', err)
      setError(err.message || t.errors?.smsSendFailed || 'Failed to send code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifySMS = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: smsCode }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed')
      if (data.email && data.password) {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (signInError) throw new Error('Login failed')
        // Success
        onClose()
        onSuccess?.()
        return
      }
      throw new Error('Login failed')
    } catch (err: any) {
      console.error('Verify SMS error:', err)
      setError(err.message || t.errors?.smsVerifyFailed || 'Verification failed')
      setIsLoading(false)
    }
  }

  const resetState = () => {
    setError(null)
    setMessage(null)
    setOtpCode('')
    setSmsCode('')
  }

  const goBack = () => {
    if (mode === 'verify-otp') setMode('email-otp')
    else if (mode === 'verify-sms') setMode('phone-sms')
    else setMode('select')
    resetState()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="BrandCam" width={28} height={28} className="rounded-lg" />
              <span className="font-semibold text-zinc-900">BrandCam</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Back Button */}
            <AnimatePresence>
              {mode !== 'select' && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={goBack}
                  className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-sm font-medium">{t.common?.back || 'Back'}</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900">
                {mode === 'select' && (t.login?.loginToContinue || 'Login to Continue')}
                {mode === 'email-otp' && (t.login?.emailOtp || 'Email Login')}
                {mode === 'verify-otp' && (t.login?.enterCode || 'Enter Code')}
                {mode === 'phone-sms' && (t.login?.phoneSms || 'Phone Login')}
                {mode === 'verify-sms' && (t.login?.enterSmsCode || 'Enter Code')}
              </h2>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-green-600 text-sm"
                >
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Select Mode */}
            <AnimatePresence mode="wait">
              {mode === 'select' && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* WebView Warning */}
                  {inWebView && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm">
                      <p className="font-medium">🔒 {t.login?.webViewWarning || 'Opening in App'}</p>
                      <p className="text-xs text-amber-600 mt-1">
                        {t.login?.webViewTip || 'Please use email or phone to sign in'}
                      </p>
                    </div>
                  )}

                  {/* Phone SMS Login - China only */}
                  {isChina && (
                    <button
                      onClick={() => { setMode('phone-sms'); resetState() }}
                      className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <Smartphone className="w-5 h-5" />
                      <span>{t.login?.phoneSms || '手机号登录'}</span>
                    </button>
                  )}

                  {/* Google Login */}
                  {!inWebView && (
                    <>
                      {isChina && (
                        <div className="flex items-center gap-4 py-1">
                          <div className="flex-1 h-px bg-zinc-200" />
                          <span className="text-xs text-zinc-400">{t.login?.or || 'or'}</span>
                          <div className="flex-1 h-px bg-zinc-200" />
                        </div>
                      )}

                      <button
                        onClick={handleGoogleLogin}
                        disabled={isGoogleLoading}
                        className="w-full h-12 bg-white border-2 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isGoogleLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>{t.login?.useGoogle || 'Continue with Google'}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Email OTP Login */}
                  <button
                    onClick={() => { setMode('email-otp'); resetState() }}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Mail className="w-5 h-5" />
                    <span>{t.login?.emailOtp || 'Continue with Email'}</span>
                  </button>
                </motion.div>
              )}

              {/* Phone SMS - Step 1 */}
              {mode === 'phone-sms' && (
                <motion.form
                  key="phone-sms"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSendSMS}
                  className="space-y-4"
                >
                  <div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">+86</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="138 0000 0000"
                        required
                        autoFocus
                        maxLength={11}
                        className="w-full h-12 pl-14 pr-4 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || phone.length !== 11}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>{t.login?.getSmsCode || 'Get Code'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* Phone SMS - Step 2 */}
              {mode === 'verify-sms' && (
                <motion.form
                  key="verify-sms"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifySMS}
                  className="space-y-4"
                >
                  <p className="text-sm text-zinc-500 text-center">
                    {t.login?.smsSentTo || 'Code sent to'} <span className="text-zinc-900 font-semibold">+86 {phone}</span>
                  </p>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full h-14 text-center text-2xl font-mono tracking-[0.5em] bg-zinc-50 border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || smsCode.length !== 6}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login?.verifyAndLogin || 'Verify & Sign In')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendSMS}
                    disabled={isLoading || smsCountdown > 0}
                    className="w-full text-sm text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50 font-medium"
                  >
                    {smsCountdown > 0 ? `${t.login?.resendAfter || 'Resend'} (${smsCountdown}s)` : (t.login?.resendSmsCode || 'Resend Code')}
                  </button>
                </motion.form>
              )}

              {/* Email OTP - Step 1 */}
              {mode === 'email-otp' && (
                <motion.form
                  key="email-otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSendOTP}
                  className="space-y-4"
                >
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoFocus
                        className="w-full h-12 pl-12 pr-4 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>{t.login?.sendCode || 'Send Code'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* Email OTP - Step 2 */}
              {mode === 'verify-otp' && (
                <motion.form
                  key="verify-otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-4"
                >
                  <p className="text-sm text-zinc-500 text-center">
                    {t.login?.codeSent || 'Code sent to'} <span className="text-zinc-900 font-semibold">{email}</span>
                  </p>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full h-14 text-center text-2xl font-mono tracking-[0.5em] bg-zinc-50 border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || otpCode.length !== 6}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login?.verifyAndLogin || 'Verify & Sign In')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isLoading}
                    className="w-full text-sm text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50 font-medium"
                  >
                    {t.login?.resendCode || 'Resend Code'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
