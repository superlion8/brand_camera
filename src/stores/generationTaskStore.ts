import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { GenerationParams } from '@/types'
import { generateId } from '@/lib/utils'

// 安全的 localStorage wrapper，防止 QuotaExceededError 阻塞应用
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch (e) {
      console.warn('[TaskStore] Failed to read from localStorage:', e)
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      console.warn('[TaskStore] Failed to write to localStorage (quota exceeded?):', e)
      // 尝试清理旧数据后重试
      try {
        localStorage.removeItem(name)
        localStorage.setItem(name, value)
      } catch (e2) {
        console.error('[TaskStore] Failed to write even after cleanup:', e2)
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (e) {
      console.warn('[TaskStore] Failed to remove from localStorage:', e)
    }
  },
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
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        // 持久化任务状态，但不存储 base64 图片数据（太大会超限）
        tasks: state.tasks
          .filter(t => 
            t.status === 'pending' || 
            t.status === 'generating' ||
            // 保留最近30分钟内的已完成/失败任务
            (new Date(t.createdAt).getTime() > Date.now() - 30 * 60 * 1000)
          )
          .map(t => ({
            id: t.id,
            type: t.type,
            status: t.status,
            createdAt: t.createdAt,
            expectedImageCount: t.expectedImageCount,
            error: t.error,
            // 不存储 base64 图片数据，用占位符标记
            inputImageUrl: t.inputImageUrl?.startsWith('data:') ? '[base64]' : t.inputImageUrl,
            outputImageUrls: t.outputImageUrls.map(url => 
              url?.startsWith('data:') ? '[base64]' : url
            ),
            // 保存 imageSlots 但不存储 base64 图片
            imageSlots: t.imageSlots?.map(slot => ({
              ...slot,
              imageUrl: slot.imageUrl?.startsWith('data:') ? '[base64]' : slot.imageUrl,
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
          .slice(0, 10) // 最多保留10个任务
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        // 页面刷新后清理超时任务
        state?.cleanupStaleTasks()
      },
    }
  )
)

