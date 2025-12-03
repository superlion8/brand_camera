"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  ArrowLeft, 
  Inbox, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Mail,
  MessageSquare,
  Calendar,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"

interface Application {
  id: string
  user_id: string | null
  email: string
  reason: string
  feedback: string | null
  current_quota: number
  used_count: number
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
}

export default function QuotaApplicationsPage() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [processing, setProcessing] = useState(false)
  const [newQuota, setNewQuota] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!isAdmin) {
      router.push('/')
      return
    }
    fetchApplications()
  }, [isAdmin, statusFilter])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/quota-applications?status=${statusFilter}`)
      const data = await response.json()
      if (data.applications) {
        setApplications(data.applications)
        setPendingCount(data.pendingCount)
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedApp) return
    
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/quota-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          status,
          adminNotes,
          newQuota: status === 'approved' && newQuota ? parseInt(newQuota) : null,
        }),
      })

      if (response.ok) {
        setSelectedApp(null)
        setNewQuota('')
        setAdminNotes('')
        fetchApplications()
      }
    } catch (error) {
      console.error('Error updating application:', error)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-zinc-200">
        <div className="flex items-center justify-between px-4 h-14">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">额度申请</h1>
          <button
            onClick={fetchApplications}
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex gap-2">
          {[
            { key: 'pending', label: '待处理', icon: Clock },
            { key: 'approved', label: '已批准', icon: CheckCircle },
            { key: 'rejected', label: '已拒绝', icon: XCircle },
            { key: 'all', label: '全部', icon: Inbox },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key as typeof statusFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === 'pending' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-20">
            <Inbox className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500">暂无申请</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100"
                onClick={() => {
                  setSelectedApp(app)
                  setNewQuota(String(app.current_quota + 20))
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{app.email}</p>
                      <p className="text-xs text-zinc-400">{formatDate(app.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    app.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {app.status === 'pending' ? '待处理' : app.status === 'approved' ? '已批准' : '已拒绝'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                    <p className="text-zinc-600 line-clamp-2">{app.reason}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span>当前额度: {app.current_quota}</span>
                    <span>已使用: {app.used_count}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedApp(null)}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">申请详情</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-zinc-400" />
                  <span className="text-sm">{selectedApp.email}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                  <span className="text-sm">{formatDate(selectedApp.created_at)}</span>
                </div>
                
                <div>
                  <p className="text-xs text-zinc-500 mb-1">申请理由</p>
                  <p className="text-sm bg-zinc-50 p-3 rounded-lg">{selectedApp.reason}</p>
                </div>
                
                {selectedApp.feedback && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">产品反馈</p>
                    <p className="text-sm bg-zinc-50 p-3 rounded-lg">{selectedApp.feedback}</p>
                  </div>
                )}
                
                <div className="flex gap-4 text-sm">
                  <div className="flex-1 bg-zinc-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-zinc-500 mb-1">当前额度</p>
                    <p className="font-bold">{selectedApp.current_quota}</p>
                  </div>
                  <div className="flex-1 bg-zinc-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-zinc-500 mb-1">已使用</p>
                    <p className="font-bold">{selectedApp.used_count}</p>
                  </div>
                </div>
                
                {selectedApp.status === 'pending' && (
                  <>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">新额度</label>
                      <input
                        type="number"
                        value={newQuota}
                        onChange={(e) => setNewQuota(e.target.value)}
                        className="w-full h-10 px-3 border rounded-lg text-sm"
                        placeholder="批准后的新额度"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">管理员备注（选填）</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                        placeholder="处理备注..."
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleAction('rejected')}
                        disabled={processing}
                        className="flex-1 h-12 border border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors"
                      >
                        拒绝
                      </button>
                      <button
                        onClick={() => handleAction('approved')}
                        disabled={processing}
                        className="flex-1 h-12 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                        批准
                      </button>
                    </div>
                  </>
                )}
                
                {selectedApp.status !== 'pending' && selectedApp.admin_notes && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">管理员备注</p>
                    <p className="text-sm bg-zinc-50 p-3 rounded-lg">{selectedApp.admin_notes}</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setSelectedApp(null)}
                className="w-full h-12 mt-4 text-zinc-500 hover:text-zinc-700 font-medium"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

