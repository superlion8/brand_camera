"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
  Home, Users, BarChart3, FileText, Calendar, Filter, 
  ChevronDown, ChevronRight, Heart, Loader2, RefreshCw,
  ImageIcon, Sparkles, Lightbulb, Wand2, CalendarDays, Download, X, ZoomIn
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { motion, AnimatePresence } from "framer-motion"

interface DailyStat {
  date: string
  uniqueUsers: number
  tasks: number
  images: number
  successImages: number
  failedImages: number
  pendingImages: number
  favorites: number
  downloads: number
}

interface TypeStat {
  type: string
  uniqueUsers: number
  tasks: number
  images: number
  successImages: number
  failedImages: number
  pendingImages: number
  favorites: number
  downloads: number
}

interface UserStat {
  email: string
  userId: string
  totalTasks: number
  totalImages: number
  totalSuccessImages: number
  totalFailedImages: number
  totalPendingImages: number
  totalFavorites: number
  totalDownloads: number
  byType: Record<string, { tasks: number; images: number; successImages: number; failedImages: number; pendingImages: number; favorites: number; downloads: number }>
}

interface TaskDetail {
  id: string
  taskId: string
  userEmail: string
  taskType: string
  status: string
  inputImageUrl: string
  inputImage2Url?: string
  modelImageUrl?: string
  backgroundImageUrl?: string
  outputImageUrls: string[]
  totalImages: number
  simpleCount: number
  extendedCount: number
  favoritedIndices: number[]
  downloadedIndices: number[]
  createdAt: string
  outputModelTypes?: ('pro' | 'flash')[]
  outputGenModes?: ('simple' | 'extended')[]
  inputParams?: Record<string, any>
}

type TabType = "overview" | "by-type" | "by-user" | "details"

const TASK_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'model_studio': { label: '模特影棚', color: 'bg-blue-500', icon: Users },
  'camera_model': { label: '模特影棚', color: 'bg-blue-500', icon: Users },
  'product_studio': { label: '商品影棚', color: 'bg-amber-500', icon: Lightbulb },
  'studio': { label: '商品影棚', color: 'bg-amber-500', icon: Lightbulb },
  'edit': { label: '修图室', color: 'bg-purple-500', icon: Wand2 },
  'unknown': { label: '其他', color: 'bg-zinc-500', icon: ImageIcon },
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Data states
  const [overview, setOverview] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState({ totalUsers: 0, totalTasks: 0, totalImages: 0, totalSuccessImages: 0, totalFailedImages: 0, totalPendingImages: 0, totalFavorites: 0, totalDownloads: 0 })
  const [byType, setByType] = useState<TypeStat[]>([])
  const [byUser, setByUser] = useState<UserStat[]>([])
  const [details, setDetails] = useState<TaskDetail[]>([])
  
  // Filters
  const [filterType, setFilterType] = useState<string>("")
  const [filterEmail, setFilterEmail] = useState<string>("")
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  // Date filters
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // Fetch data based on active tab
  const fetchData = async (tab: TabType, fromDate?: string, toDate?: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      let url = `/api/admin/stats?view=${tab}`
      
      // Add date filters
      const from = fromDate || dateFrom
      const to = toDate || dateTo
      if (from) url += `&from=${from}`
      if (to) url += `&to=${to}`
      
      if (tab === 'details') {
        if (filterType) url += `&type=${filterType}`
        if (filterEmail) url += `&email=${encodeURIComponent(filterEmail)}`
      }
      
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) {
          setError('无权访问管理员看板')
          return
        }
        throw new Error('Failed to fetch data')
      }
      
      const data = await res.json()
      
      if (tab === 'overview') {
        setOverview(data.overview || [])
        setTotals(data.totals || { totalUsers: 0, totalTasks: 0, totalImages: 0, totalSuccessImages: 0, totalFailedImages: 0, totalPendingImages: 0, totalFavorites: 0, totalDownloads: 0 })
      } else if (tab === 'by-type') {
        setByType(data.byType || [])
      } else if (tab === 'by-user') {
        setByUser(data.byUser || [])
      } else if (tab === 'details') {
        setDetails(data.details || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    if (!authLoading && user) {
      fetchData(activeTab)
    }
  }, [activeTab, authLoading, user])
  
  const handleRefresh = () => {
    fetchData(activeTab)
  }
  
  const handleFilterApply = () => {
    if (activeTab === 'details') {
      fetchData('details')
    }
  }
  
  const toggleUserExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }
  
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }
  
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">请先登录</p>
      </div>
    )
  }
  
  const tabs = [
    { id: "overview" as TabType, label: "总览", icon: BarChart3 },
    { id: "by-type" as TabType, label: "按类型", icon: Sparkles },
    { id: "by-user" as TabType, label: "按用户", icon: Users },
    { id: "details" as TabType, label: "任务明细", icon: FileText },
  ]
  
  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            >
              <Home className="w-5 h-5 text-zinc-600" />
            </button>
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
              <span className="font-semibold text-lg text-zinc-900">管理员看板</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center"
            disabled={isLoading}
          >
            <RefreshCw className={`w-5 h-5 text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        {/* Date Filter */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-zinc-100 rounded-lg p-1">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setDateFrom(today)
                  setDateTo(today)
                  fetchData(activeTab, today, today)
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white transition-colors"
              >
                今天
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                  const from = weekAgo.toISOString().split('T')[0]
                  const to = today.toISOString().split('T')[0]
                  setDateFrom(from)
                  setDateTo(to)
                  fetchData(activeTab, from, to)
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white transition-colors"
              >
                近7天
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                  const from = monthAgo.toISOString().split('T')[0]
                  const to = today.toISOString().split('T')[0]
                  setDateFrom(from)
                  setDateTo(to)
                  fetchData(activeTab, from, to)
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white transition-colors"
              >
                近30天
              </button>
              <button
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  fetchData(activeTab, '', '')
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-white transition-colors"
              >
                全部
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 px-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-zinc-400 text-xs">至</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 px-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchData(activeTab)}
                className="h-8 px-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                查询
              </button>
            </div>
            
            {(dateFrom || dateTo) && (
              <span className="text-xs text-zinc-500">
                {dateFrom || '开始'} ~ {dateTo || '至今'}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            {error}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Total Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard 
                label="总用户数" 
                value={totals.totalUsers} 
                icon={Users}
                color="bg-blue-500"
              />
              <StatCard 
                label="总任务数" 
                value={totals.totalTasks} 
                icon={FileText}
                color="bg-green-500"
              />
              <StatCard 
                label="总图片数" 
                value={totals.totalImages} 
                icon={ImageIcon}
                color="bg-purple-500"
                subValue={`✓${totals.totalSuccessImages} ✗${totals.totalFailedImages} ⏳${totals.totalPendingImages}`}
              />
              <StatCard 
                label="总收藏数" 
                value={totals.totalFavorites} 
                icon={Heart}
                color="bg-red-500"
              />
              <StatCard 
                label="总下载数" 
                value={totals.totalDownloads} 
                icon={Download}
                color="bg-cyan-500"
              />
            </div>
            
            {/* Daily Stats Table */}
            <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
              <div className="p-4 border-b border-zinc-100">
                <h3 className="font-semibold text-zinc-900">每日统计</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">日期</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">用户数</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">任务数</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">图片数</th>
                      <th className="px-4 py-3 text-right font-medium text-green-600">成功</th>
                      <th className="px-4 py-3 text-right font-medium text-red-500">失败</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">收藏数</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">下载数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : overview.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">暂无数据</td>
                      </tr>
                    ) : overview.map(day => (
                      <tr key={day.date} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-900">{day.date}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.uniqueUsers}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.tasks}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.images}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{day.successImages || 0}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{day.failedImages || 0}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.favorites}</td>
                        <td className="px-4 py-3 text-right text-cyan-600 font-medium">{day.downloads || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* By Type Tab */}
        {activeTab === "by-type" && (
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900">按类型统计</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">类型</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">用户数</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">任务数</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">图片数</th>
                    <th className="px-4 py-3 text-right font-medium text-green-600">成功</th>
                    <th className="px-4 py-3 text-right font-medium text-red-500">失败</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">收藏数</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">下载数</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : byType.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">暂无数据</td>
                    </tr>
                  ) : byType.map(item => {
                    const typeInfo = TASK_TYPE_LABELS[item.type] || TASK_TYPE_LABELS['unknown']
                    const Icon = typeInfo.icon
                    return (
                      <tr key={item.type} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded flex items-center justify-center ${typeInfo.color} text-white`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-zinc-900">{typeInfo.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">{item.uniqueUsers}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{item.tasks}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{item.images}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{item.successImages || 0}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{item.failedImages || 0}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{item.favorites}</td>
                        <td className="px-4 py-3 text-right text-cyan-600 font-medium">{item.downloads || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* By User Tab */}
        {activeTab === "by-user" && (
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900">按用户统计</h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-zinc-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : byUser.length === 0 ? (
              <div className="p-8 text-center text-zinc-400">暂无数据</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {byUser.map(user => {
                  const isExpanded = expandedUsers.has(user.userId)
                  return (
                    <div key={user.userId}>
                      <button
                        onClick={() => toggleUserExpand(user.userId)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-zinc-900 truncate max-w-[200px]">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>{user.totalTasks} 任务</span>
                          <span>{user.totalImages} 图片</span>
                          <span className="text-green-600">✓{user.totalSuccessImages || 0}</span>
                          <span className="text-red-500">✗{user.totalFailedImages || 0}</span>
                          <span>{user.totalFavorites} 收藏</span>
                          <span className="text-cyan-600">{user.totalDownloads || 0} 下载</span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-3 pl-11 bg-zinc-50">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {Object.entries(user.byType).map(([type, stats]) => {
                              const typeInfo = TASK_TYPE_LABELS[type] || TASK_TYPE_LABELS['unknown']
                              return (
                                <div key={type} className="bg-white rounded-lg p-2 border border-zinc-100">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] text-white mb-1 ${typeInfo.color}`}>
                                    {typeInfo.label}
                                  </span>
                                  <div className="text-zinc-600 space-y-0.5">
                                    <p>{stats.tasks} 任务</p>
                                    <p>{stats.images} 图片 <span className="text-green-600">✓{stats.successImages || 0}</span> <span className="text-red-500">✗{stats.failedImages || 0}</span></p>
                                    <p>{stats.favorites} 收藏</p>
                                    <p className="text-cyan-600">{stats.downloads || 0} 下载</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-zinc-100 p-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-zinc-500 mb-1 block">任务类型</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全部</option>
                    <option value="model_studio">模特影棚</option>
                    <option value="product_studio">商品影棚</option>
                    <option value="edit">修图室</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-zinc-500 mb-1 block">用户邮箱</label>
                  <input
                    type="text"
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                    placeholder="搜索邮箱..."
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleFilterApply}
                    className="h-10 px-4 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800"
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Task List */}
            <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
              <div className="p-4 border-b border-zinc-100">
                <h3 className="font-semibold text-zinc-900">任务明细</h3>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : details.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">暂无数据</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {details.map(task => {
                    const typeInfo = TASK_TYPE_LABELS[task.taskType] || TASK_TYPE_LABELS['unknown']
                    const Icon = typeInfo.icon
                    return (
                      <div 
                        key={task.id} 
                        className="p-4 hover:bg-zinc-50 cursor-pointer"
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Input thumbnail */}
                          <div className="w-16 h-16 bg-zinc-100 rounded-lg overflow-hidden shrink-0">
                            {task.inputImageUrl ? (
                              <img 
                                src={task.inputImageUrl} 
                                alt="Input" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-zinc-300" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                              {task.favoritedIndices.length > 0 && (
                                <span className="flex items-center gap-0.5 text-red-500 text-[10px]">
                                  <Heart className="w-3 h-3 fill-current" />
                                  {task.favoritedIndices.length}
                                </span>
                              )}
                              {task.downloadedIndices && task.downloadedIndices.length > 0 && (
                                <span className="flex items-center gap-0.5 text-cyan-500 text-[10px]">
                                  <Download className="w-3 h-3" />
                                  {task.downloadedIndices.length}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-900 truncate">{task.userEmail}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {new Date(task.createdAt).toLocaleString()} · {task.totalImages} 张图片
                            </p>
                          </div>
                          
                          {/* Output thumbnails */}
                          <div className="flex gap-1 shrink-0">
                            {task.outputImageUrls.slice(0, 3).map((url, i) => url ? (
                              <div key={i} className="w-10 h-10 bg-zinc-100 rounded overflow-hidden">
                                <img 
                                  src={url} 
                                  alt={`Output ${i + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : null)}
                            {task.outputImageUrls.length > 3 && (
                              <div className="w-10 h-10 bg-zinc-200 rounded flex items-center justify-center text-[10px] text-zinc-500">
                                +{task.outputImageUrls.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Fixed */}
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-zinc-900">任务详情</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Basic Info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">任务ID</span>
                    <span className="text-zinc-900 font-mono text-xs">{selectedTask.taskId || selectedTask.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">用户</span>
                    <span className="text-zinc-900">{selectedTask.userEmail}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">类型</span>
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${TASK_TYPE_LABELS[selectedTask.taskType]?.color || 'bg-zinc-500'}`}>
                      {TASK_TYPE_LABELS[selectedTask.taskType]?.label || selectedTask.taskType}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">时间</span>
                    <span className="text-zinc-900">{new Date(selectedTask.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                
                {/* Favorites Summary */}
                {selectedTask.favoritedIndices.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <Heart className="w-5 h-5 text-red-500 fill-current" />
                    <span className="text-sm text-red-700">
                      {selectedTask.favoritedIndices.length} 张图片被收藏
                      （第 {selectedTask.favoritedIndices.map(i => i + 1).join(', ')} 张）
                    </span>
                  </div>
                )}
                
                {/* Downloads Summary */}
                {selectedTask.downloadedIndices && selectedTask.downloadedIndices.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-cyan-50 rounded-lg">
                    <Download className="w-5 h-5 text-cyan-500" />
                    <span className="text-sm text-cyan-700">
                      {selectedTask.downloadedIndices.length} 次下载
                      （第 {Array.from(new Set(selectedTask.downloadedIndices)).map(i => i + 1).join(', ')} 张）
                    </span>
                  </div>
                )}
                
                {/* Generation Parameters */}
                {selectedTask.inputParams && (
                  <div className="p-3 bg-zinc-50 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-zinc-700">生成参数</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.inputParams.modelStyle && selectedTask.inputParams.modelStyle !== 'auto' && (
                        <span className="px-2 py-1 bg-white rounded text-xs text-zinc-600 border border-zinc-200">
                          风格: {selectedTask.inputParams.modelStyle === 'korean' ? '韩系' : 
                                 selectedTask.inputParams.modelStyle === 'western' ? '欧美' : selectedTask.inputParams.modelStyle}
                        </span>
                      )}
                      {selectedTask.inputParams.modelGender && (
                        <span className="px-2 py-1 bg-white rounded text-xs text-zinc-600 border border-zinc-200">
                          性别: {selectedTask.inputParams.modelGender === 'male' ? '男' : 
                                 selectedTask.inputParams.modelGender === 'female' ? '女' : 
                                 selectedTask.inputParams.modelGender === 'boy' ? '男童' : '女童'}
                        </span>
                      )}
                      {selectedTask.inputParams.lightType && (
                        <span className="px-2 py-1 bg-white rounded text-xs text-zinc-600 border border-zinc-200">
                          光源: {selectedTask.inputParams.lightType}
                        </span>
                      )}
                      {selectedTask.inputParams.lightDirection && (
                        <span className="px-2 py-1 bg-white rounded text-xs text-zinc-600 border border-zinc-200">
                          方向: {selectedTask.inputParams.lightDirection}
                        </span>
                      )}
                      {selectedTask.inputParams.modelIsUserSelected !== undefined && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          selectedTask.inputParams.modelIsUserSelected 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          模特: {selectedTask.inputParams.modelIsUserSelected ? '用户选择' : '系统随机'}
                        </span>
                      )}
                      {selectedTask.inputParams.bgIsUserSelected !== undefined && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          selectedTask.inputParams.bgIsUserSelected 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          背景: {selectedTask.inputParams.bgIsUserSelected ? '用户选择' : '系统随机'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Input Image (Product only - model/bg shown per output image) */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">输入商品图</p>
                  <div className="flex gap-2 flex-wrap">
                    {(selectedTask.inputImageUrl || selectedTask.inputParams?.inputImage) ? (
                      <div 
                        className="relative cursor-pointer group"
                        onClick={() => setFullscreenImage(selectedTask.inputImageUrl || selectedTask.inputParams?.inputImage || '')}
                      >
                        <img 
                          src={selectedTask.inputImageUrl || selectedTask.inputParams?.inputImage || ''} 
                          alt="Input" 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[8px] rounded">商品</span>
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400">无输入图片记录</p>
                    )}
                  </div>
                </div>
                
                {/* Output Images with per-image model/background */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">输出图片 ({selectedTask.outputImageUrls.length})</p>
                  {selectedTask.outputImageUrls.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTask.outputImageUrls.map((url, i) => {
                        const downloadCount = selectedTask.downloadedIndices?.filter(idx => idx === i).length || 0
                        // Get per-image model and background
                        const perImageModel = selectedTask.inputParams?.perImageModels?.[i]
                        const perImageBg = selectedTask.inputParams?.perImageBackgrounds?.[i]
                        const modelUrl = perImageModel?.imageUrl || selectedTask.modelImageUrl || selectedTask.inputParams?.modelImage
                        const bgUrl = perImageBg?.imageUrl || selectedTask.backgroundImageUrl || selectedTask.inputParams?.backgroundImage
                        const rawModelName = perImageModel?.name || selectedTask.inputParams?.model || '模特'
                        const rawBgName = perImageBg?.name || selectedTask.inputParams?.background || '环境'
                        // Check isRandom field, or fallback to checking if name contains "(随机)" for old data
                        const modelIsRandom = perImageModel?.isRandom === true || rawModelName.includes('(随机)')
                        const bgIsRandom = perImageBg?.isRandom === true || rawBgName.includes('(随机)')
                        // Check isPreset field, or fallback to checking URL for old data
                        const isPresetUrl = (url: string) => url?.includes('/presets/') || url?.includes('presets%2F')
                        const modelIsPreset = perImageModel?.isPreset === true || isPresetUrl(modelUrl || '')
                        const bgIsPreset = perImageBg?.isPreset === true || isPresetUrl(bgUrl || '')
                        // Clean up display name (remove "(随机)" suffix if present)
                        const modelName = rawModelName.replace(' (随机)', '').replace('(随机)', '')
                        const bgName = rawBgName.replace(' (随机)', '').replace('(随机)', '')
                        // Get AI model type for this image
                        const outputModelType = selectedTask.outputModelTypes?.[i]
                        const genMode = selectedTask.outputGenModes?.[i]
                        
                        return (
                          <div key={i} className="p-2 bg-zinc-50 rounded-lg space-y-2">
                            {/* AI Model Type Badge */}
                            {(outputModelType || genMode) && (
                              <div className="flex gap-1 flex-wrap">
                                {outputModelType && (
                                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                    outputModelType === 'pro' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {outputModelType === 'pro' ? 'Gemini Pro' : 'Gemini Flash (降级)'}
                                  </span>
                                )}
                                {genMode && (
                                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                    genMode === 'simple' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {genMode === 'simple' ? '极简模式' : '扩展模式'}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              {/* Output image */}
                              <div 
                                className="relative w-24 h-30 bg-zinc-100 rounded-lg overflow-hidden shrink-0 cursor-pointer group"
                                onClick={() => setFullscreenImage(url)}
                              >
                                <img 
                                  src={url || ''} 
                                  alt={`Output ${i + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                                {/* Badges */}
                                <div className="absolute top-1 right-1 flex flex-col gap-1">
                                  {selectedTask.favoritedIndices.includes(i) && (
                                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                      <Heart className="w-2.5 h-2.5 text-white fill-current" />
                                    </div>
                                  )}
                                  {downloadCount > 0 && (
                                    <div className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                                      <Download className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                </div>
                                {/* Image number */}
                                <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[9px] rounded">
                                  #{i + 1}
                                </div>
                                {/* Hover zoom icon */}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              
                              {/* Per-image model and background */}
                              <div className="flex gap-3 flex-1 min-w-0">
                                {modelUrl && (
                                  <div className="flex flex-col items-center">
                                    <div 
                                      className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-200 cursor-pointer group relative"
                                      onClick={() => setFullscreenImage(modelUrl)}
                                    >
                                      <img src={modelUrl} alt="Model" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1 truncate max-w-[64px] text-center font-medium">{modelName}</p>
                                    <div className="flex flex-col gap-0.5 items-center">
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                        modelIsRandom 
                                          ? 'bg-amber-100 text-amber-700' 
                                          : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {modelIsRandom ? '随机' : '指定'}
                                      </span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                        modelIsPreset 
                                          ? 'bg-zinc-200 text-zinc-600' 
                                          : 'bg-pink-100 text-pink-700'
                                      }`}>
                                        {modelIsPreset ? '系统' : '上传'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {bgUrl && (
                                  <div className="flex flex-col items-center">
                                    <div 
                                      className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-200 cursor-pointer group relative"
                                      onClick={() => setFullscreenImage(bgUrl)}
                                    >
                                      <img src={bgUrl} alt="Background" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1 truncate max-w-[64px] text-center font-medium">{bgName}</p>
                                    <div className="flex flex-col gap-0.5 items-center">
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                        bgIsRandom 
                                          ? 'bg-amber-100 text-amber-700' 
                                          : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {bgIsRandom ? '随机' : '指定'}
                                      </span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${
                                        bgIsPreset 
                                          ? 'bg-zinc-200 text-zinc-600' 
                                          : 'bg-pink-100 text-pink-700'
                                      }`}>
                                        {bgIsPreset ? '系统' : '上传'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">无输出图片记录</p>
                  )}
                </div>
              </div>
              
              {/* Footer - Fixed */}
              <div className="p-4 border-t border-zinc-100 flex-shrink-0">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-full h-10 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={fullscreenImage}
              alt="Fullscreen"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color,
  subValue 
}: { 
  label: string
  value: number
  icon: React.ElementType
  color: string
  subValue?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-900">{value.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">{label}</p>
          {subValue && <p className="text-[10px] text-zinc-400 mt-0.5">{subValue}</p>}
        </div>
      </div>
    </div>
  )
}

