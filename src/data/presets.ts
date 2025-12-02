import { Asset, AssetType } from '@/types'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

// Cache buster version - increment to force refresh
const CACHE_VERSION = 'v4'

// Model subcategory type (updated)
export type ModelSubcategory = 'korean' | 'western'

// Background subcategory type  
export type BackgroundSubcategory = 'indoor' | 'street'

// Model subcategory labels
export const MODEL_SUBCATEGORIES: { id: ModelSubcategory; label: string }[] = [
  { id: 'korean', label: '韩模' },
  { id: 'western', label: '外模' },
]

// Background subcategory labels
export const BACKGROUND_SUBCATEGORIES: { id: BackgroundSubcategory; label: string }[] = [
  { id: 'indoor', label: '室内' },
  { id: 'street', label: '街头' },
]

// Preset Models - 70 total (外模 32 + 韩模 38)
export const PRESET_MODELS: Asset[] = [
  // 外模 (32)
  ...Array.from({ length: 32 }, (_, i) => ({
    id: `pm-we-${i + 1}`,
    type: 'model' as AssetType,
    name: `外模 ${i + 1}`,
    imageUrl: `${STORAGE_URL}/models/western/model-${i + 1}.jpg?${CACHE_VERSION}`,
    isSystem: true,
    styleCategory: 'western' as const,
    category: 'western' as ModelSubcategory,
  })),
  // 韩模 (38)
  ...Array.from({ length: 38 }, (_, i) => ({
    id: `pm-ko-${i + 1}`,
    type: 'model' as AssetType,
    name: `韩模 ${i + 1}`,
    imageUrl: `${STORAGE_URL}/models/korean/model-${i + 1}.jpg?${CACHE_VERSION}`,
    isSystem: true,
    styleCategory: 'korean' as const,
    category: 'korean' as ModelSubcategory,
  })),
]

// Preset Backgrounds - 104 total (室内 58 + 街头 46)
export const PRESET_BACKGROUNDS: Asset[] = [
  // 室内 (58)
  ...Array.from({ length: 58 }, (_, i) => ({
    id: `pb-in-${i + 1}`,
    type: 'background' as AssetType,
    name: `室内 ${i + 1}`,
    imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-${i + 1}.jpg?${CACHE_VERSION}`,
    isSystem: true,
    category: 'indoor' as BackgroundSubcategory,
  })),
  // 街头 (46)
  ...Array.from({ length: 46 }, (_, i) => ({
    id: `pb-st-${i + 1}`,
    type: 'background' as AssetType,
    name: `街头 ${i + 1}`,
    imageUrl: `${STORAGE_URL}/backgrounds/street/bg-${i + 1}.jpg?${CACHE_VERSION}`,
    isSystem: true,
    category: 'street' as BackgroundSubcategory,
  })),
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
