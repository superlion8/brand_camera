import { Asset, ModelSubcategory, BackgroundSubcategory } from '@/types'

// Supabase Storage base URL
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

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
  { id: 'pm-cn-1', type: 'model', name: '中式 1', imageUrl: `${STORAGE_URL}/models/chinese/model-1.png`, isSystem: true, styleCategory: 'chinese', subcategory: 'chinese' },
  { id: 'pm-cn-2', type: 'model', name: '中式 2', imageUrl: `${STORAGE_URL}/models/chinese/model-2.png`, isSystem: true, styleCategory: 'chinese', subcategory: 'chinese' },
  // Korean
  { id: 'pm-kr-1', type: 'model', name: '韩系 1', imageUrl: `${STORAGE_URL}/models/korean/model-1.png`, isSystem: true, styleCategory: 'korean', subcategory: 'korean' },
  { id: 'pm-kr-2', type: 'model', name: '韩系 2', imageUrl: `${STORAGE_URL}/models/korean/model-2.png`, isSystem: true, styleCategory: 'korean', subcategory: 'korean' },
  { id: 'pm-kr-3', type: 'model', name: '韩系 3', imageUrl: `${STORAGE_URL}/models/korean/model-3.png`, isSystem: true, styleCategory: 'korean', subcategory: 'korean' },
  // Western
  { id: 'pm-ws-1', type: 'model', name: '欧美 1', imageUrl: `${STORAGE_URL}/models/western/model-1.png`, isSystem: true, styleCategory: 'western', subcategory: 'western' },
  { id: 'pm-ws-2', type: 'model', name: '欧美 2', imageUrl: `${STORAGE_URL}/models/western/model-2.png`, isSystem: true, styleCategory: 'western', subcategory: 'western' },
]

// Preset Backgrounds - Using Supabase Storage URLs
export const PRESET_BACKGROUNDS: Asset[] = [
  // Indoor
  { id: 'pb-in-1', type: 'background', name: '室内 1', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-1.jpg`, isSystem: true, subcategory: 'indoor' },
  { id: 'pb-in-2', type: 'background', name: '室内 2', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-2.jpg`, isSystem: true, subcategory: 'indoor' },
  { id: 'pb-in-3', type: 'background', name: '室内 3', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-3.jpg`, isSystem: true, subcategory: 'indoor' },
  { id: 'pb-in-4', type: 'background', name: '室内 4', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-4.jpg`, isSystem: true, subcategory: 'indoor' },
  { id: 'pb-in-5', type: 'background', name: '室内 5', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-5.jpg`, isSystem: true, subcategory: 'indoor' },
  { id: 'pb-in-6', type: 'background', name: '室内 6', imageUrl: `${STORAGE_URL}/backgrounds/indoor/bg-6.jpg`, isSystem: true, subcategory: 'indoor' },
  // Outdoor / Nature
  { id: 'pb-out-1', type: 'background', name: '自然 1', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-1.jpg`, isSystem: true, subcategory: 'outdoor' },
  { id: 'pb-out-2', type: 'background', name: '自然 2', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-2.jpg`, isSystem: true, subcategory: 'outdoor' },
  { id: 'pb-out-3', type: 'background', name: '自然 3', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-3.jpg`, isSystem: true, subcategory: 'outdoor' },
  { id: 'pb-out-4', type: 'background', name: '自然 4', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-4.jpg`, isSystem: true, subcategory: 'outdoor' },
  { id: 'pb-out-5', type: 'background', name: '自然 5', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-5.jpg`, isSystem: true, subcategory: 'outdoor' },
  { id: 'pb-out-6', type: 'background', name: '自然 6', imageUrl: `${STORAGE_URL}/backgrounds/outdoor/bg-6.jpg`, isSystem: true, subcategory: 'outdoor' },
  // Street
  { id: 'pb-st-1', type: 'background', name: '街头 1', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-1.jpg`, isSystem: true, subcategory: 'street' },
  { id: 'pb-st-2', type: 'background', name: '街头 2', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-2.jpg`, isSystem: true, subcategory: 'street' },
  { id: 'pb-st-3', type: 'background', name: '街头 3', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-3.jpg`, isSystem: true, subcategory: 'street' },
  { id: 'pb-st-4', type: 'background', name: '街头 4', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-4.jpg`, isSystem: true, subcategory: 'street' },
  { id: 'pb-st-5', type: 'background', name: '街头 5', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-5.jpg`, isSystem: true, subcategory: 'street' },
  { id: 'pb-st-6', type: 'background', name: '街头 6', imageUrl: `${STORAGE_URL}/backgrounds/street/bg-6.jpg`, isSystem: true, subcategory: 'street' },
]

// Preset Vibes - Using Supabase Storage URLs
export const PRESET_VIBES: Asset[] = [
  { id: 'pv-1', type: 'vibe', name: '氛围 1', imageUrl: `${STORAGE_URL}/vibes/vibe-1.png`, isSystem: true },
  { id: 'pv-2', type: 'vibe', name: '氛围 2', imageUrl: `${STORAGE_URL}/vibes/vibe-2.png`, isSystem: true },
  { id: 'pv-3', type: 'vibe', name: '氛围 3', imageUrl: `${STORAGE_URL}/vibes/vibe-3.png`, isSystem: true },
]

// Helper functions
export function getModelsBySubcategory(subcategory?: ModelSubcategory): Asset[] {
  if (!subcategory) return PRESET_MODELS
  return PRESET_MODELS.filter(m => m.subcategory === subcategory)
}

export function getBackgroundsBySubcategory(subcategory?: BackgroundSubcategory): Asset[] {
  if (!subcategory) return PRESET_BACKGROUNDS
  return PRESET_BACKGROUNDS.filter(b => b.subcategory === subcategory)
}
