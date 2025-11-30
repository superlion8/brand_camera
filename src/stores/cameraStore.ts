import { create } from 'zustand'
import { Asset, ModelStyle, CameraState } from '@/types'

export const useCameraStore = create<CameraState>((set) => ({
  capturedImage: null,
  selectedModel: null,
  selectedBackground: null,
  selectedVibe: null,
  modelStyle: 'auto',
  isGenerating: false,
  generatedImages: [],
  
  setCapturedImage: (image) => set({ capturedImage: image }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedBackground: (background) => set({ selectedBackground: background }),
  setSelectedVibe: (vibe) => set({ selectedVibe: vibe }),
  setModelStyle: (style) => set({ modelStyle: style }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratedImages: (images) => set({ generatedImages: images }),
  
  reset: () => set({
    capturedImage: null,
    selectedModel: null,
    selectedBackground: null,
    selectedVibe: null,
    modelStyle: 'auto',
    isGenerating: false,
    generatedImages: [],
  }),
}))

