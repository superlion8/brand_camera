import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  // Debug mode - shows generation parameters in detail page
  debugMode: boolean
  
  // Hydration status
  _hasHydrated: boolean
  
  // Actions
  setDebugMode: (enabled: boolean) => void
  toggleDebugMode: () => void
  setHasHydrated: (state: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      debugMode: false,
      _hasHydrated: false,
      
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      
      toggleDebugMode: () => set({ debugMode: !get().debugMode }),
      
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'brand-camera-settings',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

