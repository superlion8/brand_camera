import { Asset, AssetType } from '@/types'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

// Cache buster version - increment to force refresh
const CACHE_VERSION = 'v6'

// ============================================================
// ALL PRESET ASSETS (used for random selection during generation)
// ============================================================

// All Models - 82 total (for random selection)
export const ALL_PRESET_MODELS: Asset[] = Array.from({ length: 82 }, (_, i) => ({
  id: `pm-${i + 1}`,
  type: 'model' as AssetType,
  name: `模特 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/models/model-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))

// All Backgrounds - 126 total (for random selection)
export const ALL_PRESET_BACKGROUNDS: Asset[] = Array.from({ length: 126 }, (_, i) => ({
  id: `pb-${i + 1}`,
  type: 'background' as AssetType,
  name: `环境 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/backgrounds/bg-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))

// ============================================================
// VISIBLE PRESET ASSETS (shown to users in UI)
// ============================================================

// Visible Models - 10 total (shown in UI selection)
export const VISIBLE_PRESET_MODELS: Asset[] = Array.from({ length: 10 }, (_, i) => ({
  id: `pm-v-${i + 1}`,
  type: 'model' as AssetType,
  name: `模特 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/models/visible/model-v-${i + 1}.png?${CACHE_VERSION}`,
  isSystem: true,
}))

// Visible Backgrounds - 10 total (shown in UI selection)
export const VISIBLE_PRESET_BACKGROUNDS: Asset[] = Array.from({ length: 10 }, (_, i) => ({
  id: `pb-v-${i + 1}`,
  type: 'background' as AssetType,
  name: `环境 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/backgrounds/visible/bg-v-${i + 1}.jpg?${CACHE_VERSION}`,
  isSystem: true,
}))

// ============================================================
// BACKWARDS COMPATIBILITY EXPORTS
// These point to VISIBLE assets for UI display
// ============================================================

// For UI display - use visible presets
export const PRESET_MODELS = VISIBLE_PRESET_MODELS
export const PRESET_BACKGROUNDS = VISIBLE_PRESET_BACKGROUNDS

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

// ============================================================
// STUDIO (专业棚拍) ASSETS
// ============================================================

// Studio Models (专业模特/高级模特) - 21 total
// 文件位于 presets/studio-models/01.jpg ~ 21.jpg
export const STUDIO_MODELS: Asset[] = Array.from({ length: 21 }, (_, i) => ({
  id: `studio-model-${i + 1}`,
  type: 'model' as AssetType,
  name: `高级模特 ${i + 1}`,
  imageUrl: `${STORAGE_URL}/studio-models/${String(i + 1).padStart(2, '0')}.jpg?${CACHE_VERSION}`,
  isSystem: true,
  category: 'studio', // 标记为专业棚拍类型
}))

// Studio Backgrounds - Light (打光背景) - 15 total
export const STUDIO_BG_LIGHT: Asset[] = Array.from({ length: 15 }, (_, i) => ({
  id: `studio-bg-light-${i + 1}`,
  type: 'background' as AssetType,
  name: `打光背景 ${String(i + 1).padStart(2, '0')}`,
  imageUrl: `${STORAGE_URL}/studio-backgrounds/light/${String(i + 1).padStart(2, '0')}.jpg?${CACHE_VERSION}`,
  isSystem: true,
  category: 'studio-light',
}))

// Studio Backgrounds - Solid (纯色背景) - 3 files: 01.jpg, 02.jpg, 12.jpg
const SOLID_BG_FILES = ['01', '02', '12']
export const STUDIO_BG_SOLID: Asset[] = SOLID_BG_FILES.map((num, i) => ({
  id: `studio-bg-solid-${num}`,
  type: 'background' as AssetType,
  name: `纯色背景 ${num}`,
  imageUrl: `${STORAGE_URL}/studio-backgrounds/solid/${num}.jpg?${CACHE_VERSION}`,
  isSystem: true,
  category: 'studio-solid',
}))

// Studio Backgrounds - Pattern (花色背景) - 15 total
export const STUDIO_BG_PATTERN: Asset[] = Array.from({ length: 15 }, (_, i) => ({
  id: `studio-bg-pattern-${i + 1}`,
  type: 'background' as AssetType,
  name: `花色背景 ${String(i + 1).padStart(2, '0')}`,
  imageUrl: `${STORAGE_URL}/studio-backgrounds/pattern/${String(i + 1).padStart(2, '0')}.jpg?${CACHE_VERSION}`,
  isSystem: true,
  category: 'studio-pattern',
}))

// All Studio Backgrounds combined
export const ALL_STUDIO_BACKGROUNDS: Asset[] = [
  ...STUDIO_BG_LIGHT,
  ...STUDIO_BG_SOLID,
  ...STUDIO_BG_PATTERN,
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Get a random model from ALL presets (for 买家秀 when user doesn't select)
export function getRandomModel(): Asset {
  const index = Math.floor(Math.random() * ALL_PRESET_MODELS.length)
  return ALL_PRESET_MODELS[index]
}

// Get a random background from ALL presets (for 买家秀 when user doesn't select)
export function getRandomBackground(): Asset {
  const index = Math.floor(Math.random() * ALL_PRESET_BACKGROUNDS.length)
  return ALL_PRESET_BACKGROUNDS[index]
}

// Get a random studio model (for 专业棚拍 when user doesn't select)
export function getRandomStudioModel(): Asset {
  const index = Math.floor(Math.random() * STUDIO_MODELS.length)
  return STUDIO_MODELS[index]
}

// Get a random studio background (for 专业棚拍 when user doesn't select)
export function getRandomStudioBackground(): Asset {
  const index = Math.floor(Math.random() * ALL_STUDIO_BACKGROUNDS.length)
  return ALL_STUDIO_BACKGROUNDS[index]
}
