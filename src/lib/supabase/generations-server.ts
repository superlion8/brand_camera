import { createClient } from './server'

// Types (same as client)
export interface GenerationInput {
  productImageUrl?: string
  modelStyle?: string
  modelGender?: string
  modelImageUrl?: string
  backgroundImageUrl?: string
  vibeImageUrl?: string
  customPrompt?: string
  instructPrompt?: string // Generated photography instructions
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

// Server-side: Save generation record
export async function saveGenerationServer(
  userId: string,
  taskType: 'camera' | 'edit',
  inputParams: GenerationInput,
  outputUrls: string[],
  durationMs: number,
  status: 'completed' | 'failed' = 'completed',
  errorMessage?: string
): Promise<GenerationRecord | null> {
  const supabase = await createClient()

  // Count product vs model images (first 2 are product, rest are model)
  const productCount = Math.min(2, outputUrls.length)
  const modelCount = Math.max(0, outputUrls.length - 2)

  // Prepare output images array
  const outputImages: GenerationOutput[] = outputUrls.map((url, index) => ({
    type: index < 2 ? 'product' : 'model',
    url,
    index,
  }))

  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id: userId,
      task_type: taskType,
      status,
      input_params: inputParams,
      output_images: outputImages,
      product_images_count: productCount,
      model_images_count: modelCount,
      total_images_count: outputUrls.length,
      duration_ms: durationMs,
      error_message: errorMessage,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving generation to database:', error)
    return null
  }

  return data
}

