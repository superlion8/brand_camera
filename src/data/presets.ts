import { Asset, AssetType } from '@/types'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

// Model subcategory type
export type ModelSubcategory = 'chinese' | 'korean' | 'western'

// Background subcategory type  
export type BackgroundSubcategory = 'indoor' | 'outdoor' | 'street'

// Model subcategory labels
export const MODEL_SUBCATEGORIES: { id: ModelSubcategory; label: string }[] = [
  { id: 'chinese', label: '中式' },
  { id: 'korean', label: '韩系' },
  { id: 'western', label: '欧美' },
]

// Background subcategory labels
export const BACKGROUND_SUBCATEGORIES: { id: BackgroundSubcategory; label: string }[] = [
  { id: 'indoor', label: '室内' },
  { id: 'outdoor', label: '自然' },
  { id: 'street', label: '街头' },
]

// Preset Models - Using Supabase Storage URLs
export const PRESET_MODELS: Asset[] = [
  // Chinese
  { id: 'pm-cn-1', type: 'model', name: '中式 1', imageUrl: `${STORAGE_URL}/models/chinese/model-1.png`, isSystem: true, styleCategory: 'chinese', category: 'chinese' },
  { id: 'pm-cn-2', type: 'model', name: '中式 2', imageUrl: `${STORAGE_URL}/models/chinese/model-2.png`, isSystem: true, styleCategory: 'chinese', category: 'chinese' },
  // Korean
  { id: 'pm-kr-1', type: 'model', name: '韩系 1', imageUrl: `${STORAGE_URL}/models/korean/model-1.png`, isSystem: true, styleCategory: 'korean', category: 'korean' },
  { id: 'pm-kr-2', type: 'model', name: '韩系 2', imageUrl: `${STORAGE_URL}/models/korean/model-2.png`, isSystem: true, styleCategory: 'korean', category: 'korean' },
  { id: 'pm-kr-3', type: 'model', name: '韩系 3', imageUrl: `${STORAGE_URL}/models/korean/model-3.png`, isSystem: true, styleCategory: 'korean', category: 'korean' },
  // Western
  { id: 'pm-ws-1', type: 'model', name: '欧美 1', imageUrl: `${STORAGE_URL}/models/western/model-1.png`, isSystem: true, styleCategory: 'western', category: 'western' },
  { id: 'pm-ws-2', type: 'model', name: '欧美 2', imageUrl: `${STORAGE_URL}/models/western/model-2.png`, isSystem: true, styleCategory: 'western', category: 'western' },
]

// Preset Backgrounds - 232 images total (室内 100, 自然 24, 街头 108)
export const PRESET_BACKGROUNDS: Asset[] = [
  // 室内 (100)
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = i + 1
    // Most are jpg, some are png (96-100)
    const ext = idx >= 96 ? 'png' : 'jpg'
    return {
      id: `pb-in-${idx}`,
      type: 'background' as AssetType,
      name: `室内 ${idx}`,
      imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-${idx}.${ext}`,
      isSystem: true,
      category: 'indoor' as const
    }
  }),
  
  // 自然 (24)
  ...Array.from({ length: 24 }, (_, i) => {
    const idx = i + 1
    // 1-17 are jpg, 18-24 are png
    const ext = idx >= 18 ? 'png' : 'jpg'
    return {
      id: `pb-ou-${idx}`,
      type: 'background' as AssetType,
      name: `自然 ${idx}`,
      imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-${idx}.${ext}`,
      isSystem: true,
      category: 'outdoor' as const
    }
  }),
  
  // 街头 (108)
  ...Array.from({ length: 108 }, (_, i) => {
    const idx = i + 1
    // 2-9, 13-15, 17-18, 21-64, 66-82 are jpg; 83-108 are png; rest are converted from heic to jpg
    const ext = idx >= 83 ? 'png' : 'jpg'
    return {
      id: `pb-st-${idx}`,
      type: 'background' as AssetType,
      name: `街头 ${idx}`,
      imageUrl: `${STORAGE_URL}/backgrounds/street/bg-${idx}.${ext}`,
      isSystem: true,
      category: 'street' as const
    }
  }),
]

// Preset Vibes - Using Supabase Storage URLs
export const PRESET_VIBES: Asset[] = [
  { id: 'pv-1', type: 'vibe', name: '氛围 1', imageUrl: `${STORAGE_URL}/vibes/vibe-1.png`, isSystem: true },
  { id: 'pv-2', type: 'vibe', name: '氛围 2', imageUrl: `${STORAGE_URL}/vibes/vibe-2.png`, isSystem: true },
  { id: 'pv-3', type: 'vibe', name: '氛围 3', imageUrl: `${STORAGE_URL}/vibes/vibe-3.png`, isSystem: true },
]

// Preset Products (官方示例) - Using Supabase Storage URLs
export const PRESET_PRODUCTS: Asset[] = [
  { id: 'pp-1', type: 'product', name: '示例 1', imageUrl: `${STORAGE_URL}/products/product-1.jpg`, isSystem: true },
  { id: 'pp-2', type: 'product', name: '示例 2', imageUrl: `${STORAGE_URL}/products/product-2.jpg`, isSystem: true },
  { id: 'pp-3', type: 'product', name: '示例 3', imageUrl: `${STORAGE_URL}/products/product-3.jpg`, isSystem: true },
  { id: 'pp-4', type: 'product', name: '示例 4', imageUrl: `${STORAGE_URL}/products/product-4.jpg`, isSystem: true },
  { id: 'pp-5', type: 'product', name: '示例 5', imageUrl: `${STORAGE_URL}/products/product-5.jpg`, isSystem: true },
  { id: 'pp-6', type: 'product', name: '示例 6', imageUrl: `${STORAGE_URL}/products/product-6.jpg`, isSystem: true },
  { id: 'pp-7', type: 'product', name: '示例 7', imageUrl: `${STORAGE_URL}/products/product-7.jpg`, isSystem: true },
  { id: 'pp-8', type: 'product', name: '示例 8', imageUrl: `${STORAGE_URL}/products/product-8.jpg`, isSystem: true },
  { id: 'pp-9', type: 'product', name: '示例 9', imageUrl: `${STORAGE_URL}/products/product-9.jpg`, isSystem: true },
  { id: 'pp-10', type: 'product', name: '示例 10', imageUrl: `${STORAGE_URL}/products/product-10.jpg`, isSystem: true },
  { id: 'pp-11', type: 'product', name: '示例 11', imageUrl: `${STORAGE_URL}/products/product-11.jpg`, isSystem: true },
]

// Combined presets by type
export const allPresets: Record<AssetType, Asset[]> = {
  model: PRESET_MODELS,
  background: PRESET_BACKGROUNDS,
  vibe: PRESET_VIBES,
  product: PRESET_PRODUCTS,
}

// Helper functions
export function getModelsByCategory(category?: ModelSubcategory): Asset[] {
  if (!category) return PRESET_MODELS
  return PRESET_MODELS.filter(m => m.category === category)
}

export function getBackgroundsByCategory(category?: BackgroundSubcategory): Asset[] {
  if (!category) return PRESET_BACKGROUNDS
  return PRESET_BACKGROUNDS.filter(b => b.category === category)
}
