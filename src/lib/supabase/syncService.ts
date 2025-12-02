import { createClient } from './client'
import { Asset, AssetType, Generation, Favorite } from '@/types'

const supabase = createClient()

// ============== User Assets ==============

export async function fetchUserAssets(userId: string): Promise<{
  models: Asset[]
  backgrounds: Asset[]
  products: Asset[]
  vibes: Asset[]
}> {
  const { data, error } = await supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user assets:', error)
    return { models: [], backgrounds: [], products: [], vibes: [] }
  }

  const assets = (data || []).map(row => ({
    id: row.id,
    type: row.type as AssetType,
    name: row.name,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    tags: row.tags,
    subcategory: row.subcategory,
    isPinned: row.is_pinned,
  }))

  return {
    models: assets.filter(a => a.type === 'model'),
    backgrounds: assets.filter(a => a.type === 'background'),
    products: assets.filter(a => a.type === 'product'),
    vibes: assets.filter(a => a.type === 'vibe'),
  }
}

export async function saveUserAsset(userId: string, asset: Asset): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('user_assets')
    .insert({
      id: asset.id,
      user_id: userId,
      type: asset.type,
      name: asset.name,
      image_url: asset.imageUrl,
      thumbnail_url: asset.thumbnailUrl,
      tags: asset.tags,
      subcategory: asset.subcategory,
      is_pinned: asset.isPinned || false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving user asset:', error)
    return null
  }

  return {
    id: data.id,
    type: data.type as AssetType,
    name: data.name,
    imageUrl: data.image_url,
    thumbnailUrl: data.thumbnail_url,
    tags: data.tags,
    subcategory: data.subcategory,
    isPinned: data.is_pinned,
  }
}

export async function updateUserAssetPin(userId: string, assetId: string, isPinned: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('user_assets')
    .update({ is_pinned: isPinned })
    .eq('id', assetId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating asset pin:', error)
    return false
  }
  return true
}

export async function deleteUserAsset(userId: string, assetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting user asset:', error)
    return false
  }
  return true
}

// ============== Generations ==============

export async function fetchGenerations(userId: string): Promise<Generation[]> {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching generations:', error)
    return []
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    inputImageUrl: row.input_image_url,
    inputImage2Url: row.input_image2_url,
    outputImageUrls: row.output_image_urls,
    outputModelTypes: row.output_model_types,
    outputGenModes: row.output_gen_modes,
    prompt: row.prompt,
    prompts: row.prompts,
    params: row.params,
    createdAt: row.created_at,
  }))
}

export async function saveGeneration(userId: string, generation: Generation): Promise<Generation | null> {
  const { data, error } = await supabase
    .from('generations')
    .insert({
      id: generation.id,
      user_id: userId,
      type: generation.type,
      input_image_url: generation.inputImageUrl,
      input_image2_url: generation.inputImage2Url,
      output_image_urls: generation.outputImageUrls,
      output_model_types: generation.outputModelTypes,
      output_gen_modes: generation.outputGenModes,
      prompt: generation.prompt,
      prompts: generation.prompts,
      params: generation.params,
      created_at: generation.createdAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving generation:', error)
    return null
  }

  return {
    id: data.id,
    type: data.type,
    inputImageUrl: data.input_image_url,
    inputImage2Url: data.input_image2_url,
    outputImageUrls: data.output_image_urls,
    outputModelTypes: data.output_model_types,
    outputGenModes: data.output_gen_modes,
    prompt: data.prompt,
    prompts: data.prompts,
    params: data.params,
    createdAt: data.created_at,
  }
}

export async function deleteGeneration(userId: string, generationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('generations')
    .delete()
    .eq('id', generationId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting generation:', error)
    return false
  }
  return true
}

// ============== Favorites ==============

export async function fetchFavorites(userId: string): Promise<Favorite[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching favorites:', error)
    return []
  }

  return (data || []).map(row => ({
    id: row.id,
    generationId: row.generation_id,
    imageIndex: row.image_index,
    createdAt: row.created_at,
  }))
}

export async function saveFavorite(userId: string, favorite: Favorite): Promise<Favorite | null> {
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      id: favorite.id,
      user_id: userId,
      generation_id: favorite.generationId,
      image_index: favorite.imageIndex,
      created_at: favorite.createdAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving favorite:', error)
    return null
  }

  return {
    id: data.id,
    generationId: data.generation_id,
    imageIndex: data.image_index,
    createdAt: data.created_at,
  }
}

export async function deleteFavorite(userId: string, favoriteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('id', favoriteId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting favorite:', error)
    return false
  }
  return true
}

// ============== Pinned Presets ==============

export async function fetchPinnedPresets(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('pinned_presets')
    .select('preset_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching pinned presets:', error)
    return new Set()
  }

  return new Set((data || []).map(row => row.preset_id))
}

export async function togglePinnedPreset(userId: string, presetId: string, isPinned: boolean): Promise<boolean> {
  if (isPinned) {
    const { error } = await supabase
      .from('pinned_presets')
      .insert({ user_id: userId, preset_id: presetId })

    if (error) {
      console.error('Error pinning preset:', error)
      return false
    }
  } else {
    const { error } = await supabase
      .from('pinned_presets')
      .delete()
      .eq('user_id', userId)
      .eq('preset_id', presetId)

    if (error) {
      console.error('Error unpinning preset:', error)
      return false
    }
  }
  return true
}

// ============== Sync All Data ==============

export interface SyncData {
  userModels: Asset[]
  userBackgrounds: Asset[]
  userProducts: Asset[]
  userVibes: Asset[]
  generations: Generation[]
  favorites: Favorite[]
  pinnedPresetIds: Set<string>
}

export async function syncAllData(userId: string): Promise<SyncData> {
  const [assets, generations, favorites, pinnedPresetIds] = await Promise.all([
    fetchUserAssets(userId),
    fetchGenerations(userId),
    fetchFavorites(userId),
    fetchPinnedPresets(userId),
  ])

  return {
    userModels: assets.models,
    userBackgrounds: assets.backgrounds,
    userProducts: assets.products,
    userVibes: assets.vibes,
    generations,
    favorites,
    pinnedPresetIds,
  }
}

