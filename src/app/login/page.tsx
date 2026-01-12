"use client"

import { useState, Suspense, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { validateRedirectClient } from "@/lib/utils/redirect"
import { Loader2, Mail, ArrowLeft, Phone, Smartphone, Sparkles } from "lucide-react"
import { useLanguageStore } from "@/stores/languageStore"
import { motion, AnimatePresence } from "framer-motion"

type AuthMode = "select" | "email-otp" | "verify-otp" | "phone-sms" | "verify-sms"

// 检测是否在 WebView 中（微信、微博、QQ 等 App 内置浏览器）
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

function LoginContent() {
  const t = useLanguageStore(state => state.t)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = useMemo(() => {
    const rawRedirect = searchParams.get("redirect")
    return validateRedirectClient(rawRedirect, "/")
  }, [searchParams])
  const urlError = searchParams.get("error")
  
  const [mode, setMode] = useState<AuthMode>("select")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [smsCode, setSmsCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [inWebView, setInWebView] = useState(false)
  const [isChina, setIsChina] = useState(false)
  const [smsCountdown, setSmsCountdown] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    setInWebView(isWebView())
    fetch('/api/geo')
      .then(res => res.json())
      .then(data => setIsChina(data.isChina === true))
      .catch(() => {
        const lang = navigator.language || ''
        setIsChina(lang.toLowerCase().includes('zh-cn'))
      })
  }, [])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error("Google login error:", err)
      setError(err.message || t.errors.loginFailed)
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
      setMessage(t.login.codeSent)
      setMode("verify-otp")
    } catch (err: any) {
      console.error("Send OTP error:", err)
      setError(err.message || t.errors.codeSendFailed)
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
        type: "email",
      })
      if (error) throw error
      window.location.href = redirectTo
    } catch (err: any) {
      console.error("Verify OTP error:", err)
      let errorMessage = err.message
      if (err.message.includes("Token has expired")) {
        errorMessage = t.errors.codeExpired || "验证码已过期，请重新获取"
      } else if (err.message.includes("Invalid")) {
        errorMessage = t.errors.invalidCode || "验证码错误，请重新输入"
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
      if (!response.ok || !data.success) throw new Error(data.error || '发送失败')
      setMessage(t.login.smsSent || '验证码已发送')
      setMode("verify-sms")
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
      console.error("Send SMS error:", err)
      setError(err.message || t.errors.smsSendFailed || '发送失败')
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
      if (!response.ok || !data.success) throw new Error(data.error || '验证失败')
      if (data.email && data.password) {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (signInError) throw new Error('登录失败，请重试')
        setMessage('登录成功，正在跳转...')
        setTimeout(() => { window.location.href = redirectTo }, 500)
        return
      }
      throw new Error('登录失败，请重试')
    } catch (err: any) {
      console.error("Verify SMS error:", err)
      setError(err.message || t.errors.smsVerifyFailed || '验证失败')
      setIsLoading(false)
    }
  }

  const resetState = () => {
    setError(null)
    setMessage(null)
    setOtpCode("")
    setSmsCode("")
  }

  const goBack = () => {
    if (mode === "verify-otp") setMode("email-otp")
    else if (mode === "verify-sms") setMode("phone-sms")
    else setMode("select")
    resetState()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top-left glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-500/20 rounded-full blur-[120px]" />
        {/* Bottom-right glow */}
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]" />
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 mb-4 shadow-lg shadow-violet-500/25"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white tracking-tight"
          >
            {t.login.title}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-500 mt-2"
          >
            {mode === "select" && (t.login.selectMethod || "Choose how to sign in")}
            {mode === "email-otp" && (t.login.emailOtp || "Sign in with email")}
            {mode === "verify-otp" && (t.login.enterCode || "Enter verification code")}
            {mode === "phone-sms" && (t.login.phoneSms || "Sign in with phone")}
            {mode === "verify-sms" && (t.login.enterSmsCode || "Enter SMS code")}
          </motion.p>
        </div>

        {/* Login Card */}
        <motion.div 
          layout
          className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black/50"
        >
          {/* Back Button */}
          <AnimatePresence>
            {mode !== "select" && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={goBack}
                className="mb-4 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm">{t.common?.back || 'Back'}</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {(error || urlError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
              >
                {error || urlError}
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
                className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Select Mode */}
          <AnimatePresence mode="wait">
            {mode === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {/* WebView Warning */}
                {inWebView && (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
                    <p className="font-medium">🔒 {t.login.webViewWarning || 'Opening in App'}</p>
                    <p className="text-xs text-amber-500/70 mt-1">
                      {t.login.webViewTip || 'Use email or phone to sign in'}
                    </p>
                  </div>
                )}

                {/* Phone SMS Login - China only */}
                {isChina && (
                  <button
                    onClick={() => { setMode("phone-sms"); resetState(); }}
                    className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>{t.login.phoneSms || '手机号登录'}</span>
                  </button>
                )}
                
                {/* Google Login */}
                {!inWebView && (
                  <>
                    {isChina && (
                      <div className="flex items-center gap-4 py-3">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-xs text-zinc-600 uppercase tracking-wider">{t.login.or || 'or'}</span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                    )}

                    <button
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoading}
                      className="w-full h-13 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-lg shadow-black/20"
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
                          <span>{t.login.useGoogle || 'Continue with Google'}</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* Email OTP Login */}
                <button
                  onClick={() => { setMode("email-otp"); resetState(); }}
                  className="w-full h-13 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-300 border border-zinc-700 hover:border-zinc-600 hover:-translate-y-0.5"
                >
                  <Mail className="w-5 h-5" />
                  <span>{t.login.emailOtp || 'Continue with Email'}</span>
                </button>
              </motion.div>
            )}

            {/* Phone SMS - Step 1 */}
            {mode === "phone-sms" && (
              <motion.form
                key="phone-sms"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendSMS}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {t.login.phone || 'Phone Number'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">+86</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="138 0000 0000"
                      required
                      autoFocus
                      maxLength={11}
                      className="w-full h-13 pl-14 pr-4 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || phone.length !== 11}
                  className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login.getSmsCode || 'Get Code')}
                </button>
              </motion.form>
            )}

            {/* Phone SMS - Step 2 */}
            {mode === "verify-sms" && (
              <motion.form
                key="verify-sms"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifySMS}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-400 text-center">
                  {t.login.smsSentTo || 'Code sent to'} <span className="text-white font-medium">+86 {phone}</span>
                </p>
                <div>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full h-16 text-center text-2xl font-mono tracking-[0.4em] bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || smsCode.length !== 6}
                  className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login.verifyAndLogin || 'Verify & Sign In')}
                </button>
                <button
                  type="button"
                  onClick={handleSendSMS}
                  disabled={isLoading || smsCountdown > 0}
                  className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {smsCountdown > 0 ? `${t.login.resendAfter || 'Resend'} (${smsCountdown}s)` : (t.login.resendSmsCode || 'Resend Code')}
                </button>
              </motion.form>
            )}

            {/* Email OTP - Step 1 */}
            {mode === "email-otp" && (
              <motion.form
                key="email-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendOTP}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {t.login.email || 'Email'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className="w-full h-13 pl-12 pr-4 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-13 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login.sendCode || 'Send Code')}
                </button>
              </motion.form>
            )}

            {/* Email OTP - Step 2 */}
            {mode === "verify-otp" && (
              <motion.form
                key="verify-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-400 text-center">
                  {t.login.codeSent || 'Code sent to'} <span className="text-white font-medium">{email}</span>
                </p>
                <div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full h-16 text-center text-2xl font-mono tracking-[0.4em] bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full h-13 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (t.login.verifyAndLogin || 'Verify & Sign In')}
                </button>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {t.login.resendCode || 'Resend Code'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Terms */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-xs text-zinc-600 text-center"
        >
          {t.login.termsAgree || 'By continuing, you agree to our '}
          <a href="/terms" className="text-zinc-400 hover:text-white transition-colors">{t.login.terms || 'Terms'}</a>
          {t.login.and || ' and '}
          <a href="/privacy" className="text-zinc-400 hover:text-white transition-colors">{t.login.privacy || 'Privacy Policy'}</a>
        </motion.p>
      </motion.div>

      {/* Footer */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="relative z-10 mt-12 text-zinc-700 text-sm"
      >
        © 2026 {t.common?.appName || 'Brand Camera'}
      </motion.p>
    </div>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}
