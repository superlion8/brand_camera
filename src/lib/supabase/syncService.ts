import { createClient } from './client'
import { Asset, AssetType, Generation, Favorite } from '@/types'

// Singleton client for consistency
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient()
  }
  return supabaseClient
}

// Reset client (useful for auth changes)
export function resetSupabaseClient() {
  supabaseClient = null
}

// Generate a human-readable task ID
function generateTaskId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `TASK-${timestamp}-${random}`.toUpperCase()
}

// Check if string is base64
function isBase64(str: string): boolean {
  if (!str) return false
  return str.startsWith('data:image/') || (str.length > 1000 && /^[A-Za-z0-9+/]+=*$/.test(str.substring(0, 100)))
}

// Upload base64 image to Supabase Storage
async function uploadToStorage(base64: string, userId: string, prefix: string, retries = 3): Promise<string | null> {
  if (!isBase64(base64)) return base64 // Already a URL
  
  const supabase = getSupabase()
  
  // Remove data URL prefix if present
  let base64Content = base64
  let contentType = 'image/png'
  
  if (base64.startsWith('data:')) {
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      contentType = match[1]
      base64Content = match[2]
    } else {
      base64Content = base64.replace(/^data:image\/\w+;base64,/, '')
    }
  }
  
  // Convert base64 to blob
  let blob: Blob
  try {
    const byteCharacters = atob(base64Content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    blob = new Blob([byteArray], { type: contentType })
  } catch (e) {
    console.error('[Storage] Failed to decode base64:', e)
    return null
  }
  
  // Generate unique filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = contentType.split('/')[1] || 'png'
  const fileName = `${userId}/${prefix}_${timestamp}_${random}.${extension}`
  
  // Upload with retry
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Storage] Retry ${attempt}/${retries - 1} for ${prefix}...`)
        await new Promise(r => setTimeout(r, 1000 * attempt)) // 递增延迟
      }
      
      const { data, error } = await supabase.storage
        .from('generations')
        .upload(fileName, blob, {
          contentType,
          cacheControl: '31536000',
          upsert: false,
        })
      
      if (error) {
        console.error(`[Storage] Upload error (attempt ${attempt + 1}):`, error.message)
        if (attempt === retries - 1) return null
        continue
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('generations')
        .getPublicUrl(data.path)
      
      console.log('[Storage] Uploaded:', prefix, '->', publicUrl.substring(0, 60) + '...')
      return publicUrl
    } catch (error) {
      console.error(`[Storage] Error (attempt ${attempt + 1}):`, error)
      if (attempt === retries - 1) return null
    }
  }
  
  return null
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
  
  // Upload image to Storage if it's base64
  let imageUrl = asset.imageUrl
  if (isBase64(imageUrl)) {
    console.log('[Sync] Uploading asset image to storage...')
    const uploaded = await uploadToUserAssetStorage(imageUrl, userId, asset.type)
    if (uploaded) {
      imageUrl = uploaded
      console.log('[Sync] Asset image uploaded:', imageUrl.substring(0, 60) + '...')
    } else {
      console.error('[Sync] Failed to upload asset image to storage')
      return null
    }
  }
  
  // Don't include 'id' - let Supabase auto-generate UUID
  const { data, error } = await supabase
    .from('user_assets')
    .insert({
      user_id: userId,
      type: asset.type,
      name: asset.name,
      image_url: imageUrl,
      thumbnail_url: asset.thumbnailUrl,
      tags: asset.tags,
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
    isPinned: data.is_pinned,
  }
}

// Upload base64 image to user-assets bucket
async function uploadToUserAssetStorage(base64: string, userId: string, assetType: string): Promise<string | null> {
  if (!isBase64(base64)) return base64 // Already a URL
  
  const supabase = getSupabase()
  
  try {
    // Remove data URL prefix if present
    let base64Content = base64
    let contentType = 'image/png'
    
    if (base64.startsWith('data:')) {
      const match = base64.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        contentType = match[1]
        base64Content = match[2]
      } else {
        base64Content = base64.replace(/^data:image\/\w+;base64,/, '')
      }
    }
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: contentType })
    
    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = contentType.split('/')[1] || 'png'
    const fileName = `${userId}/${assetType}/${timestamp}_${random}.${extension}`
    
    // Upload to user-assets bucket
    const { data, error } = await supabase.storage
      .from('user-assets')
      .upload(fileName, blob, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      })
    
    if (error) {
      console.error('[Storage] Upload to user-assets error:', error.message)
      return null
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-assets')
      .getPublicUrl(data.path)
    
    return publicUrl
  } catch (error) {
    console.error('[Storage] Error uploading to user-assets:', error)
    return null
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

// Pagination config
const PAGE_SIZE = 30

export async function fetchGenerations(userId: string, page: number = 0): Promise<{ generations: Generation[], hasMore: boolean }> {
  console.log('[Sync] Fetching generations for user_id:', userId, 'page:', page)
  const supabase = getSupabase()
  
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  
  // Fetch only completed, non-deleted generations with pagination
  const { data, error, count } = await supabase
    .from('generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[Sync] Error fetching generations:', error.message, error.code)
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.warn('[Sync] generations table does not exist. Please run the migration.')
    }
    return { generations: [], hasMore: false }
  }
  
  console.log('[Sync] Fetched generations from DB:', data?.length || 0, 'total:', count)

  const result = (data || [])
    .map(row => {
      // Handle both old and new table schemas
      let outputUrls: string[] = []
      
      // Try output_image_urls first (TEXT[] array)
      if (row.output_image_urls && Array.isArray(row.output_image_urls) && row.output_image_urls.length > 0) {
        outputUrls = row.output_image_urls
      }
      // Fallback to output_images (JSONB array)
      else if (row.output_images && Array.isArray(row.output_images) && row.output_images.length > 0) {
        outputUrls = row.output_images.map((img: any) => {
          if (typeof img === 'string') return img
          if (typeof img === 'object' && img.url) return img.url
          return null
        }).filter(Boolean)
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
    // Filter out generations without valid output images AFTER mapping
    .filter(gen => gen.outputImageUrls && gen.outputImageUrls.length > 0)
  
  const hasMore = count ? (from + PAGE_SIZE) < count : false
  console.log('[Sync] Generations after processing:', result.length, 'hasMore:', hasMore)
  
  return { generations: result, hasMore }
}

// Fetch all generations (for backward compatibility) - uses pagination internally
export async function fetchAllGenerations(userId: string): Promise<Generation[]> {
  const allGenerations: Generation[] = []
  let page = 0
  let hasMore = true
  
  // Fetch first page
  const firstResult = await fetchGenerations(userId, 0)
  allGenerations.push(...firstResult.generations)
  hasMore = firstResult.hasMore
  page = 1
  
  // For initial sync, fetch remaining pages in background (max 5 pages = 150 items)
  while (hasMore && page < 5) {
    const result = await fetchGenerations(userId, page)
    allGenerations.push(...result.generations)
    hasMore = result.hasMore
    page++
  }
  
  return allGenerations
}

// Helper to map old type names to new task_type values
function mapTypeToTaskType(type?: string): string {
  if (!type) return 'model_studio'
  
  const typeMap: Record<string, string> = {
    'camera_product': 'product_studio',
    'camera_model': 'model_studio',
    'camera': 'model_studio',
    'edit': 'edit',
    'studio': 'product_studio',
    'model_studio': 'model_studio',
    'product_studio': 'product_studio',
  }
  
  return typeMap[type] || 'model_studio'
}

export async function saveGeneration(userId: string, generation: Generation): Promise<Generation | null> {
  const supabase = getSupabase()
  
  console.log('[Sync] Processing generation for upload...')
  
  // Upload input image to storage if it's base64
  let inputImageUrl = generation.inputImageUrl
  if (isBase64(inputImageUrl)) {
    const uploaded = await uploadToStorage(inputImageUrl, userId, 'input')
    if (uploaded) inputImageUrl = uploaded
  }
  
  // Upload input image 2 to storage if it's base64
  let inputImage2Url = generation.inputImage2Url
  if (inputImage2Url && isBase64(inputImage2Url)) {
    const uploaded = await uploadToStorage(inputImage2Url, userId, 'input2')
    if (uploaded) inputImage2Url = uploaded
  }
  
  // Upload output images to storage if they're base64
  const outputImageUrls: string[] = []
  if (generation.outputImageUrls?.length) {
    for (let i = 0; i < generation.outputImageUrls.length; i++) {
      const url = generation.outputImageUrls[i]
      if (isBase64(url)) {
        const uploaded = await uploadToStorage(url, userId, `output_${i}`)
        outputImageUrls.push(uploaded || url)
      } else {
        outputImageUrls.push(url)
      }
    }
  }
  
  // Build insert/update object matching the actual table schema
  // Required fields: user_id, task_type, status
  const insertData: Record<string, any> = {
    user_id: userId,
    task_id: generation.id, // 使用传入的 taskId，与 quota/reserve 关联
    task_type: mapTypeToTaskType(generation.type), // Required NOT NULL
    status: 'completed',
  }
  
  // Input images - save URL if available (not base64)
  // Log warning if we still have base64 (upload failed)
  if (inputImageUrl) {
    if (!isBase64(inputImageUrl)) {
      insertData.input_image_url = inputImageUrl
    } else {
      console.warn('[Sync] Input image is still base64, upload may have failed')
    }
  }
  if (inputImage2Url) {
    if (!isBase64(inputImage2Url)) {
      insertData.input_image2_url = inputImage2Url
    } else {
      console.warn('[Sync] Input image 2 is still base64, upload may have failed')
    }
  }
  if (generation.createdAt) insertData.created_at = generation.createdAt
  
  // Output images (now as URLs) - use both formats for compatibility
  const uploadedOutputUrls = outputImageUrls.filter(url => !isBase64(url))
  const failedUploadCount = outputImageUrls.length - uploadedOutputUrls.length
  
  if (failedUploadCount > 0) {
    console.warn(`[Sync] ${failedUploadCount}/${outputImageUrls.length} images failed to upload to storage`)
  }
  
  if (uploadedOutputUrls.length > 0) {
    insertData.output_image_urls = uploadedOutputUrls
    insertData.total_images_count = uploadedOutputUrls.length
    
    // Also save as JSONB format
    insertData.output_images = uploadedOutputUrls.map((url, index) => ({
      type: 'model',
      url,
      index,
      mode: generation.outputGenModes?.[index] || 'extended'
    }))
  }
  
  // Counts
  if (uploadedOutputUrls.length) {
    insertData.model_images_count = uploadedOutputUrls.length
    insertData.product_images_count = 0
  }
  
  // Prompts
  if (generation.prompt) insertData.final_prompt = generation.prompt
  if (generation.prompts?.length) insertData.prompts = generation.prompts
  
  // Mode counts
  if (generation.outputGenModes?.length) {
    insertData.output_gen_modes = generation.outputGenModes
    insertData.simple_mode_count = generation.outputGenModes.filter(m => m === 'simple').length
    insertData.extended_mode_count = generation.outputGenModes.filter(m => m === 'extended').length
  }
  
  // Model types
  if (generation.outputModelTypes?.length) {
    insertData.output_model_types = generation.outputModelTypes
  }
  
  // Params as JSONB - include input images for reference
  const inputParams: Record<string, any> = {
    ...generation.params,
  }
  // Add input images to params if they're URLs
  if (inputImageUrl && !isBase64(inputImageUrl)) {
    inputParams.inputImage = inputImageUrl
  }
  if (inputImage2Url && !isBase64(inputImage2Url)) {
    inputParams.inputImage2 = inputImage2Url
  }
  // Add model/background images from params if available
  if (generation.params?.modelImage && !isBase64(generation.params.modelImage)) {
    insertData.model_image_url = generation.params.modelImage
  }
  if (generation.params?.backgroundImage && !isBase64(generation.params.backgroundImage)) {
    insertData.background_image_url = generation.params.backgroundImage
  }
  
  if (Object.keys(inputParams).length > 0) {
    insertData.input_params = inputParams
  }
  
  console.log('[Sync] Saving generation:', generation.id)
  
  // 先检查是否存在该 task_id 的记录（由 quota/reserve 创建的预扣配额记录）
  // 可能是 pending 状态（还没被 quota/reserve PUT 更新）
  // 也可能是 completed/failed 状态（已被 quota/reserve PUT 更新）
  // 如果存在，UPDATE 它；否则 INSERT 新记录
  const { data: existingRecord } = await supabase
    .from('generations')
    .select('id, status')
    .eq('user_id', userId)
    .eq('task_id', generation.id)
    .single()
  
  let data: any
  let error: any
  
  if (existingRecord) {
    // UPDATE 已存在的记录（可能是 pending 或已被 quota/reserve PUT 更新）
    console.log('[Sync] Found existing record (status:', existingRecord.status, '), updating:', existingRecord.id)
    const result = await supabase
      .from('generations')
      .update(insertData)
      .eq('id', existingRecord.id)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    // INSERT 新记录
    const result = await supabase
      .from('generations')
      .insert(insertData)
      .select()
      .single()
    data = result.data
    error = result.error
  }

  if (error) {
    console.error('[Sync] Error saving generation:', error.message, error.code)
    // If column doesn't exist, try with absolute minimal fields
    if (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('schema cache')) {
      console.warn('[Sync] Trying minimal insert (schema mismatch)...')
      
      // Absolute minimal - just the required NOT NULL fields
      const minimalData: Record<string, any> = {
        user_id: userId,
        task_type: mapTypeToTaskType(generation.type), // Required NOT NULL
        status: 'completed',
      }
      
      // Try to add output images
      if (generation.outputImageUrls?.length) {
        minimalData.output_image_urls = generation.outputImageUrls
        minimalData.total_images_count = generation.outputImageUrls.length
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
  // Handle output images - could be in output_image_urls (TEXT[]) or output_images (JSONB)
  let outputUrls = data.output_image_urls || []
  if ((!outputUrls || outputUrls.length === 0) && data.output_images) {
    outputUrls = data.output_images.map((img: any) => 
      typeof img === 'string' ? img : img.url
    )
  }
  
  return {
    id: data.id,
    type: data.task_type || data.type,
    inputImageUrl: data.input_image_url || '',
    inputImage2Url: data.input_image2_url,
    outputImageUrls: outputUrls,
    outputModelTypes: data.output_model_types || [],
    outputGenModes: data.output_gen_modes || [],
    prompt: data.final_prompt || data.prompt,
    prompts: data.prompts || [],
    params: data.input_params || data.params,
    createdAt: data.created_at,
  }
}

export async function deleteGeneration(userId: string, generationId: string): Promise<boolean> {
  const supabase = getSupabase()
  
  // Soft delete: mark as deleted instead of actually deleting
  // This prevents users from hacking the quota system by deleting generations
  const { error } = await supabase
    .from('generations')
    .update({ 
      is_deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq('id', generationId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error soft-deleting generation:', error)
    return false
  }
  
  console.log('[Sync] Soft-deleted generation:', generationId)
  return true
}

// Update generation images (for deleting single image)
// Note: This only updates the display, quota is NOT refunded
export async function updateGenerationImages(
  userId: string, 
  generationId: string, 
  newOutputUrls: string[]
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('generations')
    .update({ 
      output_image_urls: newOutputUrls,
      // Don't update total_images_count - keep original for quota calculation
    })
    .eq('id', generationId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating generation images:', error)
    return false
  }
  
  console.log('[Sync] Updated generation images:', generationId, 'remaining:', newOutputUrls.length)
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
  console.log('[Sync] Saving favorite:', { userId, generationId: favorite.generationId, imageIndex: favorite.imageIndex })
  
  const supabase = getSupabase()
  
  // Check if we have a valid session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('[Sync] No active session, cannot save favorite')
    return null
  }
  
  console.log('[Sync] Session user ID:', session.user.id, 'Requested user ID:', userId)
  
  // The generation_id must be a valid UUID from the generations table
  // Check if the generation exists and get its UUID
  const { data: generation, error: genError } = await supabase
    .from('generations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  
  // Find the generation that matches our local ID
  // Note: Local generationId might be a custom string, we need to handle this
  let generationUuid = favorite.generationId
  
  // If the generationId doesn't look like a UUID, try to find a matching generation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(favorite.generationId)) {
    console.warn('[Sync] Generation ID is not a UUID, favorite may not sync correctly:', favorite.generationId)
    // For now, just log and continue - the insert will fail if the FK doesn't exist
  }
  
  // Don't include 'id' - let Supabase auto-generate UUID
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: userId,
      generation_id: favorite.generationId,
      image_index: favorite.imageIndex,
    })
    .select()
    .single()

  if (error) {
    console.error('[Sync] Error saving favorite:', error.message, error.code, error.details)
    // Common error: Foreign key violation if generation doesn't exist in cloud
    if (error.code === '23503') {
      console.error('[Sync] Foreign key violation - generation may not exist in cloud yet')
    }
    return null
  }

  console.log('[Sync] Favorite saved successfully:', data.id)
  
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
  hasMoreGenerations?: boolean
}

export async function syncAllData(userId: string): Promise<SyncData> {
  console.log('[Sync] Starting sync for user:', userId)
  const startTime = Date.now()
  
  // Fetch sequentially to avoid connection issues on first load
  // This is more reliable than parallel requests for initial connection
  try {
    // Warm up the connection with a simple query first
    const supabase = getSupabase()
    console.log('[Sync] Warming up connection...')
    await supabase.from('generations').select('id').limit(1).maybeSingle()
    console.log('[Sync] Connection ready')
    
    // Fetch first page of generations quickly for fast initial load
    console.log('[Sync] Fetching first page of generations...')
    const firstPageResult = await fetchGenerations(userId, 0).catch(e => {
      console.error('[Sync] fetchGenerations error:', e)
      return { generations: [], hasMore: false }
    })
    console.log('[Sync] First page:', firstPageResult.generations.length, 'hasMore:', firstPageResult.hasMore)
    
    console.log('[Sync] Fetching user assets...')
    const assets = await fetchUserAssets(userId).catch(e => {
      console.error('[Sync] fetchUserAssets error:', e)
      return { models: [], backgrounds: [], products: [], vibes: [] }
    })
    console.log('[Sync] User assets:', assets.models?.length || 0, 'models')
    
    console.log('[Sync] Fetching favorites...')
    const favorites = await fetchFavorites(userId).catch(e => {
      console.error('[Sync] fetchFavorites error:', e)
      return []
    })
    
    console.log('[Sync] Fetching pinned presets...')
    const pinnedPresetIds = await fetchPinnedPresets(userId).catch(e => {
      console.error('[Sync] fetchPinnedPresets error:', e)
      return new Set<string>()
    })

    const duration = Date.now() - startTime
    console.log(`[Sync] Completed in ${duration}ms`, {
      generations: firstPageResult.generations.length,
      hasMoreGenerations: firstPageResult.hasMore,
      models: assets.models?.length || 0,
      backgrounds: assets.backgrounds?.length || 0,
      favorites: favorites.length,
    })

    return {
      userModels: assets.models || [],
      userBackgrounds: assets.backgrounds || [],
      userProducts: assets.products || [],
      userVibes: assets.vibes || [],
      generations: firstPageResult.generations || [],
      favorites: favorites || [],
      pinnedPresetIds: pinnedPresetIds || new Set<string>(),
      hasMoreGenerations: firstPageResult.hasMore,
    }
  } catch (error) {
    console.error('[Sync] syncAllData error:', error)
    // Return empty data on error
    return {
      userModels: [],
      userBackgrounds: [],
      userProducts: [],
      userVibes: [],
      generations: [],
      favorites: [],
      pinnedPresetIds: new Set<string>(),
    }
  }
}

