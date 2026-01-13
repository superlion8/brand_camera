"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw, Search, Check, X, Plus, Minus, Users, Gift, Crown, ShoppingCart, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"

interface CreditsDetail {
  available: number
  daily: number
  subscription: number
  signup: number
  adminGive: number
  purchased: number
  dailyExpired?: boolean
}

interface UserQuota {
  id: string
  userId: string
  userEmail: string
  totalQuota: number
  usedCount: number
  remainingQuota: number
  credits?: CreditsDetail
  createdAt: string
  updatedAt: string
}

export default function AdminQuotasPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [quotas, setQuotas] = useState<UserQuota[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchQuotas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/quotas')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/')
          return
        }
        throw new Error('Failed to fetch quotas')
      }
      const data = await response.json()
      setQuotas(data.quotas || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchQuotas()
  }, [fetchQuotas])

  const handleEditStart = (quota: UserQuota) => {
    setEditingId(quota.userId)
    // 编辑的是 adminGive 而不是 totalQuota
    setEditValue(quota.credits?.adminGive || 0)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditValue(0)
  }

  const handleEditSave = async (userId: string) => {
    setIsSaving(true)
    try {
      // 直接设置 adminGiveCredits
      const response = await fetch('/api/admin/quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminGiveCredits: editValue }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quota')
      }
      
      const data = await response.json()
      if (data.success) {
        setQuotas(quotas.map(q => 
          q.userId === userId 
            ? { ...q, totalQuota: data.quota.totalQuota, remainingQuota: data.quota.remainingQuota, credits: data.quota.credits }
            : q
        ))
        setEditingId(null)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // 调整赠送额度 (adminGiveCredits)
  const handleQuickAdjust = async (userId: string, currentAdminGive: number, delta: number) => {
    const newAdminGive = Math.max(0, currentAdminGive + delta)
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminGiveCredits: newAdminGive }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quota')
      }
      
      const data = await response.json()
      if (data.success) {
        setQuotas(quotas.map(q => 
          q.userId === userId 
            ? { ...q, totalQuota: data.quota.totalQuota, remainingQuota: data.quota.remainingQuota, credits: data.quota.credits }
            : q
        ))
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredQuotas = quotas.filter(q => 
    q.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate totals
  const totalUsers = quotas.length
  const totalQuotaSum = quotas.reduce((sum, q) => sum + q.totalQuota, 0)
  const totalUsedSum = quotas.reduce((sum, q) => sum + q.usedCount, 0)

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">用户额度管理</h1>
          </div>
          <button
            onClick={fetchQuotas}
            disabled={isLoading}
            className="w-10 h-10 -mr-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Stats */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalUsers}</p>
            <p className="text-xs text-zinc-500">总用户数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{totalQuotaSum}</p>
            <p className="text-xs text-zinc-500">总额度</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{totalUsedSum}</p>
            <p className="text-xs text-zinc-500">已使用</p>
          </div>
        </div>
        
        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索用户邮箱..."
              className="w-full h-10 pl-10 pr-4 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">
            <p>{error}</p>
            <button onClick={fetchQuotas} className="mt-4 text-blue-600">重试</button>
          </div>
        ) : filteredQuotas.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>暂无用户数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuotas.map((quota) => {
              const credits = quota.credits
              const isExpanded = expandedId === quota.userId
              
              return (
                <div key={quota.id} className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
                  {/* Main Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 truncate">{quota.userEmail}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          更新于 {new Date(quota.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Expand button */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : quota.userId)}
                        className="ml-2 w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    {/* Credits Summary - Quick view */}
                    {credits && (
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        <div className="text-center p-2 bg-emerald-50 rounded-lg">
                          <p className="text-lg font-bold text-emerald-600">{credits.signup}</p>
                          <p className="text-[10px] text-emerald-600/70">注册</p>
                        </div>
                        <div className="text-center p-2 bg-pink-50 rounded-lg">
                          <p className={`text-lg font-bold ${credits.dailyExpired ? 'text-zinc-400' : 'text-pink-600'}`}>{credits.daily}</p>
                          <p className="text-[10px] text-pink-600/70">签到</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded-lg">
                          <p className="text-lg font-bold text-purple-600">{credits.adminGive}</p>
                          <p className="text-[10px] text-purple-600/70">赠送</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 rounded-lg">
                          <p className="text-lg font-bold text-amber-600">{credits.purchased}</p>
                          <p className="text-[10px] text-amber-600/70">购买</p>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded-lg">
                          <p className="text-lg font-bold text-blue-600">{credits.subscription}</p>
                          <p className="text-[10px] text-blue-600/70">订阅</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Usage Stats & Adjustment */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                      {/* Left: Usage info */}
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-zinc-400">已用</span>
                          <p className="text-base font-semibold text-red-500">{quota.usedCount}</p>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-400">剩余</span>
                          <p className="text-base font-semibold text-green-600">{quota.remainingQuota}</p>
                        </div>
                      </div>
                      
                      {/* Right: Admin give adjustment */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">调整赠送</span>
                        {editingId === quota.userId ? (
                          <>
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 h-8 px-2 border border-purple-300 rounded text-center text-sm bg-purple-50"
                              min={0}
                            />
                            <button
                              onClick={() => handleEditSave(quota.userId)}
                              disabled={isSaving}
                              className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-200"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleEditCancel}
                              className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center hover:bg-zinc-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleQuickAdjust(quota.userId, credits?.adminGive || 0, -10)}
                              disabled={isSaving || (credits?.adminGive || 0) < 10}
                              className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditStart(quota)}
                              className="min-w-[50px] h-8 px-3 bg-purple-50 text-purple-600 rounded-lg font-medium text-sm hover:bg-purple-100"
                            >
                              {credits?.adminGive || 0}
                            </button>
                            <button
                              onClick={() => handleQuickAdjust(quota.userId, credits?.adminGive || 0, 10)}
                              disabled={isSaving}
                              className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && credits && (
                    <div className="px-4 pb-4 pt-2 bg-zinc-50 border-t border-zinc-100">
                      <p className="text-xs font-medium text-zinc-500 mb-3">额度明细</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                              <Gift className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <span className="text-sm text-zinc-700">注册奖励</span>
                          </div>
                          <span className="font-semibold text-emerald-600">{credits.signup}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            </div>
                            <span className="text-sm text-zinc-700">管理员赠送</span>
                          </div>
                          <span className="font-semibold text-purple-600">{credits.adminGive}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                              <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <span className="text-sm text-zinc-700">购买额度</span>
                          </div>
                          <span className="font-semibold text-amber-600">{credits.purchased}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                              <Crown className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <span className="text-sm text-zinc-700">订阅额度</span>
                          </div>
                          <span className="font-semibold text-blue-600">{credits.subscription}</span>
                        </div>
                        {credits.daily > 0 && (
                          <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                                <Gift className="w-3.5 h-3.5 text-pink-600" />
                              </div>
                              <span className="text-sm text-zinc-700">每日签到</span>
                              {credits.dailyExpired && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-200 text-zinc-500 rounded">已过期</span>
                              )}
                            </div>
                            <span className={`font-semibold ${credits.dailyExpired ? 'text-zinc-400 line-through' : 'text-pink-600'}`}>
                              {credits.daily}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

