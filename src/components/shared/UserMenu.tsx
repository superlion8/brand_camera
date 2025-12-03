"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/components/providers/AuthProvider"
import { useSettingsStore } from "@/stores/settingsStore"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { LogOut, Settings, ChevronDown, X, Bug, Cloud, RefreshCw, BarChart3, Gauge, Inbox } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export function UserMenu() {
  const router = useRouter()
  const { user, signOut, isLoading, isSyncing } = useAuth()
  const storeSyncing = useAssetStore(state => state.isSyncing)
  const lastSyncAt = useAssetStore(state => state.lastSyncAt)
  const { t } = useTranslation()
  const debugMode = useSettingsStore(state => state.debugMode)
  const toggleDebugMode = useSettingsStore(state => state.toggleDebugMode)
  const [isOpen, setIsOpen] = useState(false)
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
    return null
  }

  const avatarUrl = user.user_metadata?.avatar_url
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "用户"

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
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
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden z-50">
            {/* User Info */}
            <div className="p-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 truncate">{displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>
              {/* Sync Status */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                {(isSyncing || storeSyncing) ? (
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {t.user.syncing}
                  </span>
                ) : lastSyncAt ? (
                  <span className="flex items-center gap-1.5 text-green-600">
                    <Cloud className="w-3 h-3" />
                    {t.user.synced}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {/* Admin Dashboard - only for admin users */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/admin')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Admin 看板</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/admin/quotas')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                  >
                    <Gauge className="w-4 h-4 text-amber-500" />
                    <span className="text-sm">管理用户额度</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/admin/applications')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
                  >
                    <Inbox className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">额度申请</span>
                    {pendingApplications > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {pendingApplications}
                      </span>
                    )}
                  </button>
                </>
              )}
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowSettings(true)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">{t.user.settings}</span>
                {debugMode && (
                  <Bug className="w-3 h-3 text-amber-500 ml-auto" />
                )}
              </button>
            </div>

            {/* Sign Out */}
            <div className="p-2 border-t border-zinc-100">
              <button
                onClick={() => {
                  setIsOpen(false)
                  signOut()
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">{t.user.logout}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-[101] overflow-hidden safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="h-14 flex items-center justify-between px-4 border-b">
                <h2 className="font-semibold text-zinc-900">{t.user.settings}</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              {/* Settings Content */}
              <div className="p-4 space-y-4">
                {/* Debug Mode Toggle - Only visible to admins */}
                {isAdmin ? (
                  <>
                    <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${debugMode ? 'bg-amber-100' : 'bg-zinc-200'}`}>
                          <Bug className={`w-5 h-5 ${debugMode ? 'text-amber-600' : 'text-zinc-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 text-sm">{t.user.debugMode}</p>
                          <p className="text-xs text-zinc-500">{t.user.debugModeDesc}</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleDebugMode}
                        className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ml-3 ${
                          debugMode ? 'bg-amber-500' : 'bg-zinc-300'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                            debugMode ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Debug Mode Description */}
                    {debugMode && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs text-amber-700">
                          <strong>{t.user.debugModeEnabled}</strong><br />
                          {t.user.debugModeEnabledDesc}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-zinc-50 rounded-xl text-center">
                    <p className="text-sm text-zinc-500">暂无可配置项</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 pb-8 border-t bg-zinc-50">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  {t.common.done}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

