import { create } from 'zustand'
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
  
  // Actions
  addTask: (type: TaskType, inputImageUrl: string, params?: GenerationParams, expectedImageCount?: number) => string
  updateTaskStatus: (id: string, status: GenerationTask['status'], outputImageUrls?: string[], error?: string) => void
  removeTask: (id: string) => void
  getActiveTasks: () => GenerationTask[]
  getCompletedTasks: () => GenerationTask[]
}

export const useGenerationTaskStore = create<GenerationTaskState>((set, get) => ({
  tasks: [],
  
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
}))

