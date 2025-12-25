import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { GenerationParams } from '@/types'
import { generateId } from '@/lib/utils'
import { indexedDBStorage } from '@/lib/indexeddb'

// base64 转 Blob URL（释放内存）
export function base64ToBlobUrl(base64: string): string {
  try {
    // 提取 MIME 类型和数据
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) return base64
    
    const mimeType = matches[1]
    const data = matches[2]
    
    // 解码 base64
    const byteCharacters = atob(data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    
    // 创建 Blob 和 URL
    const blob = new Blob([byteArray], { type: mimeType })
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('[TaskStore] Failed to convert base64 to blob URL:', e)
    return base64
  }
}

export type TaskType = 'camera' | 'studio' | 'edit' | 'pro_studio' | 'group_shoot' | 'reference_shot' | 'create_model' | 'social' | 'lifestyle' | 'try_on'
export type ImageStatus = 'pending' | 'generating' | 'completed' | 'failed'

// 每张图的独立状态
export interface ImageSlot {
  index: number
  status: ImageStatus
  imageUrl?: string
  modelType?: 'pro' | 'flash'
  genMode?: 'simple' | 'extended'
  dbId?: string  // 数据库 UUID，用于收藏等功能
  error?: string
}

export interface GenerationTask {
  id: string
  dbId?: string  // 数据库 UUID（第一张图保存后获得）
  type: TaskType
  status: 'pending' | 'generating' | 'completed' | 'failed' // 整体状态
  inputImageUrl: string
  outputImageUrls: string[] // 保留向后兼容
  params?: GenerationParams
  expectedImageCount?: number // Expected number of images to generate
  imageSlots?: ImageSlot[] // 每张图的独立状态（新增）
  createdAt: string
  error?: string
}

interface GenerationTaskState {
  tasks: GenerationTask[]
  _hasHydrated: boolean
  
  // Actions
  setHasHydrated: (state: boolean) => void
  addTask: (type: TaskType, inputImageUrl: string, params?: GenerationParams, expectedImageCount?: number) => string
  updateTaskStatus: (id: string, status: GenerationTask['status'], outputImageUrls?: string[], error?: string) => void
  // 更新单张图片的状态（新增）
  updateImageSlot: (taskId: string, index: number, update: Partial<ImageSlot>) => void
  // 初始化图片槽位（新增）
  initImageSlots: (taskId: string, count: number) => void
  removeTask: (id: string) => void
  getActiveTasks: () => GenerationTask[]
  getCompletedTasks: () => GenerationTask[]
  // 清理超时的进行中任务（刷新页面后这些任务已经丢失连接）
  cleanupStaleTasks: () => void
}

export const useGenerationTaskStore = create<GenerationTaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      _hasHydrated: false,
      
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },
      
      addTask: (type, inputImageUrl, params, expectedImageCount) => {
        const id = generateId()
        const task: GenerationTask = {
          id,
          type,
          status: 'pending',
          inputImageUrl,
          outputImageUrls: [],
          params,
          expectedImageCount,
          createdAt: new Date().toISOString(),
        }
        
        set((state) => ({
          tasks: [task, ...state.tasks]
        }))
        
        return id
      },
      
      updateTaskStatus: (id, status, outputImageUrls, error) => {
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id 
              ? { 
                  ...task, 
                  status, 
                  outputImageUrls: outputImageUrls || task.outputImageUrls,
                  error 
                }
              : task
          )
        }))
      },
      
      // 初始化图片槽位
      initImageSlots: (taskId, count) => {
        const slots: ImageSlot[] = Array.from({ length: count }, (_, i) => ({
          index: i,
          status: 'pending' as ImageStatus,
        }))
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === taskId
              ? { ...task, imageSlots: slots, status: 'generating' as const }
              : task
          )
        }))
      },
      
      // 更新单张图片的状态
      updateImageSlot: (taskId, index, update) => {
        set((state) => ({
          tasks: state.tasks.map(task => {
            if (task.id !== taskId) return task
            
            const newSlots = [...(task.imageSlots || [])]
            if (newSlots[index]) {
              newSlots[index] = { ...newSlots[index], ...update }
            }
            
            // 更新 outputImageUrls 保持兼容
            const newOutputUrls = [...task.outputImageUrls]
            if (update.imageUrl) {
              newOutputUrls[index] = update.imageUrl
            }
            
            // 如果有 dbId 且 task.dbId 还没被设置，更新到 task 级别
            // 不限制 index === 0，因为图片可能乱序返回或第一张失败
            let newDbId = task.dbId
            if (update.dbId && !task.dbId) {
              newDbId = update.dbId
            }
            
            // 检查是否所有图片都已完成/失败
            const allDone = newSlots.every(s => s.status === 'completed' || s.status === 'failed')
            const anyCompleted = newSlots.some(s => s.status === 'completed')
            const allFailed = newSlots.every(s => s.status === 'failed')
            
            let newStatus = task.status
            if (allDone) {
              newStatus = allFailed ? 'failed' : 'completed'
            }
            
            return {
              ...task,
              dbId: newDbId,
              imageSlots: newSlots,
              outputImageUrls: newOutputUrls,
              status: newStatus,
            }
          })
        }))
      },
      
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id)
        }))
      },
      
      getActiveTasks: () => {
        return get().tasks.filter(t => t.status === 'pending' || t.status === 'generating')
      },
      
      getCompletedTasks: () => {
        return get().tasks.filter(t => t.status === 'completed')
      },
      
      // 清理任务（刷新后不再需要，因为不持久化了）
      cleanupStaleTasks: () => {
        // 后端直接写入数据库，刷新后从云端拉取
        // 不再需要清理超时任务
        console.log('[TaskStore] cleanupStaleTasks: no-op (tasks not persisted)')
      },
    }),
    {
      name: 'generation-task-storage',
      // 使用 IndexedDB 替代 localStorage（支持更大存储，不会 QuotaExceeded）
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: () => ({
        // 不持久化任何 tasks
        // 原因：
        //   1. 后端现在直接写入数据库，刷新后从云端拉取结果
        //   2. 避免显示"假的" loading 卡片（后端可能已完成或失败）
        //   3. 刷新后：骨架屏 → syncWithCloud → 显示云端结果
        tasks: [],
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

