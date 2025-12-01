"use client"

import { useState, Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"

type AuthMode = "login" | "register" | "forgot"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
      setError(err.message || "Google 登录失败，请重试")
      setIsGoogleLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()

      if (mode === "forgot") {
        // Send password reset email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
        })
        
        if (error) throw error
        
        setMessage("重置密码邮件已发送，请查收您的邮箱")
        setIsLoading(false)
        return
      }

      if (mode === "register") {
        // Sign up with email
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          },
        })
        
        if (error) throw error
        
        setMessage("注册成功！请查收验证邮件完成注册")
        setIsLoading(false)
        return
      }

      // Sign in with email
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Successful login, redirect
      router.push(redirectTo)
    } catch (err: any) {
      console.error("Email auth error:", err)
      
      // Translate common error messages
      let errorMessage = err.message
      if (err.message.includes("Invalid login credentials")) {
        errorMessage = "邮箱或密码错误"
      } else if (err.message.includes("Email not confirmed")) {
        errorMessage = "请先验证您的邮箱"
      } else if (err.message.includes("User already registered")) {
        errorMessage = "该邮箱已注册，请直接登录"
      } else if (err.message.includes("Password should be at least")) {
        errorMessage = "密码至少需要 6 个字符"
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] bg-cover" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/logo.png"
            alt="Brand Camera"
            width={64}
            height={64}
            className="mb-3"
          />
          <h1 className="text-2xl font-bold text-zinc-900">品牌相机</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "login" && "登录您的账号"}
            {mode === "register" && "创建新账号"}
            {mode === "forgot" && "重置密码"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {message}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 pl-11 pr-4 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password Input - hide for forgot password mode */}
          {mode !== "forgot" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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
          )}

          {/* Forgot Password Link - only show in login mode */}
          {mode === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-sm text-blue-600 hover:underline"
              >
                忘记密码？
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {mode === "login" && "登录"}
                {mode === "register" && "注册"}
                {mode === "forgot" && "发送重置邮件"}
              </>
            )}
          </button>
        </form>

        {/* Mode Switch */}
        <div className="mt-4 text-center text-sm text-zinc-600">
          {mode === "login" && (
            <>
              还没有账号？{" "}
              <button
                onClick={() => switchMode("register")}
                className="text-blue-600 font-medium hover:underline"
              >
                立即注册
              </button>
            </>
          )}
          {mode === "register" && (
            <>
              已有账号？{" "}
              <button
                onClick={() => switchMode("login")}
                className="text-blue-600 font-medium hover:underline"
              >
                立即登录
              </button>
            </>
          )}
          {mode === "forgot" && (
            <button
              onClick={() => switchMode("login")}
              className="text-blue-600 font-medium hover:underline"
            >
              返回登录
            </button>
          )}
        </div>

        {/* Divider */}
        {mode !== "forgot" && (
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-sm text-zinc-400">或</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>
        )}

        {/* Google Login Button */}
        {mode !== "forgot" && (
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
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>使用 Google 账号</span>
              </>
            )}
          </button>
        )}

        {/* Terms */}
        <p className="mt-6 text-xs text-zinc-400 text-center">
          {mode === "register" ? "注册" : "登录"}即表示您同意我们的
          <a href="#" className="text-blue-600 hover:underline">服务条款</a>
          和
          <a href="#" className="text-blue-600 hover:underline">隐私政策</a>
        </p>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-white/60 text-sm">
        © 2024 品牌相机. All rights reserved.
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
