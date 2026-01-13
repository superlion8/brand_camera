"use client"

import { useCallback } from 'react'

interface DownloadOptions {
  filename?: string
  generationId?: string
  imageIndex?: number
}

interface UseImageDownloadOptions {
  /** Source identifier for tracking (e.g., 'camera', 'gallery', 'social') */
  trackingSource?: string
  /** Default filename prefix (e.g., 'buyer-show', 'pro-studio') */
  filenamePrefix?: string
}

/**
 * Hook for downloading images with iOS share support and optional tracking
 * 
 * Features:
 * - iOS: Uses navigator.share() for native "Save Image" option
 * - Android/Desktop: Uses blob download
 * - Optional download tracking via /api/track/download
 * - Handles both URL and base64 data URLs
 * 
 * @example
 * const { downloadImage } = useImageDownload({ 
 *   trackingSource: 'camera',
 *   filenamePrefix: 'buyer-show' 
 * })
 * 
 * // Basic usage
 * await downloadImage(imageUrl)
 * 
 * // With custom filename and tracking
 * await downloadImage(imageUrl, { 
 *   filename: 'custom-name.jpg',
 *   generationId: 'gen-123',
 *   imageIndex: 0 
 * })
 */
export function useImageDownload(options: UseImageDownloadOptions = {}) {
  const { trackingSource, filenamePrefix = 'image' } = options

  const downloadImage = useCallback(async (
    url: string,
    downloadOptions: DownloadOptions = {}
  ): Promise<boolean> => {
    const { 
      filename = `${filenamePrefix}-${Date.now()}.jpg`,
      generationId,
      imageIndex 
    } = downloadOptions

    // Track download event (fire and forget)
    if (trackingSource) {
      fetch('/api/track/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: url,
          generationId,
          imageIndex,
          source: trackingSource,
        }),
      }).catch(() => {}) // Silently ignore tracking errors
    }

    try {
      let blob: Blob

      // Handle base64 data URLs
      if (url.startsWith('data:')) {
        const response = await fetch(url)
        blob = await response.blob()
      } else {
        // Handle regular URLs
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }
        blob = await response.blob()
      }

      // Detect iOS
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
      
      // Determine file type from blob or filename
      const extension = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeType = blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg')
      
      const file = new File([blob], filename, { type: mimeType })

      // iOS: Use native share for "Save Image" option
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          return true
        } catch (e: any) {
          // User cancelled share - not an error
          if (e.name === 'AbortError') {
            return false
          }
          // Fall through to regular download if share fails
          console.warn('Share failed, falling back to download:', e)
        }
      }

      // Android/Desktop: Use blob download
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      
      return true
    } catch (error) {
      console.error('Download failed:', error)
      return false
    }
  }, [trackingSource, filenamePrefix])

  return { downloadImage }
}

/**
 * Standalone download function for use outside React components
 * 
 * @example
 * await downloadImageStandalone(imageUrl, {
 *   filename: 'my-image.jpg',
 *   trackingSource: 'gallery'
 * })
 */
export async function downloadImageStandalone(
  url: string,
  options: DownloadOptions & { trackingSource?: string; filenamePrefix?: string } = {}
): Promise<boolean> {
  const { 
    filename,
    filenamePrefix = 'image',
    generationId,
    imageIndex,
    trackingSource 
  } = options

  const finalFilename = filename || `${filenamePrefix}-${Date.now()}.jpg`

  // Track download event
  if (trackingSource) {
    fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        generationId,
        imageIndex,
        source: trackingSource,
      }),
    }).catch(() => {})
  }

  try {
    let blob: Blob

    if (url.startsWith('data:')) {
      const response = await fetch(url)
      blob = await response.blob()
    } else {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      blob = await response.blob()
    }

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
    const extension = finalFilename.split('.').pop()?.toLowerCase() || 'jpg'
    const mimeType = blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg')
    const file = new File([blob], finalFilename, { type: mimeType })

    if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return true
      } catch (e: any) {
        if (e.name === 'AbortError') return false
      }
    }

    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = finalFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
    
    return true
  } catch (error) {
    console.error('Download failed:', error)
    return false
  }
}
