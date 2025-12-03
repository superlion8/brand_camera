import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

// Strip base64 prefix - handles various image formats
export function stripBase64Prefix(base64: string): string {
  if (!base64) {
    console.error('stripBase64Prefix: Received empty or null input')
    return ''
  }
  
  // Handle various base64 prefixes (jpeg, png, webp, gif, svg+xml, octet-stream, etc.)
  // More permissive regex to handle various MIME types
  const prefixMatch = base64.match(/^data:[^;]+;base64,/)
  if (prefixMatch) {
    const stripped = base64.substring(prefixMatch[0].length)
    // Remove any whitespace/newlines that might be in the base64 string
    const cleaned = stripped.replace(/\s/g, '')
    console.log(`stripBase64Prefix: Stripped prefix "${prefixMatch[0]}", result length: ${cleaned.length}`)
    return cleaned
  }
  
  // If no prefix found, clean and check if it looks like raw base64
  const cleaned = base64.replace(/\s/g, '')
  if (/^[A-Za-z0-9+/]+=*$/.test(cleaned.substring(0, 100))) {
    console.log('stripBase64Prefix: Input appears to be raw base64, length:', cleaned.length)
    return cleaned
  }
  
  console.warn('stripBase64Prefix: Unrecognized format, first 100 chars:', base64.substring(0, 100))
  // Try to extract base64 data anyway - look for base64, marker
  const base64Marker = base64.indexOf('base64,')
  if (base64Marker !== -1) {
    const extracted = base64.substring(base64Marker + 7).replace(/\s/g, '')
    console.log('stripBase64Prefix: Extracted after base64 marker, length:', extracted.length)
    return extracted
  }
  
  return cleaned
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Format date
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  
  return d.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  })
}

// Compress image before upload
export async function compressImage(file: File, maxSizeMB: number = 1): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const img = new Image()
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      let { width, height } = img
      const maxDimension = 1920
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension
          width = maxDimension
        } else {
          width = (width / height) * maxDimension
          height = maxDimension
        }
      }
      
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Compress base64 image (also handles URLs)
export async function compressBase64Image(base64: string, maxDimension: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    // Enable CORS for cross-origin images (e.g., from Supabase Storage)
    // Must be set before img.src
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        let { width, height } = img
        
        // Scale down if needed
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        
        // Use lower quality for faster transfer
        const compressed = canvas.toDataURL('image/jpeg', 0.8)
        resolve(compressed)
      } catch (error) {
        // If canvas is tainted, return original (for URLs that don't support CORS)
        console.warn('[compressBase64Image] Canvas tainted, returning original:', error)
        resolve(base64)
      }
    }
    img.onerror = (e) => {
      console.error('[compressBase64Image] Image load error:', e)
      // Return original on error
      resolve(base64)
    }
    img.src = base64
  })
}

// Fetch with timeout
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeout: number = 120000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Check if string is a URL
export function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}

// Convert URL to base64 using Image + Canvas (more reliable, handles CORS)
export async function urlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous' // Enable CORS
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        
        console.log('urlToBase64: Converted successfully, length:', dataUrl.length)
        resolve(dataUrl)
      } catch (error) {
        console.error('urlToBase64: Canvas conversion failed:', error)
        reject(error)
      }
    }
    
    img.onerror = (error) => {
      console.error('urlToBase64: Image load failed:', url, error)
      reject(new Error(`Failed to load image: ${url}`))
    }
    
    // Add cache buster if URL already has params
    const separator = url.includes('?') ? '&' : '?'
    img.src = `${url}${separator}_t=${Date.now()}`
  })
}

// Ensure image is base64 (convert URL if needed)
export async function ensureBase64(imageSource: string | undefined | null): Promise<string | null> {
  if (!imageSource) {
    console.log('ensureBase64: No image source provided')
    return null
  }
  
  if (isUrl(imageSource)) {
    try {
      console.log('ensureBase64: Converting URL to base64:', imageSource.substring(0, 100))
      const base64 = await urlToBase64(imageSource)
      
      // Validate the result
      if (!base64 || !base64.startsWith('data:image/')) {
        console.error('ensureBase64: Invalid base64 result')
        return null
      }
      
      console.log('ensureBase64: Successfully converted, length:', base64.length)
      return base64
    } catch (error) {
      console.error('ensureBase64: Failed to convert URL:', imageSource, error)
      return null
    }
  }
  
  // Already base64 - validate it
  if (imageSource.startsWith('data:')) {
    console.log('ensureBase64: Already data URL, length:', imageSource.length)
    return imageSource
  }
  
  // Might be raw base64, add prefix
  if (/^[A-Za-z0-9+/]+=*$/.test(imageSource.substring(0, 100))) {
    console.log('ensureBase64: Raw base64 detected, adding prefix, length:', imageSource.length)
    return `data:image/jpeg;base64,${imageSource}`
  }
  
  console.warn('ensureBase64: Unknown format, first 50 chars:', imageSource.substring(0, 50))
  return imageSource
}

