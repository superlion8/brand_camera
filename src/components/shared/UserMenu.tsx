"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/components/providers/AuthProvider"
import { useSettingsStore } from "@/stores/settingsStore"
import { LogOut, Settings, ChevronDown, X, Bug } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function UserMenu() {
  const { user, signOut, isLoading } = useAuth()
  const { debugMode, toggleDebugMode } = useSettingsStore()
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowSettings(true)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">设置</span>
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
                <span className="text-sm">退出登录</span>
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
                <h2 className="font-semibold text-zinc-900">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              {/* Settings Content */}
              <div className="p-4 space-y-4">
                {/* Debug Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${debugMode ? 'bg-amber-100' : 'bg-zinc-200'}`}>
                      <Bug className={`w-5 h-5 ${debugMode ? 'text-amber-600' : 'text-zinc-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 text-sm">调试模式</p>
                      <p className="text-xs text-zinc-500">显示图片生成参数</p>
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
                      <strong>调试模式已开启</strong><br />
                      在图片详情页面将显示生成参数、Prompt 等技术信息。
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 pb-8 border-t bg-zinc-50">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

