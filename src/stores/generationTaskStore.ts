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

export interface GenerationTask {
  id: string
  type: TaskType
  status: 'pending' | 'generating' | 'completed' | 'failed'
  inputImageUrl: string
  outputImageUrls: string[]
  params?: GenerationParams
  expectedImageCount?: number // Expected number of images to generate
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

