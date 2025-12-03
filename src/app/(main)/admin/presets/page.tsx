"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
  Home, Upload, Trash2, RefreshCw, Loader2, 
  Users, Image as ImageIcon, Palette, Package, Check, X,
  ChevronLeft, FolderOpen, AlertCircle
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { motion, AnimatePresence } from "framer-motion"

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

// Asset categories
const CATEGORIES = [
  { id: 'models', label: '模特 (随机)', folder: 'models', icon: Users, color: 'bg-blue-500' },
  { id: 'backgrounds', label: '背景 (随机)', folder: 'backgrounds', icon: ImageIcon, color: 'bg-green-500' },
  { id: 'visible-models', label: '模特 (展示)', folder: 'models/visible', icon: Users, color: 'bg-blue-400' },
  { id: 'visible-backgrounds', label: '背景 (展示)', folder: 'backgrounds/visible', icon: ImageIcon, color: 'bg-green-400' },
  { id: 'vibes', label: '氛围图', folder: 'vibes', icon: Palette, color: 'bg-purple-500' },
  { id: 'products', label: '商品示例', folder: 'products', icon: Package, color: 'bg-amber-500' },
]

interface StorageFile {
  name: string
  url: string
  size: number
  createdAt: string
}

export default function PresetsManagement() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const [files, setFiles] = useState<StorageFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auth check
  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '')
  
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, authLoading, router, isAdmin])

  // Fetch files when category changes
  useEffect(() => {
    if (user && isAdmin) {
      fetchFiles()
    }
  }, [activeCategory, user, isAdmin])

  const fetchFiles = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/presets?folder=${activeCategory.folder}`)
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      const data = await response.json()
      setFiles(data.files || [])
    } catch (err) {
      setError('加载文件失败')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files
    if (!uploadFiles || uploadFiles.length === 0) return

    setIsUploading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const formData = new FormData()
      formData.append('folder', activeCategory.folder)
      
      for (let i = 0; i < uploadFiles.length; i++) {
        formData.append('files', uploadFiles[i])
      }

      const response = await fetch('/api/admin/presets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setSuccessMessage(`成功上传 ${data.uploaded} 个文件`)
      fetchFiles()
    } catch (err: any) {
      setError(err.message || '上传失败')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (selectedFiles.size === 0) return
    
    if (!confirm(`确定要删除选中的 ${selectedFiles.size} 个文件吗？此操作不可恢复！`)) {
      return
    }

    setIsDeleting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/admin/presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: activeCategory.folder,
          files: Array.from(selectedFiles),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Delete failed')
      }

      const data = await response.json()
      setSuccessMessage(`成功删除 ${data.deleted} 个文件`)
      setSelectedFiles(new Set())
      fetchFiles()
    } catch (err: any) {
      setError(err.message || '删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectFile = (fileName: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName)
    } else {
      newSelected.add(fileName)
    }
    setSelectedFiles(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.name)))
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin")}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-zinc-900">Presets 资源管理</h1>
                  <p className="text-sm text-zinc-500">管理 Supabase Storage 中的预设资源</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <Home className="w-5 h-5 text-zinc-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory.id === category.id
            return (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category)
                  setSelectedFiles(new Set())
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-md ${category.color} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                {category.label}
              </button>
            )
          })}
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {/* Upload Button */}
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{isUploading ? '上传中...' : '上传文件'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              {/* Delete Button */}
              <button
                onClick={handleDelete}
                disabled={selectedFiles.size === 0 || isDeleting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedFiles.size > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>删除 ({selectedFiles.size})</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={fetchFiles}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <span>文件夹: <code className="bg-zinc-100 px-2 py-0.5 rounded">presets/{activeCategory.folder}</code></span>
              <span>共 {files.length} 个文件</span>
            </div>
          </div>

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg"
              >
                <Check className="w-4 h-4" />
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Select All */}
        {files.length > 0 && (
          <div className="mb-4">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-2"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedFiles.size === files.length
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-zinc-300'
              }`}>
                {selectedFiles.size === files.length && <Check className="w-3 h-3 text-white" />}
              </div>
              全选 / 取消全选
            </button>
          </div>
        )}

        {/* Files Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <FolderOpen className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">此文件夹为空</p>
            <p className="text-sm">点击"上传文件"添加新资源</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {files.map((file) => (
              <motion.div
                key={file.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedFiles.has(file.name)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => toggleSelectFile(file.name)}
              >
                <div className="aspect-square relative bg-zinc-100">
                  <Image
                    src={file.url}
                    alt={file.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  />
                  
                  {/* Selection indicator */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedFiles.has(file.name)
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white/80 border-zinc-300 opacity-0 group-hover:opacity-100'
                  }`}>
                    {selectedFiles.has(file.name) && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
                
                {/* File info */}
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-zinc-700 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

