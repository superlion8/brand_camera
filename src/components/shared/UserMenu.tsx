"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/components/providers/AuthProvider"
import { useSettingsStore } from "@/stores/settingsStore"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation, useLanguageStore } from "@/stores/languageStore"
import { LogOut, Settings, ChevronDown, ChevronRight, X, Bug, Cloud, RefreshCw, BarChart3, Gauge, Inbox, FolderOpen, User, Globe, CreditCard, MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// Language options
const LANGUAGES = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

export function UserMenu() {
  const router = useRouter()
  const { user, signOut, isLoading, isSyncing } = useAuth()
  const storeSyncing = useAssetStore(state => state.isSyncing)
  const lastSyncAt = useAssetStore(state => state.lastSyncAt)
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguageStore()
  const debugMode = useSettingsStore(state => state.debugMode)
  const toggleDebugMode = useSettingsStore(state => state.toggleDebugMode)
  const [isOpen, setIsOpen] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingApplications, setPendingApplications] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch pending applications count for admin
  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '')
  
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/quota-applications?status=pending')
        .then(res => res.json())
        .then(data => {
          if (data.pendingCount !== undefined) {
            setPendingApplications(data.pendingCount)
          }
        })
        .catch(() => {})
    }
  }, [isAdmin])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowLanguageMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full bg-zinc-200 animate-pulse" />
    )
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push('/login')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
      >
        {t.user.pleaseLogin}
      </button>
    )
  }

  const avatarUrl = user.user_metadata?.avatar_url
  const phone = user.user_metadata?.phone as string | undefined
  const isPhoneUser = !!phone || user.email?.startsWith('sms_')
  
  // 手机用户显示手机号，其他用户显示名字或邮箱前缀
  const displayName = phone 
    ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') // 隐藏中间4位
    : user.user_metadata?.full_name || user.email?.split("@")[0] || "用户"
  
  // 副标题：手机用户显示"手机号登录"，其他显示邮箱
  const subtitle = isPhoneUser ? (phone || '手机号登录') : user.email

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0]

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => {
            setIsOpen(!isOpen)
            setShowLanguageMenu(false)
          }}
          className="flex items-center gap-2 p-1.5 rounded-full hover:bg-zinc-100 transition-colors"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={36}
              height={36}
              className="rounded-full"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden z-50"
            >
              {/* User Info */}
              <div className="p-4 border-b border-zinc-100">
                <div className="flex flex-col items-center text-center">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={64}
                      height={64}
                      className="rounded-full mb-3"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl mb-3">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="font-semibold text-zinc-900">{displayName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                {/* View Profile */}
                <button
                  onClick={() => {
                    setIsOpen(false)
                    // TODO: Navigate to profile page
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm">{t.user?.viewProfile || 'View profile'}</span>
                </button>

                {/* Language - with submenu */}
                <div className="relative">
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                  >
                    <Globe className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm flex-1">{t.user?.language || 'Language'}</span>
                    <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${showLanguageMenu ? 'rotate-90' : ''}`} />
                  </button>
                  
                  {/* Language Submenu */}
                  <AnimatePresence>
                    {showLanguageMenu && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-10 pr-2 pb-1">
                          {LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                setLanguage(lang.code as 'zh' | 'en' | 'ko')
                                setShowLanguageMenu(false)
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                language === lang.code 
                                  ? 'bg-purple-50 text-purple-700' 
                                  : 'text-zinc-600 hover:bg-zinc-50'
                              }`}
                            >
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                              {language === lang.code && (
                                <span className="ml-auto text-purple-500">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Subscription */}
                <Link
                  href="/pricing"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                >
                  <CreditCard className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm">{t.user?.subscription || 'Subscription'}</span>
                </Link>

                {/* Join our Discord */}
                <a
                  href="https://discord.gg/brandcamera"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                >
                  <MessageCircle className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm">{t.user?.joinDiscord || 'Join our Discord'}</span>
                </a>

                {/* Admin Dashboard - only for admin users */}
                {isAdmin && (
                  <div className="pt-2 mt-2 border-t border-zinc-100">
                    <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase">Admin</p>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                    >
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Admin 看板</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin/quotas')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                    >
                      <Gauge className="w-4 h-4 text-amber-500" />
                      <span className="text-sm">管理用户额度</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin/applications')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                    >
                      <Inbox className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">额度申请</span>
                      {pendingApplications > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {pendingApplications}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin/presets')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                    >
                      <FolderOpen className="w-4 h-4 text-green-500" />
                      <span className="text-sm">资源管理</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Sign Out */}
              <div className="p-2 border-t border-zinc-100">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    signOut()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">{t.user.logout}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
