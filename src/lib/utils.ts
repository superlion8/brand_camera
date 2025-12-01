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

// Strip base64 prefix
export function stripBase64Prefix(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '')
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

// Compress base64 image
export async function compressBase64Image(base64: string, maxDimension: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
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
    }
    img.onerror = reject
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

// Convert URL to base64
export async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Failed to convert URL to base64:', error)
    throw error
  }
}

// Ensure image is base64 (convert URL if needed)
export async function ensureBase64(imageSource: string | undefined | null): Promise<string | null> {
  if (!imageSource) {
    console.log('ensureBase64: No image source provided')
    return null
  }
  
  if (isUrl(imageSource)) {
    try {
      console.log('ensureBase64: Converting URL to base64:', imageSource.substring(0, 80))
      const base64 = await urlToBase64(imageSource)
      console.log('ensureBase64: Successfully converted, length:', base64.length)
      return base64
    } catch (error) {
      console.error('ensureBase64: Failed to convert URL:', error)
      return null
    }
  }
  
  // Already base64
  console.log('ensureBase64: Already base64, length:', imageSource.length)
  return imageSource
}

