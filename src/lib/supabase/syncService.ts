import { createClient } from './client'
import { Asset, AssetType, Generation, Favorite } from '@/types'

// Create a new client for each request to ensure fresh auth state
function getSupabase() {
  return createClient()
}

// ============== User Assets ==============

export async function fetchUserAssets(userId: string): Promise<{
  models: Asset[]
  backgrounds: Asset[]
  products: Asset[]
  vibes: Asset[]
}> {
  console.log('[Sync] Fetching user assets for:', userId)
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('user_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Sync] Error fetching user assets:', error.message, error.code)
    // If table doesn't exist, return empty but don't crash
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('[Sync] user_assets table does not exist. Please run the migration.')
    }
    return { models: [], backgrounds: [], products: [], vibes: [] }
  }
  
  console.log('[Sync] Fetched user assets:', data?.length || 0)

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
  console.log('[Sync] Saving user asset:', { userId, assetId: asset.id, type: asset.type })
  
  const supabase = getSupabase()
  
  // Check if we have a valid session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('[Sync] No active session, cannot save asset')
    return null
  }
  
  console.log('[Sync] Session user ID:', session.user.id, 'Requested user ID:', userId)
  
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
    console.error('[Sync] Error saving user asset:', error.message, error.code, error.details)
    return null
  }

  console.log('[Sync] Asset saved successfully:', data.id)
  
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
  const supabase = getSupabase()
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
  const supabase = getSupabase()
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
  console.log('[Sync] Fetching generations for:', userId)
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Sync] Error fetching generations:', error.message, error.code)
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('[Sync] generations table does not exist. Please run the migration.')
    }
    return []
  }
  
  console.log('[Sync] Fetched generations:', data?.length || 0)

  return (data || [])
    // Filter out generations without valid output images
    .filter(row => {
      const urls = row.output_image_urls || row.output_images
      return urls && Array.isArray(urls) && urls.length > 0
    })
    .map(row => {
      // Handle both old and new table schemas
      let outputUrls = row.output_image_urls || []
      
      // If using new schema with output_images JSONB
      if (row.output_images && Array.isArray(row.output_images)) {
        outputUrls = row.output_images.map((img: any) => img.url || img)
      }
      
      return {
        id: row.id,
        type: row.type || row.task_type,
        inputImageUrl: row.input_image_url || '',
        inputImage2Url: row.input_image2_url,
        outputImageUrls: outputUrls,
        outputModelTypes: row.output_model_types || [],
        outputGenModes: row.output_gen_modes || [],
        prompt: row.prompt || row.final_prompt,
        prompts: row.prompts || [],
        params: row.params || row.input_params,
        createdAt: row.created_at,
      }
    })
}

export async function saveGeneration(userId: string, generation: Generation): Promise<Generation | null> {
  const supabase = getSupabase()
  
  // Build insert object with only non-null values
  // Note: Don't include 'id' - let database generate UUID
  // Note: Don't include 'params' - column may not exist
  const insertData: Record<string, any> = {
    user_id: userId,
    status: 'completed',
  }
  
  // Add fields that are likely to exist
  if (generation.inputImageUrl) insertData.input_image_url = generation.inputImageUrl
  if (generation.inputImage2Url) insertData.input_image2_url = generation.inputImage2Url
  if (generation.outputImageUrls?.length) insertData.output_image_urls = generation.outputImageUrls
  if (generation.prompt) insertData.prompt = generation.prompt
  if (generation.createdAt) insertData.created_at = generation.createdAt
  
  // These columns may or may not exist depending on schema version
  // if (generation.type) insertData.type = generation.type
  // if (generation.outputModelTypes?.length) insertData.output_model_types = generation.outputModelTypes
  // if (generation.outputGenModes?.length) insertData.output_gen_modes = generation.outputGenModes
  // if (generation.prompts?.length) insertData.prompts = generation.prompts
  
  console.log('[Sync] Saving generation:', generation.id)
  
  const { data, error } = await supabase
    .from('generations')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[Sync] Error saving generation:', error.message, error.code)
    // If column doesn't exist, try with absolute minimal fields
    if (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema cache')) {
      console.warn('[Sync] Trying minimal insert (schema mismatch)...')
      
      // Absolute minimal - just the required fields
      const minimalData: Record<string, any> = {
        user_id: userId,
        status: 'completed',
      }
      
      // Try to add what we can
      if (generation.inputImageUrl) minimalData.input_image_url = generation.inputImageUrl
      if (generation.outputImageUrls?.length) {
        // Try output_image_urls first (TEXT[])
        minimalData.output_image_urls = generation.outputImageUrls
      }
      
      const { data: retryData, error: retryError } = await supabase
        .from('generations')
        .insert(minimalData)
        .select()
        .single()
      
      if (retryError) {
        console.error('[Sync] Retry also failed:', retryError.message)
        // Don't block - just log and continue
        return null
      }
      console.log('[Sync] Minimal insert succeeded')
      return mapGenerationRow(retryData)
    }
    return null
  }

  console.log('[Sync] Generation saved successfully')
  return mapGenerationRow(data)
}

// Helper to map database row to Generation type
function mapGenerationRow(data: any): Generation {
  return {
    id: data.id,
    type: data.type || data.task_type,
    inputImageUrl: data.input_image_url || '',
    inputImage2Url: data.input_image2_url,
    outputImageUrls: data.output_image_urls || [],
    outputModelTypes: data.output_model_types || [],
    outputGenModes: data.output_gen_modes || [],
    prompt: data.prompt || data.final_prompt,
    prompts: data.prompts || [],
    params: data.params || data.input_params,
    createdAt: data.created_at,
  }
}

export async function deleteGeneration(userId: string, generationId: string): Promise<boolean> {
  const supabase = getSupabase()
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
  console.log('[Sync] Fetching favorites for:', userId)
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Sync] Error fetching favorites:', error.message, error.code)
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('[Sync] favorites table does not exist. Please run the migration.')
    }
    return []
  }
  
  console.log('[Sync] Fetched favorites:', data?.length || 0)

  return (data || []).map(row => ({
    id: row.id,
    generationId: row.generation_id,
    imageIndex: row.image_index,
    createdAt: row.created_at,
  }))
}

export async function saveFavorite(userId: string, favorite: Favorite): Promise<Favorite | null> {
  const supabase = getSupabase()
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
  const supabase = getSupabase()
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
  console.log('[Sync] Fetching pinned presets for:', userId)
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('pinned_presets')
    .select('preset_id')
    .eq('user_id', userId)

  if (error) {
    console.error('[Sync] Error fetching pinned presets:', error.message, error.code)
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('[Sync] pinned_presets table does not exist. Please run the migration.')
    }
    return new Set()
  }
  
  console.log('[Sync] Fetched pinned presets:', data?.length || 0)
  return new Set((data || []).map(row => row.preset_id))
}

export async function togglePinnedPreset(userId: string, presetId: string, isPinned: boolean): Promise<boolean> {
  const supabase = getSupabase()
  
  if (isPinned) {
    const { error } = await supabase
      .from('pinned_presets')
      .insert({ user_id: userId, preset_id: presetId })

    if (error) {
      console.error('[Sync] Error pinning preset:', error.message)
      return false
    }
  } else {
    const { error } = await supabase
      .from('pinned_presets')
      .delete()
      .eq('user_id', userId)
      .eq('preset_id', presetId)

    if (error) {
      console.error('[Sync] Error unpinning preset:', error.message)
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

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`[Sync] Request timed out after ${timeoutMs}ms`)
        resolve(fallback)
      }, timeoutMs)
    })
  ])
}

export async function syncAllData(userId: string): Promise<SyncData> {
  console.log('[Sync] Starting sync for user:', userId)
  const startTime = Date.now()
  
  // Add 5 second timeout for each request
  const TIMEOUT_MS = 5000
  
  const [assets, generations, favorites, pinnedPresetIds] = await Promise.all([
    withTimeout(fetchUserAssets(userId), TIMEOUT_MS, { models: [], backgrounds: [], products: [], vibes: [] }),
    withTimeout(fetchGenerations(userId), TIMEOUT_MS, []),
    withTimeout(fetchFavorites(userId), TIMEOUT_MS, []),
    withTimeout(fetchPinnedPresets(userId), TIMEOUT_MS, new Set<string>()),
  ])

  const duration = Date.now() - startTime
  console.log(`[Sync] Completed in ${duration}ms`)

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

