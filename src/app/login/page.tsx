"use client"

import { useState, Suspense, useMemo } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { validateRedirectClient } from "@/lib/utils/redirect"
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useLanguageStore } from "@/stores/languageStore"

type AuthMode = "select" | "email-otp" | "email-password" | "verify-otp"

function LoginContent() {
  const t = useLanguageStore(state => state.translations)
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
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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

  // Send OTP verification code
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Auto create user if not exists
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
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

  // Verify OTP code
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

  // Email + Password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Use full page reload to ensure cookies are synced
      window.location.href = redirectTo
    } catch (err: any) {
      console.error("Password login error:", err)
      
      let errorMessage = err.message
      if (err.message.includes("Invalid login credentials")) {
        errorMessage = t.errors.invalidCredentials || "邮箱或密码错误"
      } else if (err.message.includes("Email not confirmed")) {
        errorMessage = t.errors.emailNotConfirmed || "请先验证您的邮箱"
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const resetState = () => {
    setError(null)
    setMessage(null)
    setOtpCode("")
  }

  const goBack = () => {
    if (mode === "verify-otp") {
      setMode("email-otp")
    } else {
      setMode("select")
    }
    resetState()
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
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "select" && t.login.selectMethod}
            {mode === "email-otp" && t.login.emailOtp}
            {mode === "email-password" && t.login.emailPassword}
            {mode === "verify-otp" && t.login.enterCode}
          </p>
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
            {/* Google Login */}
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
              <span className="text-sm text-zinc-400">{t.login.and}</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>

            {/* Email OTP Login */}
            <button
              onClick={() => { setMode("email-otp"); resetState(); }}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>{t.login.emailOtp}</span>
            </button>

            {/* Email Password Login */}
            <button
              onClick={() => { setMode("email-password"); resetState(); }}
              className="w-full h-12 bg-white border border-zinc-200 rounded-lg font-medium text-zinc-700 flex items-center justify-center gap-3 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              <Lock className="w-5 h-5" />
              <span>{t.login.emailPassword}</span>
            </button>
          </div>
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

        {/* Email Password Login */}
        {mode === "email-password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t.login.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 pl-11 pr-12 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
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
                t.login.login
              )}
            </button>

            <p className="text-xs text-zinc-500 text-center">
              {t.login.newUserHint}
            </p>
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
