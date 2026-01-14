"use client"

import { useState, useEffect } from "react"

interface CameraPermissionState {
  hasCamera: boolean
  cameraReady: boolean
  permissionChecked: boolean
}

/**
 * Hook to manage camera permission state
 * Skips camera permission check on desktop - only upload is available
 */
export function useCameraPermission(isDesktop: boolean, screenLoading: boolean): CameraPermissionState {
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  useEffect(() => {
    const checkCameraPermission = async () => {
      // Skip camera permission check on desktop - only upload is available
      if (isDesktop) {
        setHasCamera(false)
        setPermissionChecked(true)
        return
      }

      try {
        // First check localStorage for cached permission state
        const cachedPermission = localStorage.getItem('cameraPermissionGranted')
        if (cachedPermission === 'true') {
          setCameraReady(true)
          setPermissionChecked(true)
          return
        }

        // Check if permission API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            setCameraReady(true)
            localStorage.setItem('cameraPermissionGranted', 'true')
          } else if (result.state === 'denied') {
            setHasCamera(false)
            localStorage.setItem('cameraPermissionGranted', 'false')
          }

          // Listen for permission changes
          result.addEventListener('change', () => {
            if (result.state === 'granted') {
              setCameraReady(true)
              localStorage.setItem('cameraPermissionGranted', 'true')
            } else if (result.state === 'denied') {
              setHasCamera(false)
              localStorage.setItem('cameraPermissionGranted', 'false')
            }
          })
        }
      } catch (e) {
        // Permission API not supported, try to get stream directly
        console.log('Permission API not supported, trying direct stream access')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          // Permission granted, stop the stream (Webcam will create its own)
          stream.getTracks().forEach(track => track.stop())
          setCameraReady(true)
          localStorage.setItem('cameraPermissionGranted', 'true')
        } catch (streamError) {
          console.log('Camera access denied or unavailable')
          setHasCamera(false)
        }
      }
      setPermissionChecked(true)
    }

    // Wait for screen loading to determine if desktop
    if (!screenLoading) {
      checkCameraPermission()
    }
  }, [isDesktop, screenLoading])

  return { hasCamera, cameraReady, permissionChecked }
}
