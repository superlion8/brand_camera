import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Asset, ModelStyle, CameraState } from '@/types'
import { indexedDBStorage } from '@/lib/indexeddb'

export const useCameraStore = create<CameraState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'camera-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        // Only persist selection state, not the actual images to avoid large storage
        selectedModel: state.selectedModel,
        selectedBackground: state.selectedBackground,
        selectedVibe: state.selectedVibe,
        modelStyle: state.modelStyle,
        // Don't persist capturedImage, generatedImages - they are temporary
      }),
    }
  )
)
