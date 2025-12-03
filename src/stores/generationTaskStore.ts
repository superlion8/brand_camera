import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { GenerationParams } from '@/types'
import { generateId } from '@/lib/utils'

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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化进行中和最近完成的任务
        tasks: state.tasks.filter(t => 
          t.status === 'pending' || 
          t.status === 'generating' ||
          // 保留最近10分钟内的已完成/失败任务
          (new Date(t.createdAt).getTime() > Date.now() - 10 * 60 * 1000)
        )
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        // 页面刷新后清理超时任务
        state?.cleanupStaleTasks()
      },
    }
  )
)

