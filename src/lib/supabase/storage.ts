import { createClient } from './client'

const BUCKET_NAME = 'generations'

/**
 * Upload a base64 image to Supabase Storage and return the public URL
 */
export async function uploadGeneratedImage(
  base64Data: string,
  userId: string,
  prefix: string = 'img'
): Promise<string | null> {
  const supabase = createClient()
  
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '')
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    
    // Detect image type from base64 header
    let contentType = 'image/png'
    if (base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg')) {
      contentType = 'image/jpeg'
    } else if (base64Data.startsWith('data:image/webp')) {
      contentType = 'image/webp'
    }
    
    const blob = new Blob([byteArray], { type: contentType })
    
    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = contentType.split('/')[1]
    const fileName = `${userId}/${prefix}_${timestamp}_${random}.${extension}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      })
    
    if (error) {
      console.error('[Storage] Upload error:', error)
      return null
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)
    
    console.log('[Storage] Uploaded:', publicUrl)
    return publicUrl
  } catch (error) {
    console.error('[Storage] Error uploading image:', error)
    return null
  }
}

/**
 * Upload multiple base64 images and return their URLs
 */
export async function uploadMultipleImages(
  images: Array<{ base64: string; prefix: string }>,
  userId: string
): Promise<string[]> {
  const results = await Promise.all(
    images.map(({ base64, prefix }) => uploadGeneratedImage(base64, userId, prefix))
  )
  
  // Filter out nulls and return only successful uploads
  return results.filter((url): url is string => url !== null)
}

/**
 * Check if a string is a base64 image
 */
export function isBase64Image(str: string): boolean {
  return str.startsWith('data:image/') || /^[A-Za-z0-9+/]+=*$/.test(str.substring(0, 100))
}

/**
 * Convert base64 to URL if needed, otherwise return as-is
 */
export async function ensureImageUrl(
  imageData: string,
  userId: string,
  prefix: string = 'img'
): Promise<string> {
  if (!imageData) return ''
  
  // If it's already a URL, return as-is
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData
  }
  
  // If it's base64, upload and return URL
  if (isBase64Image(imageData)) {
    const url = await uploadGeneratedImage(imageData, userId, prefix)
    return url || imageData // Fallback to original if upload fails
  }
  
  return imageData
}

/**
 * Delete an image from storage
 */
export async function deleteGeneratedImage(url: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Extract path from URL
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/generations\/(.+)/)
    
    if (!pathMatch) {
      console.error('[Storage] Invalid URL format:', url)
      return false
    }
    
    const filePath = pathMatch[1]
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])
    
    if (error) {
      console.error('[Storage] Delete error:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('[Storage] Error deleting image:', error)
    return false
  }
}
