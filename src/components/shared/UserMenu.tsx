"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/components/providers/AuthProvider"
import { LogOut, User, Settings, ChevronDown } from "lucide-react"

export function UserMenu() {
  const { user, signOut, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
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
                // Navigate to profile/settings if needed
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">个人资料</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                // Navigate to settings if needed
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors text-left"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">设置</span>
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
  )
}

