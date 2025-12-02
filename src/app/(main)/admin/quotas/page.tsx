"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw, Search, Edit2, Check, X, Plus, Minus, Users } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"

interface UserQuota {
  id: string
  userId: string
  userEmail: string
  totalQuota: number
  usedCount: number
  remainingQuota: number
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
    setEditValue(quota.totalQuota)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditValue(0)
  }

  const handleEditSave = async (userId: string) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, totalQuota: editValue }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quota')
      }
      
      const data = await response.json()
      if (data.success) {
        setQuotas(quotas.map(q => 
          q.userId === userId 
            ? { ...q, totalQuota: data.quota.totalQuota, remainingQuota: data.quota.remainingQuota }
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

  const handleQuickAdjust = async (userId: string, currentQuota: number, delta: number) => {
    const newQuota = Math.max(0, currentQuota + delta)
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, totalQuota: newQuota }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update quota')
      }
      
      const data = await response.json()
      if (data.success) {
        setQuotas(quotas.map(q => 
          q.userId === userId 
            ? { ...q, totalQuota: data.quota.totalQuota, remainingQuota: data.quota.remainingQuota }
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
            {filteredQuotas.map((quota) => (
              <div key={quota.id} className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 truncate">{quota.userEmail}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      更新于 {new Date(quota.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>已使用 {quota.usedCount}</span>
                    <span>剩余 {quota.remainingQuota}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        quota.remainingQuota <= 0 
                          ? 'bg-red-500' 
                          : quota.remainingQuota <= 5 
                            ? 'bg-amber-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((quota.usedCount / quota.totalQuota) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                
                {/* Quota adjustment */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    总额度: 
                  </span>
                  
                  {editingId === quota.userId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 h-8 px-2 border border-zinc-200 rounded text-center text-sm"
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
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuickAdjust(quota.userId, quota.totalQuota, -10)}
                        disabled={isSaving || quota.totalQuota < 10}
                        className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditStart(quota)}
                        className="min-w-[60px] h-8 px-3 bg-blue-50 text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-100"
                      >
                        {quota.totalQuota}
                      </button>
                      <button
                        onClick={() => handleQuickAdjust(quota.userId, quota.totalQuota, 10)}
                        disabled={isSaving}
                        className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center hover:bg-zinc-200 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

