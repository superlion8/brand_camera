import { createClient } from './server'

// Storage bucket names
export const BUCKETS = {
  PRESETS: 'presets',
  USER_ASSETS: 'user-assets',
  GENERATIONS: 'generations',
} as const

// Upload base64 image to storage (server-side)
export async function uploadBase64ImageServer(
  bucket: string,
  path: string,
  base64Data: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    
    // Remove data URL prefix if present
    const base64Content = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data
    
    // Detect content type from data URL
    let contentType = 'image/jpeg'
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);/)
      if (match) contentType = match[1]
    }
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64')
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      })
    
    if (error) {
      console.error('Storage upload error:', error)
      return null
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return urlData.publicUrl
  } catch (error) {
    console.error('Base64 upload error:', error)
    return null
  }
}

// Upload generated image and return public URL (server-side)
export async function uploadGeneratedImageServer(
  base64Data: string,
  generationId: string,
  index: number,
  userId: string
): Promise<string | null> {
  const path = `${userId}/${generationId}/output-${index}.png`
  return uploadBase64ImageServer(BUCKETS.GENERATIONS, path, base64Data)
}

// Upload input image (server-side)
export async function uploadInputImageServer(
  base64Data: string,
  generationId: string,
  userId: string
): Promise<string | null> {
  const path = `${userId}/${generationId}/input.jpg`
  return uploadBase64ImageServer(BUCKETS.GENERATIONS, path, base64Data)
}

