import { Asset, AssetType } from '@/types'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

// Cache buster version - increment to force refresh
const CACHE_VERSION = 'v5'

// Preset Models - 82 total (no subcategories)
export const PRESET_MODELS: Asset[] = Array.from({ length: 82 }, (_, i) => ({
  id: `pm-${i + 1}`,
  type: 'model' as AssetType,
  name: `模特 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/models/model-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))

// Preset Backgrounds - 126 total (no subcategories)
export const PRESET_BACKGROUNDS: Asset[] = Array.from({ length: 126 }, (_, i) => ({
  id: `pb-${i + 1}`,
  type: 'background' as AssetType,
  name: `环境 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/backgrounds/bg-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))

// Preset Vibes - Using Supabase Storage URLs
export const PRESET_VIBES: Asset[] = [
  { id: 'pv-1', type: 'vibe', name: '氛围 1', imageUrl: `${STORAGE_URL}/vibes/vibe-1.png`, isSystem: true },
  { id: 'pv-2', type: 'vibe', name: '氛围 2', imageUrl: `${STORAGE_URL}/vibes/vibe-2.png`, isSystem: true },
  { id: 'pv-3', type: 'vibe', name: '氛围 3', imageUrl: `${STORAGE_URL}/vibes/vibe-3.png`, isSystem: true },
]

// Preset Products - 15 total
export const PRESET_PRODUCTS: Asset[] = Array.from({ length: 15 }, (_, i) => ({
  id: `pp-${i + 1}`,
  type: 'product' as AssetType,
  name: `商品 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/products/product-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))
