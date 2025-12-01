import { createClient } from './client'

// Storage bucket names
export const BUCKETS = {
  PRESETS: 'presets',
  USER_ASSETS: 'user-assets',
  GENERATIONS: 'generations',
} as const

// Upload a file to storage
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean }
): Promise<string | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options?.contentType || 'image/jpeg',
      upsert: options?.upsert ?? true,
    })
  
  if (error) {
    console.error('Upload error:', error)
    return null
  }
  
  return data.path
}

// Upload base64 image to storage
export async function uploadBase64Image(
  bucket: string,
  path: string,
  base64Data: string
): Promise<string | null> {
  try {
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
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: contentType })
    
    return uploadFile(bucket, path, blob, { contentType })
  } catch (error) {
    console.error('Base64 upload error:', error)
    return null
  }
}

// Get public URL for a file
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Delete a file from storage
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  
  if (error) {
    console.error('Delete error:', error)
    return false
  }
  return true
}

// Upload user input image and return public URL
export async function uploadUserImage(
  base64Data: string,
  type: 'input' | 'asset',
  userId?: string
): Promise<string | null> {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(7)
  const folder = userId || 'anonymous'
  const path = `${folder}/${type}/${timestamp}-${randomId}.jpg`
  
  const uploadPath = await uploadBase64Image(BUCKETS.USER_ASSETS, path, base64Data)
  if (!uploadPath) return null
  
  return getPublicUrl(BUCKETS.USER_ASSETS, uploadPath)
}

// Upload generated image and return public URL
export async function uploadGeneratedImage(
  base64Data: string,
  generationId: string,
  index: number,
  userId?: string
): Promise<string | null> {
  const folder = userId || 'anonymous'
  const path = `${folder}/${generationId}/output-${index}.png`
  
  const uploadPath = await uploadBase64Image(BUCKETS.GENERATIONS, path, base64Data)
  if (!uploadPath) return null
  
  return getPublicUrl(BUCKETS.GENERATIONS, uploadPath)
}

// Check if storage is available (user is logged in)
export async function isStorageAvailable(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

