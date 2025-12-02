import { createClient } from './client'

// Task types - 任务类型
export type TaskType = 'model_studio' | 'product_studio' | 'edit'

// Generation modes - 生成模式
export type GenMode = 'simple' | 'extended'

// Types
export interface GenerationInput {
  productImageUrl?: string
  productImage2Url?: string
  modelStyle?: string
  modelGender?: string
  modelImageUrl?: string
  backgroundImageUrl?: string
  vibeImageUrl?: string
  customPrompt?: string
  // Studio specific
  lightType?: string
  lightDirection?: string
  backgroundColor?: string
  aspectRatio?: string
}

export interface GenerationOutput {
  type: 'product' | 'model'
  url: string
  index: number
  mode?: GenMode // 'simple' or 'extended'
  prompt?: string // The prompt used for this specific image
}

export interface GenerationRecord {
  id: string
  user_id: string
  user_email?: string
  task_type: TaskType
  status: 'pending' | 'processing' | 'completed' | 'failed'
  // Input fields (直接存储，便于查询)
  input_image_url?: string
  input_image2_url?: string
  model_image_url?: string
  background_image_url?: string
  final_prompt?: string
  // Counts
  product_images_count: number
  model_images_count: number
  simple_mode_count: number
  extended_mode_count: number
  total_images_count: number
  // Full params (JSON)
  input_params: GenerationInput
  output_images: GenerationOutput[]
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at: string
}

export interface CreateGenerationParams {
  taskType: TaskType
  inputParams: GenerationInput
  inputImageUrl?: string
  inputImage2Url?: string
  modelImageUrl?: string
  backgroundImageUrl?: string
}

export interface UpdateGenerationParams {
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  outputImages?: GenerationOutput[]
  productImagesCount?: number
  modelImagesCount?: number
  simpleModeCount?: number
  extendedModeCount?: number
  finalPrompt?: string
  errorMessage?: string
  durationMs?: number
}

export interface UserGenerationStats {
  user_id: string
  user_email?: string
  total_generations: number
  total_images: number
  total_product_images: number
  total_model_images: number
  total_simple_mode: number
  total_extended_mode: number
  model_studio_count: number
  product_studio_count: number
  edit_count: number
  successful_generations: number
  failed_generations: number
  avg_duration_ms: number
  last_generation_at: string
}

// Create a new generation record
export async function createGeneration(params: CreateGenerationParams): Promise<GenerationRecord | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('[Generations] User not authenticated')
    return null
  }

  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id: user.id,
      task_type: params.taskType,
      status: 'processing',
      input_params: params.inputParams,
      input_image_url: params.inputImageUrl,
      input_image2_url: params.inputImage2Url,
      model_image_url: params.modelImageUrl,
      background_image_url: params.backgroundImageUrl,
    })
    .select()
    .single()

  if (error) {
    console.error('[Generations] Error creating generation:', error)
    return null
  }

  console.log('[Generations] Created record:', data.id)
  return data
}

// Update a generation record
export async function updateGeneration(
  id: string, 
  params: UpdateGenerationParams
): Promise<GenerationRecord | null> {
  const supabase = createClient()

  const updateData: Record<string, any> = {}
  
  if (params.status) updateData.status = params.status
  if (params.outputImages) {
    updateData.output_images = params.outputImages
    updateData.total_images_count = params.outputImages.length
  }
  if (params.productImagesCount !== undefined) updateData.product_images_count = params.productImagesCount
  if (params.modelImagesCount !== undefined) updateData.model_images_count = params.modelImagesCount
  if (params.simpleModeCount !== undefined) updateData.simple_mode_count = params.simpleModeCount
  if (params.extendedModeCount !== undefined) updateData.extended_mode_count = params.extendedModeCount
  if (params.finalPrompt) updateData.final_prompt = params.finalPrompt
  if (params.errorMessage) updateData.error_message = params.errorMessage
  if (params.durationMs !== undefined) updateData.duration_ms = params.durationMs

  const { data, error } = await supabase
    .from('generations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Generations] Error updating generation:', error)
    return null
  }

  return data
}

// Get user's generations with pagination
export async function getUserGenerations(
  page: number = 1, 
  pageSize: number = 20
): Promise<{ data: GenerationRecord[]; total: number }> {
  const supabase = createClient()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('generations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[Generations] Error fetching generations:', error)
    return { data: [], total: 0 }
  }

  return { data: data || [], total: count || 0 }
}

// Get a single generation by ID
export async function getGeneration(id: string): Promise<GenerationRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[Generations] Error fetching generation:', error)
    return null
  }

  return data
}

// Get user's generation stats
export async function getUserStats(): Promise<UserGenerationStats | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_generation_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    // If no stats yet, return default values
    if (error.code === 'PGRST116') {
      return {
        user_id: user.id,
        total_generations: 0,
        total_images: 0,
        total_product_images: 0,
        total_model_images: 0,
        total_simple_mode: 0,
        total_extended_mode: 0,
        model_studio_count: 0,
        product_studio_count: 0,
        edit_count: 0,
        successful_generations: 0,
        failed_generations: 0,
        avg_duration_ms: 0,
        last_generation_at: '',
      }
    }
    console.error('[Generations] Error fetching user stats:', error)
    return null
  }

  return data
}

// Delete a generation
export async function deleteGeneration(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('generations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[Generations] Error deleting generation:', error)
    return false
  }

  return true
}

// Helper function to save generation with full flow - 模特影棚
export async function saveModelStudioRecord(
  inputParams: GenerationInput,
  outputImages: GenerationOutput[],
  durationMs: number,
  finalPrompt?: string
): Promise<GenerationRecord | null> {
  // Count modes
  const simpleModeCount = outputImages.filter(img => img.mode === 'simple').length
  const extendedModeCount = outputImages.filter(img => img.mode === 'extended').length
  
  // Create initial record
  const record = await createGeneration({
    taskType: 'model_studio',
    inputParams,
    inputImageUrl: inputParams.productImageUrl,
    inputImage2Url: inputParams.productImage2Url,
    modelImageUrl: inputParams.modelImageUrl,
    backgroundImageUrl: inputParams.backgroundImageUrl,
  })

  if (!record) return null

  // Update with results
  const updated = await updateGeneration(record.id, {
    status: 'completed',
    outputImages,
    productImagesCount: 0, // 模特影棚没有商品图输出
    modelImagesCount: outputImages.length,
    simpleModeCount,
    extendedModeCount,
    finalPrompt,
    durationMs,
  })

  return updated
}

// Helper function to save generation with full flow - 商品影棚
export async function saveProductStudioRecord(
  inputParams: GenerationInput,
  outputImages: GenerationOutput[],
  durationMs: number,
  finalPrompt?: string
): Promise<GenerationRecord | null> {
  // Create initial record
  const record = await createGeneration({
    taskType: 'product_studio',
    inputParams,
    inputImageUrl: inputParams.productImageUrl,
  })

  if (!record) return null

  // Update with results
  const updated = await updateGeneration(record.id, {
    status: 'completed',
    outputImages,
    productImagesCount: outputImages.length,
    modelImagesCount: 0,
    simpleModeCount: 0,
    extendedModeCount: 0,
    finalPrompt,
    durationMs,
  })

  return updated
}

// Helper function to save generation with full flow - 修图室
export async function saveEditRecord(
  inputParams: GenerationInput,
  outputImages: GenerationOutput[],
  durationMs: number,
  finalPrompt?: string
): Promise<GenerationRecord | null> {
  // Create initial record
  const record = await createGeneration({
    taskType: 'edit',
    inputParams,
    inputImageUrl: inputParams.productImageUrl,
    modelImageUrl: inputParams.modelImageUrl,
    backgroundImageUrl: inputParams.backgroundImageUrl,
  })

  if (!record) return null

  // Update with results
  const updated = await updateGeneration(record.id, {
    status: 'completed',
    outputImages,
    productImagesCount: 0,
    modelImagesCount: outputImages.length,
    simpleModeCount: 0,
    extendedModeCount: outputImages.length, // 修图室都是扩展模式
    finalPrompt,
    durationMs,
  })

  return updated
}

// Legacy function for backward compatibility
export async function saveGenerationRecord(
  taskType: 'camera' | 'edit',
  inputParams: GenerationInput,
  outputUrls: string[],
  durationMs: number,
  productCount: number = 2,
  modelCount: number = 2
): Promise<GenerationRecord | null> {
  // Map old task types to new ones
  const newTaskType: TaskType = taskType === 'camera' ? 'model_studio' : 'edit'
  
  // Create initial record
  const record = await createGeneration({
    taskType: newTaskType,
    inputParams,
    inputImageUrl: inputParams.productImageUrl,
    modelImageUrl: inputParams.modelImageUrl,
    backgroundImageUrl: inputParams.backgroundImageUrl,
  })

  if (!record) return null

  // Prepare output images array
  const outputImages: GenerationOutput[] = outputUrls.map((url, index) => ({
    type: index < productCount ? 'product' : 'model',
    url,
    index,
    mode: 'extended' as GenMode,
  }))

  // Update with results
  const updated = await updateGeneration(record.id, {
    status: 'completed',
    outputImages,
    productImagesCount: Math.min(productCount, outputUrls.length),
    modelImagesCount: Math.max(0, outputUrls.length - productCount),
    durationMs,
  })

  return updated
}
