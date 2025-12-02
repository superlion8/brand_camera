"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
  Home, Users, BarChart3, FileText, Calendar, Filter, 
  ChevronDown, ChevronRight, Eye, Heart, Loader2, RefreshCw,
  ImageIcon, Sparkles, Lightbulb, Wand2
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { motion, AnimatePresence } from "framer-motion"

interface DailyStat {
  date: string
  uniqueUsers: number
  tasks: number
  images: number
  favorites: number
}

interface TypeStat {
  type: string
  uniqueUsers: number
  tasks: number
  images: number
  favorites: number
}

interface UserStat {
  email: string
  userId: string
  totalTasks: number
  totalImages: number
  totalFavorites: number
  byType: Record<string, { tasks: number; images: number; favorites: number }>
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
  createdAt: string
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
  const [totals, setTotals] = useState({ totalUsers: 0, totalTasks: 0, totalImages: 0, totalFavorites: 0 })
  const [byType, setByType] = useState<TypeStat[]>([])
  const [byUser, setByUser] = useState<UserStat[]>([])
  const [details, setDetails] = useState<TaskDetail[]>([])
  
  // Filters
  const [filterType, setFilterType] = useState<string>("")
  const [filterEmail, setFilterEmail] = useState<string>("")
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  
  // Fetch data based on active tab
  const fetchData = async (tab: TabType) => {
    setIsLoading(true)
    setError(null)
    
    try {
      let url = `/api/admin/stats?view=${tab}`
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
        setTotals(data.totals || { totalUsers: 0, totalTasks: 0, totalImages: 0, totalFavorites: 0 })
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
              />
              <StatCard 
                label="总收藏数" 
                value={totals.totalFavorites} 
                icon={Heart}
                color="bg-red-500"
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
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">收藏数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : overview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">暂无数据</td>
                      </tr>
                    ) : overview.map(day => (
                      <tr key={day.date} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-900">{day.date}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.uniqueUsers}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.tasks}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.images}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{day.favorites}</td>
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
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">收藏数</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : byType.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">暂无数据</td>
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
                        <td className="px-4 py-3 text-right text-zinc-600">{item.favorites}</td>
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
                          <span>{user.totalFavorites} 收藏</span>
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
                                    <p>{stats.images} 图片</p>
                                    <p>{stats.favorites} 收藏</p>
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
                              <Image 
                                src={task.inputImageUrl} 
                                alt="Input" 
                                width={64} 
                                height={64} 
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
                            </div>
                            <p className="text-sm text-zinc-900 truncate">{task.userEmail}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {new Date(task.createdAt).toLocaleString()} · {task.totalImages} 张图片
                            </p>
                          </div>
                          
                          {/* Output thumbnails */}
                          <div className="flex gap-1 shrink-0">
                            {task.outputImageUrls.slice(0, 3).map((url, i) => (
                              <div key={i} className="w-10 h-10 bg-zinc-100 rounded overflow-hidden">
                                <Image 
                                  src={url} 
                                  alt={`Output ${i + 1}`} 
                                  width={40} 
                                  height={40} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
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
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">任务详情</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center"
                >
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
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
                
                {/* Input Images */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">输入图片</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTask.inputImageUrl && (
                      <div className="relative">
                        <Image 
                          src={selectedTask.inputImageUrl} 
                          alt="Input" 
                          width={80} 
                          height={80} 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[8px] rounded">商品</span>
                      </div>
                    )}
                    {selectedTask.modelImageUrl && (
                      <div className="relative">
                        <Image 
                          src={selectedTask.modelImageUrl} 
                          alt="Model" 
                          width={80} 
                          height={80} 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[8px] rounded">模特</span>
                      </div>
                    )}
                    {selectedTask.backgroundImageUrl && (
                      <div className="relative">
                        <Image 
                          src={selectedTask.backgroundImageUrl} 
                          alt="Background" 
                          width={80} 
                          height={80} 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[8px] rounded">环境</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Output Images */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">输出图片 ({selectedTask.outputImageUrls.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedTask.outputImageUrls.map((url, i) => (
                      <div key={i} className="relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden">
                        <Image 
                          src={url} 
                          alt={`Output ${i + 1}`} 
                          fill 
                          className="object-cover"
                        />
                        {selectedTask.favoritedIndices.includes(i) && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <Heart className="w-3 h-3 text-white fill-current" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
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
  color 
}: { 
  label: string
  value: number
  icon: React.ElementType
  color: string
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
        </div>
      </div>
    </div>
  )
}

