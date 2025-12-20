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
 * ├── pro_studio/                # 专业棚拍背景（pro_scene_1~61.jpg）
 * └── products/                  # 预设商品
 */

import { create } from 'zustand'
import { Asset, AssetType } from '@/types'

interface PresetState {
  // 买家秀资源
  allModels: Asset[]           // 随机池
  visibleModels: Asset[]       // 用户可见
  allBackgrounds: Asset[]      // 随机池
  visibleBackgrounds: Asset[]  // 用户可见
  
  // 专业棚拍资源
  studioModels: Asset[]
  studioBackgrounds: Asset[]   // 所有棚拍背景（合并后）
  
  // 预设商品
  presetProducts: Asset[]
  
  // 状态
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  lastLoadTime: number | null
  
  // Actions
  loadPresets: (forceRefresh?: boolean) => Promise<void>
  getRandomModel: () => Asset | null
  getRandomBackground: () => Asset | null
  getRandomStudioModel: () => Asset | null
  getRandomStudioBackground: () => Asset | null
}

// API 返回的资源格式
interface ApiAsset {
  name: string       // 文件名（如 02.jpg）
  displayName: string // 不含扩展名（如 02）
  url: string        // 完整的公开 URL（由 Supabase SDK 生成）
}

// Helper: 从 API 响应转换为 Asset
function apiAssetToAsset(
  apiAsset: ApiAsset, 
  folder: string, 
  type: AssetType,
  category?: string
): Asset {
  return {
    id: `preset-${folder.replace(/\//g, '-')}-${apiAsset.displayName}`,
    type,
    name: apiAsset.displayName,
    imageUrl: apiAsset.url,  // 使用 Supabase SDK 生成的 URL
    isSystem: true,
    category,
  }
}

// Helper: 从 API 获取资源列表（返回完整 URL）
async function fetchPresetAssets(folder: string): Promise<ApiAsset[]> {
  try {
    // 添加时间戳和随机数确保不走缓存
    const cacheBuster = `t=${Date.now()}&r=${Math.random().toString(36).substring(7)}`
    const url = `/api/presets/list?folder=${encodeURIComponent(folder)}&${cacheBuster}`
    
    console.log(`[PresetStore] Fetching: ${folder}`)
    
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',  // 禁止浏览器缓存
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })
    
    if (!response.ok) {
      console.error(`[PresetStore] Failed to fetch ${folder}: HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    console.log(`[PresetStore] Got ${folder}: ${data.assets?.length || 0} items`)
    return data.assets || []
  } catch (error) {
    console.error(`[PresetStore] Error fetching ${folder}:`, error)
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
  studioBackgrounds: [],
  presetProducts: [],
  
  isLoading: false,
  isLoaded: false,
  error: null,
  lastLoadTime: null,
  
  loadPresets: async (forceRefresh = false) => {
    // 强制刷新时，完全忽略所有缓存和状态检查
    if (forceRefresh) {
      console.log('[PresetStore] FORCE REFRESH - ignoring all cache')
      set({ isLoading: true, isLoaded: false, lastLoadTime: null, error: null })
    } else {
      const state = get()
      
      // 如果已经在加载，跳过
      if (state.isLoading) {
        console.log('[PresetStore] Already loading, skipping')
        return
      }
      
      // 如果已加载且在 5 分钟内，使用缓存
      if (state.isLoaded && state.lastLoadTime) {
        const elapsed = Date.now() - state.lastLoadTime
        if (elapsed < 5 * 60 * 1000) {
          console.log('[PresetStore] Using cached presets (age:', Math.round(elapsed/1000), 's)')
          return
        }
      }
      
      set({ isLoading: true, error: null })
    }
    
    console.log('[PresetStore] Fetching presets from cloud...')
    
    try {
      // 并行加载所有文件夹（API 返回完整 URL）
      const [
        modelAssets,
        visibleModelAssets,
        bgAssets,
        visibleBgAssets,
        studioModelAssets,
        studioBgAssets,
        productAssets,
      ] = await Promise.all([
        fetchPresetAssets('models'),
        fetchPresetAssets('models/visible'),
        fetchPresetAssets('backgrounds'),
        fetchPresetAssets('backgrounds/visible'),
        fetchPresetAssets('studio-models'),
        fetchPresetAssets('pro_studio'),
        fetchPresetAssets('products'),
      ])
      
      // 转换为 Asset 对象（URL 已由 API 生成）
      const allModels = modelAssets.map(a => apiAssetToAsset(a, 'models', 'model'))
      const visibleModels = visibleModelAssets.map(a => apiAssetToAsset(a, 'models/visible', 'model'))
      const allBackgrounds = bgAssets.map(a => apiAssetToAsset(a, 'backgrounds', 'background'))
      const visibleBackgrounds = visibleBgAssets.map(a => apiAssetToAsset(a, 'backgrounds/visible', 'background'))
      const studioModels = studioModelAssets.map(a => apiAssetToAsset(a, 'studio-models', 'model', 'studio'))
      const studioBackgrounds = studioBgAssets.map(a => apiAssetToAsset(a, 'pro_studio', 'background', 'studio'))
      const presetProducts = productAssets.map(a => apiAssetToAsset(a, 'products', 'product'))
      
      console.log('[PresetStore] Loaded:', {
        allModels: allModels.length,
        visibleModels: visibleModels.length,
        allBackgrounds: allBackgrounds.length,
        visibleBackgrounds: visibleBackgrounds.length,
        studioModels: studioModels.length,
        studioBackgrounds: studioBackgrounds.length,
        presetProducts: presetProducts.length,
      })
      
      set({
        allModels,
        visibleModels,
        allBackgrounds,
        visibleBackgrounds,
        studioModels,
        studioBackgrounds,
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
    const { studioBackgrounds } = get()
    if (studioBackgrounds.length === 0) return null
    return studioBackgrounds[Math.floor(Math.random() * studioBackgrounds.length)]
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

