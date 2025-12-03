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

export type TaskType = 'camera' | 'studio' | 'edit'
export type ImageStatus = 'pending' | 'generating' | 'completed' | 'failed'

// 每张图的独立状态
export interface ImageSlot {
  index: number
  status: ImageStatus
  imageUrl?: string
  modelType?: 'pro' | 'flash'
  genMode?: 'simple' | 'extended'
  error?: string
}

export interface GenerationTask {
  id: string
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

// 任务超时时间：5分钟（超过这个时间的 generating 任务会被标记为失败）
const TASK_TIMEOUT_MS = 5 * 60 * 1000

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
      
      // 清理超时的任务 - 页面刷新后，之前的 generating 任务已失去连接
      cleanupStaleTasks: () => {
        const now = Date.now()
        set((state) => ({
          tasks: state.tasks.map(task => {
            // 如果任务正在生成中且已超时，标记为失败
            if ((task.status === 'pending' || task.status === 'generating') && 
                new Date(task.createdAt).getTime() + TASK_TIMEOUT_MS < now) {
              console.log('[TaskStore] Marking stale task as failed:', task.id)
              return {
                ...task,
                status: 'failed' as const,
                error: '生成超时，请重试'
              }
            }
            return task
          })
        }))
      },
    }),
    {
      name: 'generation-task-storage',
      // 使用 IndexedDB 替代 localStorage（支持更大存储，不会 QuotaExceeded）
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        // 持久化所有未完成的任务（不限制数量）
        tasks: state.tasks
          .filter(t => t.status === 'pending' || t.status === 'generating' || t.status === 'failed')
          .map(t => ({
            id: t.id,
            type: t.type,
            status: t.status,
            createdAt: t.createdAt,
            expectedImageCount: t.expectedImageCount,
            error: t.error,
            // 不存储图片数据（base64 和 blob URL 都不存储）
            inputImageUrl: (t.inputImageUrl?.startsWith('data:') || t.inputImageUrl?.startsWith('blob:')) 
              ? '[image]' : t.inputImageUrl,
            outputImageUrls: [],
            // 保留所有 imageSlots 的状态，但不存储图片
            imageSlots: t.imageSlots?.map(slot => ({
              index: slot.index,
              status: slot.status,
              modelType: slot.modelType,
              genMode: slot.genMode,
              error: slot.error,
              // 不存储图片 URL（blob URL 刷新后会失效）
            })),
            // 不存储 params 中的图片数据
            params: t.params ? {
              ...t.params,
              inputImage: undefined,
              productImage: undefined,
              modelImage: undefined,
              backgroundImage: undefined,
            } : undefined,
          }))
        // 不限制任务数量，IndexedDB 可以存储更多数据
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        // 页面刷新后清理超时任务
        state?.cleanupStaleTasks()
      },
    }
  )
)

