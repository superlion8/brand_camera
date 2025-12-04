"use client"

import { useState, Suspense, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { validateRedirectClient } from "@/lib/utils/redirect"
import { Loader2, Mail, ArrowLeft, Phone, Smartphone } from "lucide-react"
import { useLanguageStore } from "@/stores/languageStore"

type AuthMode = "select" | "email-otp" | "verify-otp" | "phone-sms" | "verify-sms"

// 检测是否在 WebView 中（微信、微博、QQ 等 App 内置浏览器）
function isWebView(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  // 检测常见的 WebView 标识
  return (
    ua.includes('micromessenger') ||  // 微信
    ua.includes('weibo') ||           // 微博
    ua.includes('qq/') ||             // QQ
    ua.includes('mqqbrowser') ||      // QQ 浏览器
    ua.includes('alipay') ||          // 支付宝
    ua.includes('dingtalk') ||        // 钉钉
    ua.includes('toutiao') ||         // 头条
    ua.includes('bytedance') ||       // 字节系
    // 通用 WebView 检测
    (ua.includes('wv') && ua.includes('android')) ||
    // iOS WebView
    (ua.includes('iphone') && !ua.includes('safari'))
  )
}

function LoginContent() {
  const t = useLanguageStore(state => state.t)
  const router = useRouter()
  const searchParams = useSearchParams()
  // 验证重定向URL，防止钓鱼攻击
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
  const [smsCountdown, setSmsCountdown] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  
  // 检测 WebView
  useEffect(() => {
    setInWebView(isWebView())
  }, [])

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
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
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      })

      if (error) throw error
    } catch (err: any) {
      console.error("Google login error:", err)
      setError(err.message || t.errors.loginFailed)
      setIsGoogleLoading(false)
    }
  }

  // Send OTP verification code (Email)
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()
      
      // 注意：不要设置 emailRedirectTo，否则 Supabase 会发送 Magic Link 而不是 OTP 验证码
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Auto create user if not exists
          // 不设置 emailRedirectTo，确保发送 OTP 验证码
        },
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

  // Verify OTP code (Email)
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

      // Successful login - use full page reload to ensure cookies are synced
      // This is more reliable than router.push() for auth state
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

  // Send SMS verification code (Phone)
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

      if (!response.ok || !data.success) {
        throw new Error(data.error || '发送失败')
      }

      setMessage(t.login.smsSent || '验证码已发送')
      setMode("verify-sms")
      
      // 开始60秒倒计时
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

  // Verify SMS code and login (Phone)
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

      if (!response.ok || !data.success) {
        throw new Error(data.error || '验证失败')
      }

      // 验证成功，刷新页面以同步登录状态
      setMessage('登录成功，正在跳转...')
      
      // 短暂延迟后跳转
      setTimeout(() => {
        window.location.href = redirectTo
      }, 500)

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
    if (mode === "verify-otp") {
      setMode("email-otp")
    } else if (mode === "verify-sms") {
      setMode("phone-sms")
    } else {
      setMode("select")
    }
    resetState()
  }

  const getModeDescription = () => {
    switch (mode) {
      case "select": return t.login.selectMethod
      case "email-otp": return t.login.emailOtp
      case "verify-otp": return t.login.enterCode
      case "phone-sms": return t.login.phoneSms || '手机号登录'
      case "verify-sms": return t.login.enterSmsCode || '输入短信验证码'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] bg-cover" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Back Button */}
        {mode !== "select" && (
          <button
            onClick={goBack}
            className="absolute top-4 left-4 w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/logo.png"
            alt="Brand Camera"
            width={64}
            height={64}
            className="mb-3"
          />
          <h1 className="text-2xl font-bold text-zinc-900">{t.login.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{getModeDescription()}</p>
        </div>

        {/* Error Message */}
        {(error || urlError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error || urlError}
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {message}
          </div>
        )}

        {/* Select Mode */}
        {mode === "select" && (
          <div className="space-y-3">
            {/* WebView Warning */}
            {inWebView && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <p className="font-medium mb-1">🔒 {t.login.webViewWarning || '当前在App内打开'}</p>
                <p className="text-xs text-amber-600">
                  {t.login.webViewTip || 'Google登录需要使用系统浏览器，请使用邮箱或手机号登录'}
                </p>
              </div>
            )}
            
            {/* Google Login - Hide in WebView */}
            {!inWebView && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  className="w-full h-12 bg-white border border-zinc-200 rounded-lg font-medium text-zinc-700 flex items-center justify-center gap-3 hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                      <span>{t.login.useGoogle}</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-zinc-200" />
                  <span className="text-sm text-zinc-400">{t.login.or || '或'}</span>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>
              </>
            )}

            {/* Phone SMS Login - 优先展示（中国用户常用） */}
            <button
              onClick={() => { setMode("phone-sms"); resetState(); }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
            >
              <Smartphone className="w-5 h-5" />
              <span>{t.login.phoneSms || '手机号登录'}</span>
            </button>

            {/* Email OTP Login */}
            <button
              onClick={() => { setMode("email-otp"); resetState(); }}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>{t.login.emailOtp}</span>
            </button>
          </div>
        )}

        {/* Phone SMS - Step 1: Enter Phone Number */}
        {mode === "phone-sms" && (
          <form onSubmit={handleSendSMS} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t.login.phone || '手机号'}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">+86</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="请输入手机号"
                  required
                  autoFocus
                  maxLength={11}
                  className="w-full h-12 pl-20 pr-4 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                {t.login.phoneHint || '支持中国大陆手机号'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || phone.length !== 11}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.login.getSmsCode || '获取验证码'
              )}
            </button>
          </form>
        )}

        {/* Phone SMS - Step 2: Enter SMS Code */}
        {mode === "verify-sms" && (
          <form onSubmit={handleVerifySMS} className="space-y-4">
            <p className="text-sm text-zinc-600 text-center mb-4">
              {t.login.smsSentTo || '验证码已发送至'}: <span className="font-medium text-zinc-900">+86 {phone}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t.login.enterSmsCode || '输入验证码'}
              </label>
              <input
                type="text"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t.login.smsCodePlaceholder || '6位验证码'}
                required
                autoFocus
                maxLength={6}
                className="w-full h-14 text-center text-2xl font-mono tracking-[0.5em] border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || smsCode.length !== 6}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.login.verifyAndLogin || '验证并登录'
              )}
            </button>

            <button
              type="button"
              onClick={handleSendSMS}
              disabled={isLoading || smsCountdown > 0}
              className="w-full text-sm text-green-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {smsCountdown > 0 
                ? `${t.login.resendAfter || '重新发送'} (${smsCountdown}s)` 
                : (t.login.resendSmsCode || '重新发送验证码')
              }
            </button>
          </form>
        )}

        {/* Email OTP - Step 1: Enter Email */}
        {mode === "email-otp" && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t.login.email}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="w-full h-12 pl-11 pr-4 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.login.sendCode
              )}
            </button>
          </form>
        )}

        {/* Email OTP - Step 2: Enter Code */}
        {mode === "verify-otp" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-sm text-zinc-600 text-center mb-4">
              {t.login.codeSent}: <span className="font-medium text-zinc-900">{email}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t.login.enterCode}
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t.login.codePlaceholder}
                required
                autoFocus
                maxLength={6}
                className="w-full h-14 text-center text-2xl font-mono tracking-[0.5em] border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.login.verifyAndLogin
              )}
            </button>

            <button
              type="button"
              onClick={handleSendOTP}
              disabled={isLoading}
              className="w-full text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {t.login.resendCode}
            </button>
          </form>
        )}

        {/* Terms */}
        <p className="mt-6 text-xs text-zinc-400 text-center">
          {t.login.termsAgree}
          <a href="#" className="text-blue-600 hover:underline">{t.login.terms}</a>
          {t.login.and}
          <a href="#" className="text-blue-600 hover:underline">{t.login.privacy}</a>
        </p>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-white/60 text-sm">
        © 2024 {t.common.appName}. All rights reserved.
      </p>
    </div>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
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
