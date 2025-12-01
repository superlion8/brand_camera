import { createClient } from './client'

// Types
export interface GenerationInput {
  productImageUrl?: string
  modelStyle?: string
  modelGender?: string
  modelImageUrl?: string
  backgroundImageUrl?: string
  vibeImageUrl?: string
  customPrompt?: string
}

export interface GenerationOutput {
  type: 'product' | 'model'
  url: string
  index: number
}

export interface GenerationRecord {
  id: string
  user_id: string
  task_type: 'camera' | 'edit'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  product_images_count: number
  model_images_count: number
  total_images_count: number
  input_params: GenerationInput
  output_images: GenerationOutput[]
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at: string
}

export interface CreateGenerationParams {
  taskType: 'camera' | 'edit'
  inputParams: GenerationInput
}

export interface UpdateGenerationParams {
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  outputImages?: GenerationOutput[]
  productImagesCount?: number
  modelImagesCount?: number
  errorMessage?: string
  durationMs?: number
}

export interface UserGenerationStats {
  user_id: string
  total_generations: number
  total_images: number
  total_product_images: number
  total_model_images: number
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
    console.error('User not authenticated')
    return null
  }

  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id: user.id,
      task_type: params.taskType,
      status: 'processing',
      input_params: params.inputParams,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating generation:', error)
    return null
  }

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
  if (params.errorMessage) updateData.error_message = params.errorMessage
  if (params.durationMs !== undefined) updateData.duration_ms = params.durationMs

  const { data, error } = await supabase
    .from('generations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating generation:', error)
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
    console.error('Error fetching generations:', error)
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
    console.error('Error fetching generation:', error)
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
        successful_generations: 0,
        failed_generations: 0,
        avg_duration_ms: 0,
        last_generation_at: '',
      }
    }
    console.error('Error fetching user stats:', error)
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
    console.error('Error deleting generation:', error)
    return false
  }

  return true
}

// Helper function to save generation with full flow
export async function saveGenerationRecord(
  taskType: 'camera' | 'edit',
  inputParams: GenerationInput,
  outputUrls: string[],
  durationMs: number,
  productCount: number = 2,
  modelCount: number = 2
): Promise<GenerationRecord | null> {
  // Create initial record
  const record = await createGeneration({
    taskType,
    inputParams,
  })

  if (!record) return null

  // Prepare output images array
  const outputImages: GenerationOutput[] = outputUrls.map((url, index) => ({
    type: index < productCount ? 'product' : 'model',
    url,
    index,
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

