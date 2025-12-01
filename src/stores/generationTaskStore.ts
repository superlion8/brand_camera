import { create } from 'zustand'
import { GenerationParams } from '@/types'
import { generateId } from '@/lib/utils'

export interface GenerationTask {
  id: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  inputImageUrl: string
  outputImageUrls: string[]
  params?: GenerationParams
  createdAt: string
  error?: string
}

interface GenerationTaskState {
  tasks: GenerationTask[]
  
  // Actions
  addTask: (inputImageUrl: string, params?: GenerationParams) => string
  updateTaskStatus: (id: string, status: GenerationTask['status'], outputImageUrls?: string[], error?: string) => void
  removeTask: (id: string) => void
  getActiveTasks: () => GenerationTask[]
  getCompletedTasks: () => GenerationTask[]
}

export const useGenerationTaskStore = create<GenerationTaskState>((set, get) => ({
  tasks: [],
  
  addTask: (inputImageUrl, params) => {
    const id = generateId()
    const task: GenerationTask = {
      id,
      status: 'pending',
      inputImageUrl,
      outputImageUrls: [],
      params,
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

