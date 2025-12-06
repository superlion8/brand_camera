/**
 * Preset Store - 动态从云端加载预设资源
 * 
 * 资源结构：
 * presets/
 * ├── models/                    # 买家秀模特（随机池）
 * │   └── visible/               # 用户可见的模特
 * ├── backgrounds/               # 买家秀背景（随机池）
 * │   └── visible/               # 用户可见的背景
 * ├── studio-models/             # 专业棚拍模特
 * ├── studio-backgrounds/
 * │   ├── light/
 * │   ├── solid/
 * │   └── pattern/
 * └── products/                  # 预设商品
 */

import { create } from 'zustand'
import { Asset, AssetType } from '@/types'

const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'
const CACHE_VERSION = 'v7'

interface PresetState {
  // 买家秀资源
  allModels: Asset[]           // 随机池
  visibleModels: Asset[]       // 用户可见
  allBackgrounds: Asset[]      // 随机池
  visibleBackgrounds: Asset[]  // 用户可见
  
  // 专业棚拍资源
  studioModels: Asset[]
  studioBackgroundsLight: Asset[]
  studioBackgroundsSolid: Asset[]
  studioBackgroundsPattern: Asset[]
  
  // 预设商品
  presetProducts: Asset[]
  
  // 状态
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  lastLoadTime: number | null
  
  // Actions
  loadPresets: () => Promise<void>
  getRandomModel: () => Asset | null
  getRandomBackground: () => Asset | null
  getRandomStudioModel: () => Asset | null
  getRandomStudioBackground: () => Asset | null
  getAllStudioBackgrounds: () => Asset[]
}

// Helper: 从文件名生成 Asset
function fileToAsset(
  fileName: string, 
  folder: string, 
  type: AssetType,
  category?: string
): Asset {
  const nameWithoutExt = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  return {
    id: `preset-${folder.replace(/\//g, '-')}-${nameWithoutExt}`,
    type,
    name: nameWithoutExt,
    imageUrl: `${STORAGE_URL}/${folder}/${fileName}?${CACHE_VERSION}`,
    isSystem: true,
    category,
  }
}

// Helper: 从 Supabase Storage 获取文件列表
async function listStorageFiles(folder: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/presets/list?folder=${encodeURIComponent(folder)}`)
    if (!response.ok) {
      console.error(`[PresetStore] Failed to list ${folder}:`, response.status)
      return []
    }
    const data = await response.json()
    return data.files || []
  } catch (error) {
    console.error(`[PresetStore] Error listing ${folder}:`, error)
    return []
  }
}

export const usePresetStore = create<PresetState>((set, get) => ({
  // 初始状态 - 空数组
  allModels: [],
  visibleModels: [],
  allBackgrounds: [],
  visibleBackgrounds: [],
  studioModels: [],
  studioBackgroundsLight: [],
  studioBackgroundsSolid: [],
  studioBackgroundsPattern: [],
  presetProducts: [],
  
  isLoading: false,
  isLoaded: false,
  error: null,
  lastLoadTime: null,
  
  loadPresets: async () => {
    const state = get()
    
    // 如果已经在加载，跳过
    if (state.isLoading) return
    
    // 如果已加载且在 5 分钟内，跳过
    if (state.isLoaded && state.lastLoadTime) {
      const elapsed = Date.now() - state.lastLoadTime
      if (elapsed < 5 * 60 * 1000) {
        console.log('[PresetStore] Using cached presets')
        return
      }
    }
    
    set({ isLoading: true, error: null })
    console.log('[PresetStore] Loading presets from cloud...')
    
    try {
      // 并行加载所有文件夹
      const [
        modelFiles,
        visibleModelFiles,
        bgFiles,
        visibleBgFiles,
        studioModelFiles,
        studioBgLightFiles,
        studioBgSolidFiles,
        studioBgPatternFiles,
        productFiles,
      ] = await Promise.all([
        listStorageFiles('models'),
        listStorageFiles('models/visible'),
        listStorageFiles('backgrounds'),
        listStorageFiles('backgrounds/visible'),
        listStorageFiles('studio-models'),
        listStorageFiles('studio-backgrounds/light'),
        listStorageFiles('studio-backgrounds/solid'),
        listStorageFiles('studio-backgrounds/pattern'),
        listStorageFiles('products'),
      ])
      
      // 转换为 Asset 对象
      const allModels = modelFiles.map(f => fileToAsset(f, 'models', 'model'))
      const visibleModels = visibleModelFiles.map(f => fileToAsset(f, 'models/visible', 'model'))
      const allBackgrounds = bgFiles.map(f => fileToAsset(f, 'backgrounds', 'background'))
      const visibleBackgrounds = visibleBgFiles.map(f => fileToAsset(f, 'backgrounds/visible', 'background'))
      const studioModels = studioModelFiles.map(f => fileToAsset(f, 'studio-models', 'model', 'studio'))
      const studioBackgroundsLight = studioBgLightFiles.map(f => fileToAsset(f, 'studio-backgrounds/light', 'background', 'studio-light'))
      const studioBackgroundsSolid = studioBgSolidFiles.map(f => fileToAsset(f, 'studio-backgrounds/solid', 'background', 'studio-solid'))
      const studioBackgroundsPattern = studioBgPatternFiles.map(f => fileToAsset(f, 'studio-backgrounds/pattern', 'background', 'studio-pattern'))
      const presetProducts = productFiles.map(f => fileToAsset(f, 'products', 'product'))
      
      console.log('[PresetStore] Loaded:', {
        allModels: allModels.length,
        visibleModels: visibleModels.length,
        allBackgrounds: allBackgrounds.length,
        visibleBackgrounds: visibleBackgrounds.length,
        studioModels: studioModels.length,
        studioBackgroundsLight: studioBackgroundsLight.length,
        studioBackgroundsSolid: studioBackgroundsSolid.length,
        studioBackgroundsPattern: studioBackgroundsPattern.length,
        presetProducts: presetProducts.length,
      })
      
      set({
        allModels,
        visibleModels,
        allBackgrounds,
        visibleBackgrounds,
        studioModels,
        studioBackgroundsLight,
        studioBackgroundsSolid,
        studioBackgroundsPattern,
        presetProducts,
        isLoading: false,
        isLoaded: true,
        error: null,
        lastLoadTime: Date.now(),
      })
    } catch (error: any) {
      console.error('[PresetStore] Failed to load presets:', error)
      set({
        isLoading: false,
        error: error.message || 'Failed to load presets',
      })
    }
  },
  
  getRandomModel: () => {
    const { allModels } = get()
    if (allModels.length === 0) return null
    return allModels[Math.floor(Math.random() * allModels.length)]
  },
  
  getRandomBackground: () => {
    const { allBackgrounds } = get()
    if (allBackgrounds.length === 0) return null
    return allBackgrounds[Math.floor(Math.random() * allBackgrounds.length)]
  },
  
  getRandomStudioModel: () => {
    const { studioModels } = get()
    if (studioModels.length === 0) return null
    return studioModels[Math.floor(Math.random() * studioModels.length)]
  },
  
  getRandomStudioBackground: () => {
    const backgrounds = get().getAllStudioBackgrounds()
    if (backgrounds.length === 0) return null
    return backgrounds[Math.floor(Math.random() * backgrounds.length)]
  },
  
  getAllStudioBackgrounds: () => {
    const { studioBackgroundsLight, studioBackgroundsSolid, studioBackgroundsPattern } = get()
    return [...studioBackgroundsLight, ...studioBackgroundsSolid, ...studioBackgroundsPattern]
  },
}))

// 导出便捷函数（兼容旧代码）
export function getRandomModel(): Asset | null {
  return usePresetStore.getState().getRandomModel()
}

export function getRandomBackground(): Asset | null {
  return usePresetStore.getState().getRandomBackground()
}

export function getRandomStudioModel(): Asset | null {
  return usePresetStore.getState().getRandomStudioModel()
}

export function getRandomStudioBackground(): Asset | null {
  return usePresetStore.getState().getRandomStudioBackground()
}

